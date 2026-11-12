# transfer.api.ts

**Archivo:** `frontend/src/features/transfer/transfer.api.ts`
**Rol:** Conexión WebSocket con el relay y envío de archivos. Ver `docs/protocol.md`.

---

## Tipos

`TransferClient` (incluye `e2e`), `IncomingTransferRequest` (incluye `senderPublicKey`), mensajes del protocolo, `TransferAbortedError`, `CancelToken`.

## `TransferConnection`

- Cola de mensajes entrantes: se procesan en orden (descifrar es asíncrono).
- Intercambio de claves del canal con timeout de 5 s; sin respuesta sigue sin cifrar el canal.
- `register(appName, …)` manda `hello` con `e2e: 1`.
- `sendRequest(to, file, transferId, e2ePublicKey)`, `sendKey(transferId, publicKey)`, `accept`, `reject`, `cancel`, `setReceiving`, `rename`.
- `sendFile(transferId, file, e2e, onProgress?, cancel?)`: chunks de 256 KB cifrados con `E2ESession.encryptChunk(i, …)`, prefijo de 36 bytes con el `transferId`, capa del canal encima; espera cuando `bufferedAmount` supera el umbral (contrapresión). Al final manda `send-complete` con `e2e.final`.
