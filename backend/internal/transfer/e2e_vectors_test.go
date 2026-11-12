package transfer

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"testing"

	"golang.org/x/crypto/hkdf"
)

// El servidor no cifra de extremo a extremo (solo reenvía), pero esta es la
// implementación de referencia del algoritmo de docs/protocol.md. Los mismos
// vectores (testdata/e2e-vectors.json = docs/e2e-test-vectors.json) los
// verifican la web y la app móvil.
func TestE2EReferenceVectors(t *testing.T) {
	raw, err := os.ReadFile("testdata/e2e-vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var v struct {
		TransferID string `json:"transferId"`
		Sender     struct {
			PrivateHex string `json:"privateHex"`
			PublicKey  string `json:"publicKey"`
		} `json:"sender"`
		Receiver struct {
			PrivateHex string `json:"privateHex"`
			PublicKey  string `json:"publicKey"`
		} `json:"receiver"`
		KeyHex string `json:"keyHex"`
		SAS    string `json:"sas"`
		Chunks []struct {
			Index      uint64 `json:"index"`
			Plaintext  string `json:"plaintext"`
			Ciphertext string `json:"ciphertext"`
		} `json:"chunks"`
		Final struct {
			Index      uint64 `json:"index"`
			Plaintext  string `json:"plaintext"`
			Ciphertext string `json:"ciphertext"`
		} `json:"final"`
	}
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatal(err)
	}

	priv := func(h string) *ecdh.PrivateKey {
		b, _ := hex.DecodeString(h)
		k, err := ecdh.P256().NewPrivateKey(b)
		if err != nil {
			t.Fatal(err)
		}
		return k
	}
	sender, receiver := priv(v.Sender.PrivateHex), priv(v.Receiver.PrivateHex)
	if base64.StdEncoding.EncodeToString(sender.PublicKey().Bytes()) != v.Sender.PublicKey {
		t.Fatal("sender public key mismatch")
	}

	// Ambos lados derivan lo mismo.
	for _, pair := range [][2]*ecdh.PrivateKey{{sender, receiver}, {receiver, sender}} {
		shared, _ := pair[0].ECDH(pair[1].PublicKey())
		info := append(append([]byte("srvfiles-e2e-v1"), sender.PublicKey().Bytes()...), receiver.PublicKey().Bytes()...)
		okm := make([]byte, 36)
		_, _ = io.ReadFull(hkdf.New(sha256.New, shared, []byte(v.TransferID), info), okm)
		if hex.EncodeToString(okm[:32]) != v.KeyHex {
			t.Fatal("derived key mismatch")
		}
		if sas := fmt.Sprintf("%06d", binary.BigEndian.Uint32(okm[32:])%1_000_000); sas != v.SAS {
			t.Fatalf("SAS = %s, want %s", sas, v.SAS)
		}
	}

	key, _ := hex.DecodeString(v.KeyHex)
	block, _ := aes.NewCipher(key)
	gcm, _ := cipher.NewGCM(block)
	nonce := func(i uint64) []byte {
		n := make([]byte, 12)
		binary.BigEndian.PutUint64(n[4:], i)
		return n
	}
	for _, c := range v.Chunks {
		plain, _ := base64.StdEncoding.DecodeString(c.Plaintext)
		if got := base64.StdEncoding.EncodeToString(gcm.Seal(nil, nonce(c.Index), plain, []byte(v.TransferID))); got != c.Ciphertext {
			t.Fatalf("chunk %d ciphertext mismatch", c.Index)
		}
	}
	final := base64.StdEncoding.EncodeToString(gcm.Seal(nil, nonce(v.Final.Index), []byte(v.Final.Plaintext), []byte(v.TransferID+"|end")))
	if final != v.Final.Ciphertext {
		t.Fatal("final marker ciphertext mismatch")
	}
	// Un chunk con el índice equivocado no se descifra (detecta reordenamiento).
	ct, _ := base64.StdEncoding.DecodeString(v.Chunks[0].Ciphertext)
	if _, err := gcm.Open(nil, nonce(1), ct, []byte(v.TransferID)); err == nil {
		t.Fatal("chunk decrypted with the wrong index")
	}
}
