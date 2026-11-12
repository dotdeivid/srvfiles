package transfer

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/gorilla/websocket"

	"srvfiles/internal/auth"
	"srvfiles/internal/logger"
	"srvfiles/internal/network"
	"srvfiles/internal/webguard"
)

// ─── Limits ───────────────────────────────────────────────────────────────────

const (
	chunkSize       = 256 * 1024
	transferIDLen   = 36
	maxMessageBytes = chunkSize + transferIDLen + 12 + 16 + 4096 // chunk + header + IV/tag + margen
	maxClients      = 100
	maxAppNameLen   = 64
)

// ─── Upgrader ─────────────────────────────────────────────────────────────────

var upgrader = websocket.Upgrader{
	// Mismos orígenes que la API: la propia página, Tauri, Vite en localhost y
	// clientes nativos (sin Origin).
	CheckOrigin:     webguard.AllowedOrigin,
	ReadBufferSize:  64 * 1024,
	WriteBufferSize: 64 * 1024,
}

// ─── HandleConnection ─────────────────────────────────────────────────────────

// HandleConnection is the entry point for every WebSocket connection on /ws.
//
// Protocolo: auth (obligatorio, dentro de authWait) → auth_ok → key-exchange
// opcional → hello → señalización. El cifrado es salto a salto (cliente ↔
// servidor): el servidor descifra cada chunk y lo vuelve a cifrar para el
// receptor. Ver docs/protocol.md.
func HandleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Log.Warn("transfer.handler.go", "WS upgrade failed", "error", err)
		return
	}

	clientID := auth.NewID()
	clientIP := extractIP(r)
	client := newClient(conn, clientID, clientIP)
	defer cleanup(client)

	conn.SetReadLimit(maxMessageBytes)
	_ = conn.SetReadDeadline(time.Now().Add(authWait))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	session := &WsSession{}
	authenticated := false

	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			return // closed, timeout, or message over the limit
		}

		// ── Binary frame: relay a chunk to the receiver ─────────────────
		if msgType == websocket.BinaryMessage {
			if !authenticated {
				client.closeWithCode(4401, "Unauthorized")
				return
			}
			relayBinary(client, session, data)
			continue
		}

		// ── Text frame: JSON signaling ─────────────────────────────────
		var msg map[string]any
		if err := json.Unmarshal(data, &msg); err != nil {
			logger.Log.Warn("transfer.handler.go", "WS message is not valid JSON", "clientId", clientID)
			continue
		}

		// Con clave establecida solo se aceptan sobres cifrados.
		if cipher := client.Cipher(); cipher != nil {
			if strVal(msg, "type") != "encrypted" {
				logger.Log.Warn("transfer.handler.go", "Plaintext message rejected on encrypted session",
					"type", strVal(msg, "type"), "clientId", clientID)
				continue
			}
			plaintext, err := cipher.DecryptJSON(strVal(msg, "iv"), strVal(msg, "data"))
			if err != nil {
				logger.Log.Warn("transfer.handler.go", "Failed to decrypt JSON frame", "error", err)
				continue
			}
			msg = nil
			if err := json.Unmarshal([]byte(plaintext), &msg); err != nil {
				continue
			}
		}

		msgKind := strVal(msg, "type")

		// ── First message must be auth ─────────────────────────────────
		if !authenticated {
			if msgKind != "auth" || !auth.ValidateToken(strVal(msg, "token")) {
				logger.Log.Warn("transfer.handler.go", "WS auth failed", "clientIP", clientIP)
				client.closeWithCode(4401, "Unauthorized")
				return
			}
			authenticated = true
			_ = conn.SetReadDeadline(time.Now().Add(pongWait))
			client.SendRaw(map[string]string{"type": "auth_ok"})
			continue
		}

		switch msgKind {
		case "key-exchange":
			if client.Cipher() != nil {
				continue // ya negociado
			}
			serverPubKey, err := session.HandleKeyExchange(strVal(msg, "publicKey"))
			if err != nil {
				logger.Log.Warn("transfer.handler.go", "Key exchange failed", "error", err)
				client.SendRaw(map[string]any{"type": "key-exchange-error", "reason": "invalid key"})
				continue
			}
			// La respuesta sale en claro (encolada antes de activar la clave).
			client.SendRaw(map[string]any{"type": "key-exchange", "publicKey": serverPubKey})
			client.setCipher(session.Cipher)

		case "hello":
			handleHello(client, msg)

		case "set-receiving":
			if !isRegistered(client) {
				continue
			}
			client.mu.Lock()
			client.receiving = boolVal(msg, "receiving")
			client.mu.Unlock()
			Default.BroadcastClients()

		case "rename":
			if !isRegistered(client) {
				continue
			}
			if newName := cleanName(strVal(msg, "newName")); newName != "" {
				client.mu.Lock()
				client.appName = newName
				client.mu.Unlock()
				Default.BroadcastClients()
			}

		case "send-request":
			if isRegistered(client) {
				handleSendRequest(client, msg)
			}

		case "send-key":
			// Clave pública E2E del receptor → emisor. El servidor no puede
			// descifrar el contenido: solo reenvía.
			if !isRegistered(client) {
				continue
			}
			transferID := strVal(msg, "transferId")
			publicKey := strVal(msg, "publicKey")
			if !validPublicKey(publicKey) {
				continue
			}
			t := Default.MarkKeySent(transferID, clientID)
			if t == nil {
				continue
			}
			if sender := Default.Get(t.SenderClientID); sender != nil {
				sender.SendJSON(map[string]any{"type": "send-key", "transferId": transferID, "publicKey": publicKey})
			}

		case "send-accept":
			if !isRegistered(client) {
				continue
			}
			transferID := strVal(msg, "transferId")
			t := Default.AcceptTransfer(transferID, clientID)
			if t == nil {
				continue
			}
			logger.Log.Info("transfer.handler.go", "Transfer accepted", "transferId", transferID)
			if sender := Default.Get(t.SenderClientID); sender != nil {
				sender.SendJSON(map[string]any{"type": "send-accept", "transferId": transferID})
			}

		case "send-reject":
			if !isRegistered(client) {
				continue
			}
			transferID := strVal(msg, "transferId")
			t := Default.GetTransfer(transferID)
			if t == nil || t.ReceiverClientID != clientID {
				continue
			}
			Default.RemoveTransfer(transferID)
			reply := map[string]any{"type": "send-reject", "transferId": transferID}
			if reason := strVal(msg, "reason"); reason != "" {
				reply["reason"] = reason
			}
			if sender := Default.Get(t.SenderClientID); sender != nil {
				sender.SendJSON(reply)
			}

		case "send-cancel":
			if !isRegistered(client) {
				continue
			}
			transferID := strVal(msg, "transferId")
			t := Default.GetTransfer(transferID)
			if t == nil || (t.SenderClientID != clientID && t.ReceiverClientID != clientID) {
				continue
			}
			Default.RemoveTransfer(transferID)
			otherID := t.ReceiverClientID
			if t.SenderClientID != clientID {
				otherID = t.SenderClientID
			}
			if other := Default.Get(otherID); other != nil {
				other.SendJSON(map[string]any{"type": "send-cancel", "transferId": transferID})
			}

		case "send-complete":
			if !isRegistered(client) {
				continue
			}
			transferID := strVal(msg, "transferId")
			t := Default.GetTransfer(transferID)
			if t == nil || t.SenderClientID != clientID {
				continue
			}
			Default.RemoveTransfer(transferID)
			logger.Log.Info("transfer.handler.go", "Transfer complete",
				"transferId", transferID, "fileSize", t.FileSize)
			if receiver := Default.Get(t.ReceiverClientID); receiver != nil {
				// e2e.final: marcador cifrado de extremo a extremo (chunks, tamaño, nombre).
				receiver.SendJSON(map[string]any{
					"type":       "send-complete",
					"transferId": transferID,
					"e2e":        map[string]any{"final": e2eField(msg, "final")},
				})
			}
		}
	}
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

func handleHello(client *Client, msg map[string]any) {
	client.mu.Lock()
	already := client.registered
	client.mu.Unlock()
	if !already && Default.Count() >= maxClients {
		client.closeWithCode(1013, "Demasiados clientes")
		return
	}

	appName := cleanName(strVal(msg, "appName"))
	if appName == "" {
		appName = "Dispositivo"
	}
	deviceType := "desktop"
	if strVal(msg, "deviceType") == "mobile" {
		deviceType = "mobile"
	}
	serverPort := int(int64Val(msg, "serverPort"))
	if serverPort < 0 || serverPort > 65535 {
		serverPort = 0
	}

	client.mu.Lock()
	client.e2e = int64Val(msg, "e2e") >= 1
	client.registered = true
	client.appName = appName
	client.deviceType = deviceType
	client.isServer = boolVal(msg, "isServer")
	client.serverPort = serverPort
	client.mu.Unlock()

	Default.Add(client.ClientID, client)
	logger.Log.Info("transfer.handler.go", "Client registered",
		"clientId", client.ClientID, "appName", appName, "ip", client.IP, "deviceType", deviceType)
	client.SendJSON(map[string]any{"type": "welcome", "clientId": client.ClientID})
	Default.BroadcastClients()
}

func handleSendRequest(client *Client, msg map[string]any) {
	to := strVal(msg, "to")
	transferID := strVal(msg, "transferId")
	fileName := strVal(msg, "fileName")
	fileSize := int64Val(msg, "fileSize")
	mimeType := strVal(msg, "mimeType")

	reject := func(reason string) {
		client.SendJSON(map[string]any{"type": "send-reject", "transferId": transferID, "reason": reason})
	}
	if transferID == "" || len(transferID) > transferIDLen || fileSize < 0 {
		reject("invalid")
		return
	}
	// Cifrado de extremo a extremo obligatorio: sin la clave del emisor no se reenvía.
	senderKey := e2eField(msg, "publicKey")
	if !validPublicKey(senderKey) {
		reject("e2e-required")
		return
	}
	receiver := Default.Get(to)
	if receiver == nil || to == client.ClientID {
		reject("offline")
		return
	}
	receiver.mu.Lock()
	receiverE2E := receiver.e2e
	receiver.mu.Unlock()
	if !receiverE2E {
		reject("e2e-unsupported")
		return
	}
	if !Default.AddTransfer(&TransferSession{
		TransferID:       transferID,
		SenderClientID:   client.ClientID,
		ReceiverClientID: to,
		FileName:         fileName,
		FileSize:         fileSize,
		MimeType:         mimeType,
	}) {
		reject("duplicate")
		return
	}
	logger.Log.Info("transfer.handler.go", "Transfer request relayed",
		"transferId", transferID, "from", client.ClientID, "to", to, "fileSize", fileSize)
	receiver.SendJSON(map[string]any{
		"type":       "send-request",
		"from":       client.ClientID,
		"fromName":   client.AppName(),
		"fileName":   fileName,
		"fileSize":   fileSize,
		"mimeType":   mimeType,
		"transferId": transferID,
		"e2e":        map[string]any{"publicKey": senderKey},
	})
}

// relayBinary forwards a chunk only from the session's sender, after accept.
func relayBinary(client *Client, session *WsSession, data []byte) {
	payload := data
	if cipher := client.Cipher(); cipher != nil {
		decrypted, err := cipher.DecryptBinary(data)
		if err != nil {
			logger.Log.Warn("transfer.handler.go", "Failed to decrypt binary frame", "error", err)
			return
		}
		payload = decrypted
	}
	if len(payload) <= transferIDLen {
		return
	}
	transferID := strings.TrimRight(string(payload[:transferIDLen]), " \x00")
	t := Default.GetTransfer(transferID)
	if t == nil || t.SenderClientID != client.ClientID || !t.Accepted {
		return
	}
	receiver := Default.Get(t.ReceiverClientID)
	if receiver == nil {
		return
	}
	if cipher := receiver.Cipher(); cipher != nil {
		encrypted, err := cipher.EncryptBinary(payload)
		if err != nil {
			logger.Log.Warn("transfer.handler.go", "Failed to encrypt binary frame for receiver", "error", err)
			return
		}
		receiver.SendBinary(encrypted)
	} else {
		receiver.SendBinary(payload)
	}
}

// cleanup removes the client, cancels its transfers and tells the other side.
func cleanup(client *Client) {
	client.Close()
	for _, t := range Default.TakeTransfersOf(client.ClientID) {
		otherID := t.ReceiverClientID
		if t.ReceiverClientID == client.ClientID {
			otherID = t.SenderClientID
		}
		if other := Default.Get(otherID); other != nil {
			other.SendJSON(map[string]any{"type": "send-cancel", "transferId": t.TransferID})
		}
	}
	if isRegistered(client) {
		logger.Log.Info("transfer.handler.go", "Client disconnected", "clientId", client.ClientID)
		Default.Remove(client.ClientID)
		Default.BroadcastClients()
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// e2eField reads msg["e2e"][key] as a string.
func e2eField(msg map[string]any, key string) string {
	obj, _ := msg["e2e"].(map[string]any)
	v, _ := obj[key].(string)
	return v
}

// validPublicKey: base64 de una clave P-256 sin comprimir (65 bytes).
func validPublicKey(b64 string) bool {
	raw, err := base64.StdEncoding.DecodeString(b64)
	return err == nil && len(raw) == 65 && raw[0] == 0x04
}

func isRegistered(c *Client) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.registered
}

func cleanName(s string) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, s)
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > maxAppNameLen {
		s = string(r[:maxAppNameLen])
	}
	return s
}

func extractIP(r *http.Request) string {
	ip := webguard.ClientIP(r)
	if ip == "127.0.0.1" || ip == "" {
		return network.GetLanIp()
	}
	return ip
}

func strVal(m map[string]any, key string) string {
	v, _ := m[key].(string)
	return v
}

func boolVal(m map[string]any, key string) bool {
	v, _ := m[key].(bool)
	return v
}

// int64Val reads a JSON number (float64 by default) as int64.
func int64Val(m map[string]any, key string) int64 {
	switch v := m[key].(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	}
	return 0
}
