# transfer/registry.go

**Archivo:** `internal/transfer/registry.go`
**Rol:** Registro thread-safe de clientes WebSocket conectados y sesiones de transferencia activas. Centraliza las operaciones de estado compartido del relay P2P. Equivalente a `client-registry.ts`.

---

## `Client`

```go
type Client struct {
    WS         *websocket.Conn
    writeMu    sync.Mutex
    ClientID   string
    AppName    string
    Receiving  bool
    IP         string
    DeviceType string       // "mobile" | "desktop"
    IsServer   bool
    Cipher     *SessionCipher // nil hasta que se complete el key-exchange
}
```

`writeMu` es el mutex por cliente que serializa las escrituras al WebSocket. gorilla/websocket requiere que solo una goroutine escriba a la vez; sin `writeMu`, llamadas concurrentes a `SendJSON` o `SendBinary` desde goroutines diferentes causarían data races.

### `SendJSON`

```go
func (c *Client) SendJSON(msg any) {
    data, _ := json.Marshal(msg)

    var payload []byte
    if c.Cipher != nil {
        iv, encrypted, err := c.Cipher.EncryptJSON(string(data))
        if err == nil {
            envelope, _ := json.Marshal(map[string]string{
                "type": "encrypted", "iv": iv, "data": encrypted,
            })
            payload = envelope
        } else {
            payload = data
        }
    } else {
        payload = data
    }

    c.writeMu.Lock()
    defer c.writeMu.Unlock()
    _ = c.WS.WriteMessage(websocket.TextMessage, payload)
}
```

Si `c.Cipher != nil` (key-exchange completado), el mensaje se cifra automáticamente con AES-256-GCM antes de enviarlo. El cliente remoto recibe un frame con `{ type: "encrypted", iv: "...", data: "..." }` que descifra con su propio cipher.

### `SendBinary`

```go
func (c *Client) SendBinary(data []byte) {
    c.writeMu.Lock()
    defer c.writeMu.Unlock()
    _ = c.WS.WriteMessage(websocket.BinaryMessage, data)
}
```

El cifrado de frames binarios se gestiona en `handler.go` (antes de llamar a `SendBinary`) para poder reutilizar el buffer ya cifrado.

---

## `TransferSession`

```go
type TransferSession struct {
    TransferID       string
    SenderClientID   string
    ReceiverClientID string
    FileName         string
    FileSize         int64
    MimeType         string
}
```

Registra el estado de una transferencia en vuelo. Necesario para que los chunks binarios (que solo incluyen el `transferId`) puedan ser enrutados al receptor correcto.

---

## `Registry`

```go
type Registry struct {
    mu        sync.RWMutex
    clients   map[string]*Client
    transfers map[string]*TransferSession
}

var Default = NewRegistry()
```

Un único mutex `sync.RWMutex` protege tanto `clients` como `transfers`. Las lecturas usan `RLock` (múltiples lectores concurrentes), las escrituras `Lock` (exclusivo).

### Patrón snapshot en `BroadcastClients`

```go
func (r *Registry) BroadcastClients() {
    r.mu.RLock()
    list := /* construir lista */
    all  := /* capturar punteros */
    r.mu.RUnlock()
    // aquí ya no hay lock — solo WriteMu por cliente
    for _, c := range all {
        c.SendJSON(msg)
    }
}
```

Se libera el `RLock` **antes** de llamar a `SendJSON`. Si no se hiciera así, la goroutine mantendría `mu.RLock` mientras intenta adquirir `client.writeMu`, y otra goroutine que intente modificar el registry mientras mantiene `mu.Lock` podría causar un deadlock. El snapshot garantiza consistencia sin bloqueo prolongado.
