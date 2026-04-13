package transfer

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"srvfiles/internal/auth"
	"srvfiles/internal/logger"
	"srvfiles/internal/network"
)

// ─── Upgrader ─────────────────────────────────────────────────────────────────

var upgrader = websocket.Upgrader{
	// Allow all origins — same as cors({ origin: '*' }) in the Node.js server
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  256 * 1024, // 256 KB — matches the P2P chunk size
	WriteBufferSize: 256 * 1024,
}

// ─── HandleConnection ─────────────────────────────────────────────────────────

// HandleConnection is the entry point for every WebSocket connection on /ws.
// Each call runs in its own goroutine (one per connection, managed by net/http).
// Equivalent to handleConnection() in transfer.handler.ts.
func HandleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Log.Error("transfer.handler.go", "WS upgrade failed", "error", err)
		return
	}
	defer conn.Close()

	clientID  := newUUID()
	clientIP  := extractIP(r)
	logger.Log.Debug("transfer.handler.go", "New WS connection", "clientIP", clientIP)

	var client *Client
	session       := &WsSession{}
	authenticated := false

	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			break // connection closed or network error
		}

		// ── Binary frame: relay 256 KB chunk to receiver ───────────────
		if msgType == websocket.BinaryMessage {
			if !authenticated {
				_ = conn.WriteControl(websocket.CloseMessage,
					websocket.FormatCloseMessage(4401, "Unauthorized"),
					time.Now().Add(time.Second))
				break
			}

			// Decrypt incoming binary if the sender has E2E enabled.
			payload := data
			if session.Cipher != nil {
				decrypted, err := session.Cipher.DecryptBinary(data)
				if err != nil {
					logger.Log.Warn("transfer.handler.go", "Failed to decrypt binary frame", "error", err)
					continue
				}
				payload = decrypted
			}

			if len(payload) < 36 {
				continue
			}
			// Frame layout: 36 bytes (ASCII transferId, space-padded) + chunk data.
			transferID := strings.TrimRight(string(payload[:36]), " \x00")
			t := Default.GetTransfer(transferID)
			if t == nil {
				logger.Log.Warn("transfer.handler.go", "Binary chunk for unknown transferId",
					"transferId", transferID)
				continue
			}
			receiver := Default.Get(t.ReceiverClientID)
			if receiver == nil {
				continue
			}
			// Re-encrypt for the receiver if they have E2E enabled.
			if receiver.Cipher != nil {
				encrypted, err := receiver.Cipher.EncryptBinary(payload)
				if err != nil {
					logger.Log.Warn("transfer.handler.go", "Failed to encrypt binary frame for receiver", "error", err)
					continue
				}
				receiver.SendBinary(encrypted)
			} else {
				receiver.SendBinary(payload)
			}
			continue
		}

		// ── Text frame: JSON signaling ─────────────────────────────────
		var msg map[string]any
		if err := json.Unmarshal(data, &msg); err != nil {
			logger.Log.Error("transfer.handler.go", "Mensaje WS no es JSON válido", "error", err)
			continue
		}

		// ── Decrypt encrypted envelope ─────────────────────────────────
		if authenticated && session.Cipher != nil && strVal(msg, "type") == "encrypted" {
			plaintext, err := session.Cipher.DecryptJSON(strVal(msg, "iv"), strVal(msg, "data"))
			if err != nil {
				logger.Log.Warn("transfer.handler.go", "Failed to decrypt JSON frame", "error", err)
				continue
			}
			if err := json.Unmarshal([]byte(plaintext), &msg); err != nil {
				logger.Log.Warn("transfer.handler.go", "Decrypted payload is not valid JSON", "error", err)
				continue
			}
		}

		// ── First message must be auth ─────────────────────────────────
		if !authenticated {
			if strVal(msg, "type") != "auth" {
				logger.Log.Warn("transfer.handler.go", "First WS message was not auth",
					"type", strVal(msg, "type"), "clientIP", clientIP)
				_ = conn.WriteControl(websocket.CloseMessage,
					websocket.FormatCloseMessage(4401, "Unauthorized"),
					time.Now().Add(time.Second))
				break
			}
			if !auth.ValidateToken(strVal(msg, "token")) {
				logger.Log.Warn("transfer.handler.go", "WS auth failed — invalid token",
					"clientIP", clientIP)
				_ = conn.WriteControl(websocket.CloseMessage,
					websocket.FormatCloseMessage(4401, "Token inválido"),
					time.Now().Add(time.Second))
				break
			}
			authenticated = true
			logger.Log.Debug("transfer.handler.go", "WS client authenticated", "clientIP", clientIP)
			writeRawJSON(conn, map[string]string{"type": "auth_ok"})
			continue
		}

		// ── Key exchange ──────────────────────────────────────────────
		if strVal(msg, "type") == "key-exchange" {
			serverPubKey, err := session.HandleKeyExchange(strVal(msg, "publicKey"))
			if err != nil {
				logger.Log.Warn("transfer.handler.go", "Key exchange failed", "error", err)
				writeRawJSON(conn, map[string]any{"type": "key-exchange-error", "reason": err.Error()})
				continue
			}
			// Attach cipher to client if already registered; otherwise it will be
			// set on the next hello (clients always do key-exchange before hello).
			if client != nil {
				client.Cipher = session.Cipher
			}
			writeRawJSON(conn, map[string]any{"type": "key-exchange", "publicKey": serverPubKey})
			logger.Log.Debug("transfer.handler.go", "Key exchange complete", "clientIP", clientIP)
			continue
		}

		// ── Signaling protocol ────────────────────────────────────────
		switch strVal(msg, "type") {

		case "hello":
			appName    := strVal(msg, "appName")
			if appName == "" {
				appName = "Unknown"
			}
			deviceType := "desktop"
			if strVal(msg, "deviceType") == "mobile" {
				deviceType = "mobile"
			}
			client = &Client{
				WS:         conn,
				ClientID:   clientID,
				AppName:    appName,
				IP:         clientIP,
				DeviceType: deviceType,
				IsServer:   boolVal(msg, "isServer"),
				Cipher:     session.Cipher, // nil if key-exchange hasn't happened yet
			}
			Default.Add(clientID, client)
			logger.Log.Info("transfer.handler.go", "Client registered",
				"clientId", clientID, "appName", appName,
				"ip", clientIP, "deviceType", deviceType, "isServer", client.IsServer)
			client.SendJSON(map[string]any{"type": "welcome", "clientId": clientID})
			Default.BroadcastClients()

		case "set-receiving":
			if client == nil {
				continue
			}
			client.Receiving = boolVal(msg, "receiving")
			Default.BroadcastClients()

		case "rename":
			if client == nil {
				continue
			}
			if newName := strings.TrimSpace(strVal(msg, "newName")); newName != "" {
				client.AppName = newName
				Default.BroadcastClients()
			}

		case "send-request":
			if client == nil {
				continue
			}
			to         := strVal(msg, "to")
			transferID := strVal(msg, "transferId")
			fileName   := strVal(msg, "fileName")
			fileSize   := int64Val(msg, "fileSize")
			mimeType   := strVal(msg, "mimeType")

			receiver := Default.Get(to)
			if receiver == nil {
				logger.Log.Warn("transfer.handler.go", "Transfer target offline",
					"transferId", transferID, "to", to, "fileName", fileName)
				client.SendJSON(map[string]any{
					"type": "send-reject", "transferId": transferID, "reason": "offline",
				})
				continue
			}
			logger.Log.Info("transfer.handler.go", "Transfer request relayed",
				"transferId", transferID, "from", client.AppName,
				"to", receiver.AppName, "fileName", fileName, "fileSize", fileSize)
			Default.AddTransfer(transferID, &TransferSession{
				TransferID:       transferID,
				SenderClientID:   clientID,
				ReceiverClientID: to,
				FileName:         fileName,
				FileSize:         fileSize,
				MimeType:         mimeType,
			})
			receiver.SendJSON(map[string]any{
				"type":       "send-request",
				"from":       clientID,
				"fromName":   client.AppName,
				"fileName":   fileName,
				"fileSize":   fileSize,
				"mimeType":   mimeType,
				"transferId": transferID,
			})

		case "send-accept":
			if client == nil {
				continue
			}
			transferID := strVal(msg, "transferId")
			t := Default.GetTransfer(transferID)
			if t == nil || t.ReceiverClientID != clientID {
				continue
			}
			logger.Log.Info("transfer.handler.go", "Transfer accepted",
				"transferId", transferID, "receiver", client.AppName)
			if sender := Default.Get(t.SenderClientID); sender != nil {
				sender.SendJSON(map[string]any{"type": "send-accept", "transferId": transferID})
			}

		case "send-reject":
			if client == nil {
				continue
			}
			transferID := strVal(msg, "transferId")
			t := Default.GetTransfer(transferID)
			if t == nil || t.ReceiverClientID != clientID {
				continue
			}
			logger.Log.Info("transfer.handler.go", "Transfer rejected",
				"transferId", transferID, "receiver", client.AppName)
			if sender := Default.Get(t.SenderClientID); sender != nil {
				sender.SendJSON(map[string]any{"type": "send-reject", "transferId": transferID})
			}
			Default.RemoveTransfer(transferID)

		case "send-cancel":
			if client == nil {
				continue
			}
			transferID := strVal(msg, "transferId")
			t := Default.GetTransfer(transferID)
			if t == nil {
				continue
			}
			logger.Log.Info("transfer.handler.go", "Transfer cancelled",
				"transferId", transferID, "by", client.AppName)
			otherID := t.ReceiverClientID
			if t.SenderClientID != clientID {
				otherID = t.SenderClientID
			}
			if other := Default.Get(otherID); other != nil {
				other.SendJSON(map[string]any{"type": "send-cancel", "transferId": transferID})
			}
			Default.RemoveTransfer(transferID)

		case "send-complete":
			if client == nil {
				continue
			}
			transferID := strVal(msg, "transferId")
			t := Default.GetTransfer(transferID)
			if t == nil || t.SenderClientID != clientID {
				continue
			}
			logger.Log.Info("transfer.handler.go", "Transfer complete",
				"transferId", transferID, "fileName", t.FileName, "fileSize", t.FileSize)
			if receiver := Default.Get(t.ReceiverClientID); receiver != nil {
				receiver.SendJSON(map[string]any{"type": "send-complete", "transferId": transferID})
			}
			Default.RemoveTransfer(transferID)
		}
	}

	// ── Cleanup ───────────────────────────────────────────────────────
	if client != nil {
		logger.Log.Info("transfer.handler.go", "Client disconnected",
			"clientId", clientID, "appName", client.AppName)
		Default.Remove(clientID)
		Default.BroadcastClients()
	} else {
		logger.Log.Debug("transfer.handler.go", "Unauthenticated WS connection closed",
			"clientIP", clientIP)
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// writeRawJSON writes directly to conn without the writeMu.
// Only safe to call before the client is registered in the registry
// (no concurrent writers possible at that point).
func writeRawJSON(conn *websocket.Conn, msg any) {
	data, _ := json.Marshal(msg)
	_ = conn.WriteMessage(websocket.TextMessage, data)
}

func extractIP(r *http.Request) string {
	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	ip = strings.TrimPrefix(ip, "::ffff:")
	if ip == "127.0.0.1" || ip == "::1" || ip == "" {
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

func newUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40 // Version 4
	b[8] = (b[8] & 0x3f) | 0x80 // Variant 10
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
