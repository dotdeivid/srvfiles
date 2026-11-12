package transfer

import (
	"encoding/json"
	"sort"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"srvfiles/internal/logger"
)

// ─── Timing / limits ──────────────────────────────────────────────────────────

const (
	writeWait  = 10 * time.Second // máximo para escribir un frame
	pongWait   = 60 * time.Second // sin pong en este plazo se da por muerta la conexión
	pingPeriod = 25 * time.Second
	authWait   = 10 * time.Second // plazo para mandar el mensaje auth

	sendQueueSize = 512 // frames pendientes por cliente antes de desconectarlo
)

// ─── Client ───────────────────────────────────────────────────────────────────

type outbound struct {
	kind int // websocket.TextMessage | websocket.BinaryMessage
	data []byte
}

// Client represents a connected WebSocket peer.
//
// Todas las escrituras pasan por una cola con una goroutine escritora, así
// un cliente lento o colgado no bloquea los broadcasts a los demás, y nunca
// hay dos escrituras concurrentes sobre el socket (gorilla no lo admite).
type Client struct {
	conn     *websocket.Conn
	ClientID string
	IP       string

	send      chan outbound
	closeOnce sync.Once
	done      chan struct{}

	mu         sync.Mutex // protege los campos de abajo
	registered bool
	appName    string
	receiving  bool
	deviceType string
	isServer   bool
	e2e        bool // soporta cifrado de extremo a extremo (protocolo v2)
	serverPort int
	cipher     *SessionCipher
}

func newClient(conn *websocket.Conn, id, ip string) *Client {
	c := &Client{
		conn:     conn,
		ClientID: id,
		IP:       ip,
		send:     make(chan outbound, sendQueueSize),
		done:     make(chan struct{}),
	}
	go c.writeLoop()
	return c
}

// writeLoop serializa las escrituras y manda pings periódicos.
func (c *Client) writeLoop() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()
	for {
		select {
		case msg := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(msg.kind, msg.data); err != nil {
				c.Close()
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				c.Close()
				return
			}
		case <-c.done:
			return
		}
	}
}

// enqueue adds a frame to the client's queue. Si la cola está llena el
// cliente no está leyendo: se lo desconecta en lugar de bloquear al resto.
func (c *Client) enqueue(kind int, data []byte) {
	select {
	case <-c.done:
		return
	default:
	}
	select {
	case c.send <- outbound{kind: kind, data: data}:
	case <-c.done:
	default:
		logger.Log.Warn("transfer.registry.go", "Client send queue full — disconnecting", "clientId", c.ClientID)
		c.Close()
	}
}

// Close stops the writer and closes the socket (idempotent).
func (c *Client) Close() {
	c.closeOnce.Do(func() { close(c.done) })
}

// closeWithCode sends a close frame directly and closes the connection.
func (c *Client) closeWithCode(code int, reason string) {
	_ = c.conn.WriteControl(websocket.CloseMessage,
		websocket.FormatCloseMessage(code, reason), time.Now().Add(time.Second))
	c.Close()
}

// SendRaw sends JSON in plaintext. Solo para auth_ok y la respuesta del
// intercambio de claves, antes de que el cliente tenga la clave.
func (c *Client) SendRaw(msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	c.enqueue(websocket.TextMessage, data)
}

// SendJSON serializes msg and sends it, encrypted if the session has a cipher.
// Con cifrado activo, un error de cifrado descarta el mensaje: nunca se cae
// a texto plano.
func (c *Client) SendJSON(msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	cipher := c.Cipher()
	if cipher != nil {
		iv, encrypted, err := cipher.EncryptJSON(string(data))
		if err != nil {
			logger.Log.Error("transfer.registry.go", "Failed to encrypt message — dropped", "error", err)
			return
		}
		data, _ = json.Marshal(map[string]string{"type": "encrypted", "iv": iv, "data": encrypted})
	}
	c.enqueue(websocket.TextMessage, data)
}

// SendBinary queues a binary frame (already encrypted if needed).
func (c *Client) SendBinary(data []byte) {
	c.enqueue(websocket.BinaryMessage, data)
}

func (c *Client) Cipher() *SessionCipher {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.cipher
}

func (c *Client) setCipher(cipher *SessionCipher) {
	c.mu.Lock()
	c.cipher = cipher
	c.mu.Unlock()
}

func (c *Client) AppName() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.appName
}

func (c *Client) snapshot() map[string]any {
	c.mu.Lock()
	defer c.mu.Unlock()
	return map[string]any{
		"clientId":   c.ClientID,
		"appName":    c.appName,
		"ip":         c.IP,
		"deviceType": c.deviceType,
		"isServer":   c.isServer,
		"serverPort": c.serverPort,
		"receiving":  c.receiving,
		"e2e":        c.e2e,
	}
}

// ─── TransferSession ─────────────────────────────────────────────────────────

// TransferSession tracks an in-flight P2P file transfer.
type TransferSession struct {
	TransferID       string
	SenderClientID   string
	ReceiverClientID string
	FileName         string
	FileSize         int64
	MimeType         string
	Accepted         bool // hasta que el receptor acepta no se reenvían chunks
	KeySent          bool // el receptor ya mandó su clave pública E2E
}

// ─── Registry ─────────────────────────────────────────────────────────────────

// Registry is the thread-safe store for connected clients and active transfers.
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

func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients)
}

// ─── Transfer operations ──────────────────────────────────────────────────────

// AddTransfer registers a transfer; returns false if the id is already in use.
func (r *Registry) AddTransfer(t *TransferSession) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.transfers[t.TransferID]; exists {
		return false
	}
	r.transfers[t.TransferID] = t
	return true
}

// GetTransfer returns a copy of the transfer (nil if unknown).
func (r *Registry) GetTransfer(id string) *TransferSession {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.transfers[id]
	if !ok {
		return nil
	}
	cp := *t
	return &cp
}

// AcceptTransfer marks a transfer as accepted by its receiver.
func (r *Registry) AcceptTransfer(id, receiverID string) *TransferSession {
	r.mu.Lock()
	defer r.mu.Unlock()
	t, ok := r.transfers[id]
	if !ok || t.ReceiverClientID != receiverID || !t.KeySent {
		return nil
	}
	t.Accepted = true
	cp := *t
	return &cp
}

// MarkKeySent records the receiver's E2E key; returns the transfer only the
// first time and only for its receiver.
func (r *Registry) MarkKeySent(id, receiverID string) *TransferSession {
	r.mu.Lock()
	defer r.mu.Unlock()
	t, ok := r.transfers[id]
	if !ok || t.ReceiverClientID != receiverID || t.KeySent {
		return nil
	}
	t.KeySent = true
	cp := *t
	return &cp
}

func (r *Registry) RemoveTransfer(id string) {
	r.mu.Lock()
	delete(r.transfers, id)
	r.mu.Unlock()
}

// TakeTransfersOf removes and returns every transfer where clientID takes part.
func (r *Registry) TakeTransfersOf(clientID string) []TransferSession {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []TransferSession
	for id, t := range r.transfers {
		if t.SenderClientID == clientID || t.ReceiverClientID == clientID {
			out = append(out, *t)
			delete(r.transfers, id)
		}
	}
	return out
}

// ─── Broadcasts ───────────────────────────────────────────────────────────────

func (r *Registry) all() []*Client {
	r.mu.RLock()
	defer r.mu.RUnlock()
	all := make([]*Client, 0, len(r.clients))
	for _, c := range r.clients {
		all = append(all, c)
	}
	return all
}

// BroadcastClients sends the full client list to every connected client.
// Las escrituras son a colas, así que nunca bloquea.
func (r *Registry) BroadcastClients() {
	all := r.all()
	list := make([]map[string]any, 0, len(all))
	for _, c := range all {
		list = append(list, c.snapshot())
	}
	sort.Slice(list, func(i, j int) bool { return list[i]["clientId"].(string) < list[j]["clientId"].(string) })
	msg := map[string]any{"type": "clients", "clients": list}
	for _, c := range all {
		c.SendJSON(msg)
	}
}

// BroadcastFilesChanged notifies all clients that the file list has changed.
func (r *Registry) BroadcastFilesChanged() {
	msg := map[string]string{"type": "files-changed"}
	for _, c := range r.all() {
		c.SendJSON(msg)
	}
}
