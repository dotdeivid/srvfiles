package transfer

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

// ─── Client ───────────────────────────────────────────────────────────────────

// Client represents a connected WebSocket peer.
// Equivalent to ConnectedClient in domain/types.ts.
type Client struct {
	WS         *websocket.Conn
	writeMu    sync.Mutex   // gorilla/websocket requires serialized writes
	ClientID   string
	AppName    string
	Receiving  bool
	IP         string
	DeviceType string       // "mobile" | "desktop"
	IsServer   bool
	Cipher     *SessionCipher // nil until Phase 6
}

// SendJSON serializes msg to JSON and sends it as a text frame.
// If c.Cipher is set, the payload is wrapped in an encrypted envelope.
// Thread-safe: uses writeMu to serialize concurrent writes.
func (c *Client) SendJSON(msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	var payload []byte
	if c.Cipher != nil {
		iv, encrypted, err := c.Cipher.EncryptJSON(string(data))
		if err == nil {
			envelope, _ := json.Marshal(map[string]string{
				"type": "encrypted",
				"iv":   iv,
				"data": encrypted,
			})
			payload = envelope
		} else {
			payload = data // fallback: send unencrypted on cipher error
		}
	} else {
		payload = data
	}

	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	_ = c.WS.WriteMessage(websocket.TextMessage, payload)
}

// SendBinary sends a raw binary frame.
// Thread-safe: uses writeMu.
func (c *Client) SendBinary(data []byte) {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	_ = c.WS.WriteMessage(websocket.BinaryMessage, data)
}

// ─── TransferSession ─────────────────────────────────────────────────────────

// TransferSession tracks an in-flight P2P file transfer.
// Equivalent to TransferSession in domain/types.ts.
type TransferSession struct {
	TransferID       string
	SenderClientID   string
	ReceiverClientID string
	FileName         string
	FileSize         int64
	MimeType         string
}

// ─── Registry ─────────────────────────────────────────────────────────────────

// Registry is the thread-safe store for connected clients and active transfers.
// Equivalent to the maps + functions in client-registry.ts.
type Registry struct {
	mu        sync.RWMutex
	clients   map[string]*Client
	transfers map[string]*TransferSession
}

func NewRegistry() *Registry {
	return &Registry{
		clients:   make(map[string]*Client),
		transfers: make(map[string]*TransferSession),
	}
}

// Default is the singleton registry used by the server.
var Default = NewRegistry()

// ─── Client operations ────────────────────────────────────────────────────────

func (r *Registry) Add(id string, c *Client) {
	r.mu.Lock()
	r.clients[id] = c
	r.mu.Unlock()
}

func (r *Registry) Remove(id string) {
	r.mu.Lock()
	delete(r.clients, id)
	r.mu.Unlock()
}

func (r *Registry) Get(id string) *Client {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.clients[id]
}

// ─── Transfer operations ──────────────────────────────────────────────────────

func (r *Registry) AddTransfer(id string, t *TransferSession) {
	r.mu.Lock()
	r.transfers[id] = t
	r.mu.Unlock()
}

func (r *Registry) GetTransfer(id string) *TransferSession {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.transfers[id]
}

func (r *Registry) RemoveTransfer(id string) {
	r.mu.Lock()
	delete(r.transfers, id)
	r.mu.Unlock()
}

// ─── Broadcasts ───────────────────────────────────────────────────────────────

// BroadcastClients sends the full client list to every connected client.
// Equivalent to broadcastClients() in client-registry.ts.
func (r *Registry) BroadcastClients() {
	// Build the list and collect pointers under a single RLock,
	// then release the lock before writing to avoid deadlocking with writeMu.
	r.mu.RLock()
	list := make([]map[string]any, 0, len(r.clients))
	all  := make([]*Client, 0, len(r.clients))
	for _, c := range r.clients {
		list = append(list, map[string]any{
			"clientId":   c.ClientID,
			"appName":    c.AppName,
			"ip":         c.IP,
			"deviceType": c.DeviceType,
			"isServer":   c.IsServer,
			"receiving":  c.Receiving,
		})
		all = append(all, c)
	}
	r.mu.RUnlock()

	msg := map[string]any{"type": "clients", "clients": list}
	for _, c := range all {
		c.SendJSON(msg)
	}
}

// BroadcastFilesChanged notifies all clients that the file list has changed.
// Equivalent to broadcastFilesChanged() in client-registry.ts.
func (r *Registry) BroadcastFilesChanged() {
	r.mu.RLock()
	all := make([]*Client, 0, len(r.clients))
	for _, c := range r.clients {
		all = append(all, c)
	}
	r.mu.RUnlock()

	msg := map[string]string{"type": "files-changed"}
	for _, c := range all {
		c.SendJSON(msg)
	}
}
