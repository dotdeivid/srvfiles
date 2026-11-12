# transfer/session.go

**Archivo:** `backend/internal/transfer/session.go`
**Rol:** Cifrado del canal WebSocket (servidor ↔ cliente).

---

- `WsSession.HandleKeyExchange(pubKeyB64)`: ECDH P-256 con clave efímera del servidor → HKDF-SHA-256 (info `srvfiles-ws-v1`) → clave AES-256-GCM. Devuelve la clave pública del servidor.
- `SessionCipher`: `EncryptJSON`/`DecryptJSON` (IV + ciphertext en base64) y `EncryptBinary`/`DecryptBinary` (`[IV 12][ciphertext‖tag]`).

Esta capa protege la señalización. El contenido de los archivos va además cifrado de extremo a extremo entre emisor y receptor (ver `docs/protocol.md`); el algoritmo de referencia en Go está en `e2e_vectors_test.go`.
