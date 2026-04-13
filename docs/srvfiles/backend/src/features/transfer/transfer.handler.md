# transfer/handler.go

**Archivo:** `internal/transfer/handler.go`
**Rol:** Handler WebSocket principal. Gestiona autenticación a nivel de protocolo WS, key-exchange E2E, relay de señalización P2P y relay de chunks binarios cifrados. Equivalente a `transfer.handler.ts`.

---

## `HandleConnection`

```go
func HandleConnection(w http.ResponseWriter, r *http.Request) {
    conn, _ := upgrader.Upgrade(w, r, nil)
    defer conn.Close()

    clientID      := newUUID()
    session       := &WsSession{}
    var client    *Client
    authenticated := false

    for {
        msgType, data, err := conn.ReadMessage()
        if err != nil { break }
        // ... procesar frame
    }

    // cleanup al desconectar
    if client != nil {
        Default.Remove(clientID)
        Default.BroadcastClients()
    }
}
```

Cada conexión WebSocket corre en su propia goroutine (lanzada por `net/http`). El bucle `for { ReadMessage() }` bloquea hasta recibir un frame o error de red.

---

## Upgrader

```go
var upgrader = websocket.Upgrader{
    CheckOrigin:     func(r *http.Request) bool { return true },
    ReadBufferSize:  256 * 1024,
    WriteBufferSize: 256 * 1024,
}
```

`CheckOrigin: true` permite cualquier origen (mismo comportamiento que `cors({ origin: '*' })` en Express). Los buffers de 256 KB coinciden con el tamaño de chunk P2P.

---

## Flujo de autenticación

El primer mensaje **debe** ser de tipo `auth`. Cualquier otro tipo cierra la conexión con código `4401`.

```
cliente → { type: "auth", token: "..." }
servidor → { type: "auth_ok" }          // si el token es válido
servidor → WS Close 4401                // si el token es inválido
```

`writeRawJSON` escribe directamente a `conn` sin `writeMu` porque en este punto no hay escrituras concurrentes posibles (el cliente aún no está registrado en el registry).

---

## Key-exchange E2E

```
cliente → { type: "key-exchange", publicKey: "<base64>" }
servidor → { type: "key-exchange", publicKey: "<base64>" }
```

`session.HandleKeyExchange(strVal(msg, "publicKey"))` realiza el ECDH y guarda el cipher derivado en `session.Cipher`. Si el cliente ya envió `hello`, se asigna también a `client.Cipher`. Después del key-exchange, `SendJSON` cifra automáticamente todos los mensajes salientes.

---

## Descifrado de frames entrantes

```go
if authenticated && session.Cipher != nil && strVal(msg, "type") == "encrypted" {
    plaintext, _ := session.Cipher.DecryptJSON(strVal(msg, "iv"), strVal(msg, "data"))
    json.Unmarshal([]byte(plaintext), &msg)
}
```

Antes del `switch` de señalización, si el frame está cifrado, se descifra y se reemplaza `msg` con el contenido en claro. El resto del código de señalización no necesita saber si el mensaje venía cifrado o no.

---

## Protocolo de señalización (mensajes JSON)

| Tipo | Dirección | Descripción |
| :--- | :--- | :--- |
| `hello` | cliente → servidor | Registra el cliente: `appName`, `deviceType`, `isServer` |
| `welcome` | servidor → cliente | Confirma registro, devuelve `clientId` |
| `clients` | servidor → todos | Lista completa de clientes conectados (broadcast) |
| `set-receiving` | cliente → servidor | Marca/desmarca al cliente como receptor disponible |
| `rename` | cliente → servidor | Cambia el `appName` del cliente |
| `send-request` | cliente → servidor | Inicia una transferencia: `to`, `fileName`, `fileSize`, `mimeType` |
| `send-accept` | receptor → servidor | Acepta la transferencia |
| `send-reject` | receptor → servidor | Rechaza la transferencia |
| `send-cancel` | cualquiera → servidor | Cancela la transferencia en curso |
| `send-complete` | emisor → servidor | Señaliza que todos los chunks se enviaron |
| `files-changed` | servidor → todos | Notifica que la lista de archivos cambió |

---

## Relay de chunks binarios

```go
// Frame: [36 bytes ASCII transferId] + [chunk data]
payload := data
if session.Cipher != nil {
    payload, _ = session.Cipher.DecryptBinary(data)
}

transferID := strings.TrimRight(string(payload[:36]), " \x00")
t          := Default.GetTransfer(transferID)
receiver   := Default.Get(t.ReceiverClientID)

if receiver.Cipher != nil {
    encrypted, _ := receiver.Cipher.EncryptBinary(payload)
    receiver.SendBinary(encrypted)
} else {
    receiver.SendBinary(payload)
}
```

El servidor actúa como relay transparente:
1. Descifra el chunk si el emisor tiene E2E activo.
2. Extrae el `transferId` de los primeros 36 bytes para enrutar al receptor.
3. Re-cifra el chunk con la clave de sesión del receptor si este tiene E2E activo.
4. Envía el chunk al receptor.

Esto permite que emisor y receptor tengan claves de sesión independientes (negociadas por separado con el servidor).

---

## Helpers

```go
func newUUID() string // UUID v4 con crypto/rand (sin dependencias externas)
func extractIP(r *http.Request) string // normaliza IPv4-mapped, fallback a LAN IP para loopback
func strVal(m map[string]any, key string) string
func boolVal(m map[string]any, key string) bool
func int64Val(m map[string]any, key string) int64
```

`int64Val` convierte `float64` (tipo por defecto de `json.Unmarshal` para números) a `int64`, necesario para `fileSize` que puede superar `2^31`.
