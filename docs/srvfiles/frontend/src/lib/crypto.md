# crypto.ts

**File:** `src/lib/crypto.ts`
**Purpose:** ECDH P-256 + HKDF-SHA-256 + AES-256-GCM session cipher used by the frontend WebSocket to encrypt and decrypt messages end-to-end. Only available in secure contexts (HTTPS or localhost).

---

## Exports

### `isCryptoAvailable(): boolean`

Checks whether `crypto.subtle.generateKey` is available in the current context. Must be called before using any other export — returns `false` in plain HTTP LAN contexts where `crypto.subtle` is absent.

### `class SessionCipher`

Wraps a derived AES-256-GCM `CryptoKey` and exposes four methods:

| Method | Signature | Description |
|---|---|---|
| `encryptJson` | `(plaintext: string) => Promise<{ iv: string; data: string }>` | Encrypts a JSON string; returns Base64-encoded IV and ciphertext. |
| `decryptJson` | `(iv: string, data: string) => Promise<string>` | Decrypts a Base64-encoded `{ iv, data }` pair; returns the plaintext string. |
| `encryptBinary` | `(payload: Uint8Array) => Promise<Uint8Array>` | Encrypts raw bytes; prepends the 12-byte IV to the output (`[12 bytes IV][ciphertext]`). |
| `decryptBinary` | `(data: Uint8Array) => Promise<Uint8Array>` | Decrypts a binary buffer that starts with a 12-byte IV prefix. |

### `generateEcdhKeyPair(): Promise<CryptoKeyPair>`

Generates an ephemeral ECDH P-256 key pair with `deriveKey` and `deriveBits` usages.

### `exportPublicKey(key: CryptoKey): Promise<string>`

Exports a public `CryptoKey` to raw format and returns it as a Base64 string suitable for transmission over the WebSocket.

### `deriveCipher(privateKey: CryptoKey, peerPublicKeyB64: string): Promise<SessionCipher>`

Performs the full ECDH + HKDF derivation:
1. Imports the peer's public key from Base64.
2. Derives 256 bits of shared secret via ECDH.
3. Runs HKDF-SHA-256 with `info = "srvfiles-ws-v1"` and an empty salt to produce a 256-bit AES-GCM key.
4. Returns a `SessionCipher` wrapping the derived key.

---

## Key behaviors

- **Context guard:** `isCryptoAvailable()` must return `true` before calling any other export. In plain HTTP contexts (non-localhost LAN access) `crypto.subtle` is unavailable and the cipher is skipped entirely — the WebSocket falls back to unencrypted transport.
- **IV uniqueness:** Every `encryptJson` and `encryptBinary` call generates a fresh 12-byte random IV via `crypto.getRandomValues`, so no two ciphertexts share an IV under the same key.
- **Binary format:** `encryptBinary` outputs `[12 bytes IV][ciphertext]`. `decryptBinary` expects the same layout, slicing `data.subarray(0, 12)` for the IV and `data.subarray(12)` for the ciphertext.
- **HKDF info string:** `"srvfiles-ws-v1"` (UTF-8 encoded) is used as the HKDF context label, binding derived keys to this application version.
- **No key extraction:** Both the ECDH private key and the derived AES key are created with `extractable: false`, preventing export from the browser's key store.
