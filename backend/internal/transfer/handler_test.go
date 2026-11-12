package transfer

import (
	"crypto/ecdh"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/crypto/hkdf"

	"srvfiles/internal/auth"
)

type peer struct {
	t      *testing.T
	ws     *websocket.Conn
	id     string
	cipher atomic.Pointer[SessionCipher] // lo lee también la goroutine lectora
	msgs   chan map[string]any
	bins   chan []byte
	// closeErr es el error con que terminó la lectura; válido tras cerrarse msgs.
	closeErr error
}

func newRelay(t *testing.T) string {
	t.Helper()
	auth.ResetAuth()
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", HandleConnection)
	srv := httptest.NewServer(mux)
	t.Cleanup(func() {
		srv.Close()
		auth.ResetAuth()
	})
	return "ws" + strings.TrimPrefix(srv.URL, "http")
}

func dial(t *testing.T, url string) *peer {
	t.Helper()
	ws, _, err := websocket.DefaultDialer.Dial(url+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	p := &peer{t: t, ws: ws, msgs: make(chan map[string]any, 64), bins: make(chan []byte, 64)}
	t.Cleanup(func() { _ = ws.Close() })
	go func() {
		for {
			kind, data, err := ws.ReadMessage()
			if err != nil {
				p.closeErr = err
				close(p.msgs)
				return
			}
			if kind == websocket.BinaryMessage {
				if c := p.cipher.Load(); c != nil {
					data, _ = c.DecryptBinary(data)
				}
				p.bins <- data
				continue
			}
			var m map[string]any
			_ = json.Unmarshal(data, &m)
			if c := p.cipher.Load(); m["type"] == "encrypted" && c != nil {
				plain, _ := c.DecryptJSON(m["iv"].(string), m["data"].(string))
				_ = json.Unmarshal([]byte(plain), &m)
			}
			p.msgs <- m
		}
	}()
	return p
}

func (p *peer) send(m map[string]any) {
	data, _ := json.Marshal(m)
	if c := p.cipher.Load(); c != nil {
		iv, enc, _ := c.EncryptJSON(string(data))
		data, _ = json.Marshal(map[string]string{"type": "encrypted", "iv": iv, "data": enc})
	}
	_ = p.ws.WriteMessage(websocket.TextMessage, data)
}

// sendPlain manda sin cifrar aunque haya clave de canal.
func (p *peer) sendPlain(m map[string]any) {
	data, _ := json.Marshal(m)
	_ = p.ws.WriteMessage(websocket.TextMessage, data)
}

func (p *peer) expect(kind string) map[string]any {
	p.t.Helper()
	timeout := time.After(3 * time.Second)
	for {
		select {
		case m, ok := <-p.msgs:
			if !ok {
				p.t.Fatalf("connection closed while waiting for %q", kind)
			}
			if m["type"] == kind {
				return m
			}
		case <-timeout:
			p.t.Fatalf("timeout waiting for %q", kind)
		}
	}
}

// join authenticates, optionally negotiates encryption, and registers.
func join(t *testing.T, url, name string, encrypted bool) *peer {
	t.Helper()
	p := dial(t, url)
	p.send(map[string]any{"type": "auth", "token": auth.CreateSession()})
	p.expect("auth_ok")
	if encrypted {
		priv, _ := ecdh.P256().GenerateKey(rand.Reader)
		p.send(map[string]any{"type": "key-exchange", "publicKey": base64.StdEncoding.EncodeToString(priv.PublicKey().Bytes())})
		reply := p.expect("key-exchange")
		serverPub, _ := base64.StdEncoding.DecodeString(reply["publicKey"].(string))
		pub, err := ecdh.P256().NewPublicKey(serverPub)
		if err != nil {
			t.Fatal(err)
		}
		secret, _ := priv.ECDH(pub)
		key := make([]byte, 32)
		_, _ = io.ReadFull(hkdf.New(sha256.New, secret, nil, []byte("srvfiles-ws-v1")), key)
		p.cipher.Store(&SessionCipher{key: key})
	}
	p.send(map[string]any{"type": "hello", "appName": name, "e2e": 1})
	p.id = p.expect("welcome")["clientId"].(string)
	return p
}

// e2eKey: una clave pública P-256 válida (el relay solo valida el formato).
func e2eKey() string {
	priv, _ := ecdh.P256().GenerateKey(rand.Reader)
	return base64.StdEncoding.EncodeToString(priv.PublicKey().Bytes())
}

func frame(transferID string) []byte {
	return append([]byte(transferID+strings.Repeat(" ", transferIDLen-len(transferID))), 1, 2, 3)
}

func (p *peer) sendChunk(transferID string) {
	data := frame(transferID)
	if c := p.cipher.Load(); c != nil {
		data, _ = c.EncryptBinary(data)
	}
	_ = p.ws.WriteMessage(websocket.BinaryMessage, data)
}

func noBinary(t *testing.T, p *peer) {
	t.Helper()
	select {
	case <-p.bins:
		t.Fatal("chunk was relayed but should not have been")
	case <-time.After(200 * time.Millisecond):
	}
}

func TestAuthIsRequired(t *testing.T) {
	url := newRelay(t)
	p := dial(t, url)
	p.send(map[string]any{"type": "hello", "appName": "Sin token"})
	timeout := time.After(3 * time.Second)
	for open := true; open; {
		select {
		case _, open = <-p.msgs:
		case <-timeout:
			t.Fatal("connection was not closed")
		}
	}
	if ce, ok := p.closeErr.(*websocket.CloseError); !ok || ce.Code != 4401 {
		t.Fatalf("want close 4401, got %v", p.closeErr)
	}
}

func TestChunksOnlyFromSenderAfterAcceptAndCancelOnDisconnect(t *testing.T) {
	url := newRelay(t)
	sender := join(t, url, "Emisor", true) // con cifrado: el relay descifra y re-cifra
	receiver := join(t, url, "Receptor", false)
	intruder := join(t, url, "Intruso", false)

	const id = "tx-1"
	senderKey := e2eKey()
	sender.send(map[string]any{"type": "send-request", "to": receiver.id, "transferId": id, "fileName": "a.bin", "fileSize": 3,
		"e2e": map[string]any{"publicKey": senderKey}})
	req := receiver.expect("send-request")
	if req["fromName"] != "Emisor" || req["e2e"].(map[string]any)["publicKey"] != senderKey {
		t.Fatalf("request must carry the sender's E2E key: %v", req)
	}

	sender.sendChunk(id)
	noBinary(t, receiver) // todavía no aceptó

	// Aceptar sin haber mandado la clave E2E no habilita el envío.
	receiver.send(map[string]any{"type": "send-accept", "transferId": id})
	receiverKey := e2eKey()
	receiver.send(map[string]any{"type": "send-key", "transferId": id, "publicKey": receiverKey})
	if k := sender.expect("send-key"); k["publicKey"] != receiverKey {
		t.Fatalf("sender must get the receiver's key: %v", k)
	}
	receiver.send(map[string]any{"type": "send-accept", "transferId": id})
	sender.expect("send-accept")

	intruder.sendChunk(id)
	noBinary(t, receiver)

	sender.sendChunk(id)
	select {
	case got := <-receiver.bins:
		if string(got) != string(frame(id)) {
			t.Fatalf("relayed chunk corrupted: %v", got)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("chunk from the sender was not relayed")
	}

	// send-complete lleva el marcador final E2E sin tocarlo.
	sender.send(map[string]any{"type": "send-complete", "transferId": id, "e2e": map[string]any{"final": "Zm9v"}})
	if c := receiver.expect("send-complete"); c["e2e"].(map[string]any)["final"] != "Zm9v" {
		t.Fatalf("final marker must be forwarded: %v", c)
	}

	// Duplicado (la transferencia sigue registrada hasta completar: se crea otra)
	sender.send(map[string]any{"type": "send-request", "to": receiver.id, "transferId": "tx-2", "e2e": map[string]any{"publicKey": senderKey}})
	receiver.expect("send-request")
	sender.send(map[string]any{"type": "send-request", "to": receiver.id, "transferId": "tx-2", "e2e": map[string]any{"publicKey": senderKey}})
	if r := sender.expect("send-reject"); r["reason"] != "duplicate" {
		t.Fatalf("duplicate transferId: %v", r)
	}

	_ = sender.ws.Close()
	if c := receiver.expect("send-cancel"); c["transferId"] != "tx-2" {
		t.Fatalf("receiver must get send-cancel when sender disconnects: %v", c)
	}
}

// Cifrado de extremo a extremo obligatorio.
func TestRequestsWithoutE2EAreRejected(t *testing.T) {
	url := newRelay(t)
	sender := join(t, url, "Emisor", false)
	receiver := join(t, url, "Receptor", false)

	sender.send(map[string]any{"type": "send-request", "to": receiver.id, "transferId": "tx-plain"})
	if r := sender.expect("send-reject"); r["reason"] != "e2e-required" {
		t.Fatalf("request without E2E key: %v", r)
	}

	old := dial(t, url) // cliente viejo: no anuncia e2e en hello
	old.send(map[string]any{"type": "auth", "token": auth.CreateSession()})
	old.expect("auth_ok")
	old.send(map[string]any{"type": "hello", "appName": "Viejo"})
	oldID := old.expect("welcome")["clientId"].(string)
	sender.send(map[string]any{"type": "send-request", "to": oldID, "transferId": "tx-old", "e2e": map[string]any{"publicKey": e2eKey()}})
	if r := sender.expect("send-reject"); r["reason"] != "e2e-unsupported" {
		t.Fatalf("request to a client without E2E support: %v", r)
	}
}

func TestPlaintextRejectedOnEncryptedSession(t *testing.T) {
	url := newRelay(t)
	p := join(t, url, "Cifrado", true)
	p.sendPlain(map[string]any{"type": "rename", "newName": "Hackeado"}) // en claro a propósito
	p.send(map[string]any{"type": "rename", "newName": "Legítimo"})

	for {
		m := p.expect("clients")
		var name any
		for _, c := range m["clients"].([]any) {
			if c.(map[string]any)["clientId"] == p.id {
				name = c.(map[string]any)["appName"]
			}
		}
		if name == "Hackeado" {
			t.Fatal("plaintext message was accepted on an encrypted session")
		}
		if name == "Legítimo" {
			return
		}
	}
}
