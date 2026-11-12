# e2e.ts

**Archivo:** `frontend/src/lib/e2e.ts`
**Rol:** Cifrado de extremo a extremo de cada transferencia.

---

- `isE2EAvailable()`, `createE2EKeyPair()` → `{privateKey, publicKey}` (base64 de 65 bytes), `formatSas("123456")` → `"123 456"`.
- `E2ESession.derive(own, peer, senderPub, receiverPub, transferId)`: HKDF-SHA-256 (salt = `transferId`, info = `srvfiles-e2e-v1` ‖ claves) → clave AES-256-GCM + código de 6 dígitos.
- `encryptChunk(i, data)` / `decryptChunk(i, data)`: nonce con el índice, AAD = `transferId`.
- `encryptFinal(chunks, size, name)` / `decryptFinal(chunks, b64)`: marcador final (AAD = `transferId|end`).

Verificado con `docs/e2e-test-vectors.json` en `e2e.test.ts`.
