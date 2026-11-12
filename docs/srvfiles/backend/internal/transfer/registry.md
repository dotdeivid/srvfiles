# transfer/registry.go

**Archivo:** `backend/internal/transfer/registry.go`
**Rol:** Clientes conectados y transferencias activas.

---

## `Client`

- Cada cliente tiene una **cola de salida** (512 frames) y una goroutine escritora (`writeLoop`) que además manda un ping cada 25 s con plazo de escritura de 10 s. Un cliente lento no bloquea los broadcasts a los demás y nunca hay dos escrituras concurrentes sobre el socket; si la cola se llena, se lo desconecta.
- `SendJSON` cifra con la clave del canal si existe (si el cifrado falla, descarta el mensaje: nunca cae a texto plano). `SendRaw` solo para `auth_ok` y la respuesta del intercambio de claves.
- Campos mutables (`appName`, `receiving`, `cipher`, `e2e`, …) protegidos por mutex.

## `TransferSession`

`TransferID`, emisor, receptor, nombre, tamaño, tipo, `KeySent` (el receptor mandó su clave E2E) y `Accepted`.

## `Registry`

Mapas protegidos por `RWMutex`. `AddTransfer` falla si el id existe; `MarkKeySent` y `AcceptTransfer` validan que quien llama sea el receptor; `TakeTransfersOf` saca las transferencias de un cliente al desconectarse. `BroadcastClients` (lista ordenada, incluye `e2e` y `serverPort`) y `BroadcastFilesChanged`.
