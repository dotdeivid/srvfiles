package transfer

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"

	"golang.org/x/crypto/hkdf"
)

// ─── SessionCipher ────────────────────────────────────────────────────────────

// SessionCipher holds the per-connection AES-256-GCM key derived via ECDH P-256 + HKDF.
// Equivalent to the crypto helpers in transfer/session.ts.
type SessionCipher struct {
	key []byte // 32 bytes (AES-256)
}

// EncryptJSON encrypts a JSON string and returns base64-encoded IV and ciphertext.
// Equivalent to encryptMessage() in session.ts.
func (c *SessionCipher) EncryptJSON(plaintext string) (ivB64, dataB64 string, err error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", err
	}

	iv := make([]byte, gcm.NonceSize()) // 12 bytes
	if _, err = rand.Read(iv); err != nil {
		return "", "", err
	}

	ciphertext := gcm.Seal(nil, iv, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(iv),
		base64.StdEncoding.EncodeToString(ciphertext),
		nil
}

// DecryptJSON decrypts a base64-encoded IV + ciphertext pair back to a JSON string.
// Equivalent to decryptMessage() in session.ts.
func (c *SessionCipher) DecryptJSON(ivB64, dataB64 string) (string, error) {
	iv, err := base64.StdEncoding.DecodeString(ivB64)
	if err != nil {
		return "", err
	}
	ciphertext, err := base64.StdEncoding.DecodeString(dataB64)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// EncryptBinary encrypts a binary payload and returns [12B IV || ciphertext].
// Equivalent to encryptBinary() in session.ts.
func (c *SessionCipher) EncryptBinary(payload []byte) ([]byte, error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	iv := make([]byte, gcm.NonceSize()) // 12 bytes
	if _, err = rand.Read(iv); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nil, iv, payload, nil)
	return append(iv, ciphertext...), nil
}

// DecryptBinary decrypts a [12B IV || ciphertext] binary payload.
// Equivalent to decryptBinary() in session.ts.
func (c *SessionCipher) DecryptBinary(data []byte) ([]byte, error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return nil, errors.New("binary payload too short")
	}

	iv, ciphertext := data[:nonceSize], data[nonceSize:]
	return gcm.Open(nil, iv, ciphertext, nil)
}

// ─── WsSession ────────────────────────────────────────────────────────────────

// WsSession manages the ECDH key-exchange lifecycle for a single WebSocket connection.
type WsSession struct {
	Cipher *SessionCipher // nil until key-exchange completes
}

// HandleKeyExchange performs the server side of the ECDH P-256 handshake:
//  1. Decodes the client's public key (base64-encoded uncompressed point).
//  2. Generates an ephemeral server key pair.
//  3. Derives a 32-byte AES-256 key via HKDF-SHA-256 (info = "srvfiles-ws-v1").
//  4. Stores the derived cipher in s.Cipher.
//  5. Returns the server's public key as base64, to be sent back to the client.
//
// Equivalent to handleKeyExchange() in transfer/session.ts.
func (s *WsSession) HandleKeyExchange(clientPubKeyB64 string) (string, error) {
	clientPubBytes, err := base64.StdEncoding.DecodeString(clientPubKeyB64)
	if err != nil {
		return "", err
	}

	curve := ecdh.P256()

	clientPubKey, err := curve.NewPublicKey(clientPubBytes)
	if err != nil {
		return "", err
	}

	serverPrivKey, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return "", err
	}

	sharedSecret, err := serverPrivKey.ECDH(clientPubKey)
	if err != nil {
		return "", err
	}

	// HKDF-SHA-256: same salt/info as the TypeScript client
	hkdfReader := hkdf.New(sha256.New, sharedSecret, nil, []byte("srvfiles-ws-v1"))
	aesKey := make([]byte, 32)
	if _, err = io.ReadFull(hkdfReader, aesKey); err != nil {
		return "", err
	}

	s.Cipher = &SessionCipher{key: aesKey}

	serverPubBytes := serverPrivKey.PublicKey().Bytes()
	return base64.StdEncoding.EncodeToString(serverPubBytes), nil
}
