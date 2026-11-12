# crypto.ts

**Archivo:** `frontend/src/lib/crypto.ts`
**Rol:** Cifrado del canal WebSocket (ECDH P-256 + HKDF + AES-256-GCM).

---

`isCryptoAvailable()` (requiere contexto seguro), `generateEcdhKeyPair`, `exportPublicKey`, `deriveCipher(privateKey, peerB64)` (info `srvfiles-ws-v1`), `SessionCipher` (`encryptJson`/`decryptJson`, `encryptBinary`/`decryptBinary`).
