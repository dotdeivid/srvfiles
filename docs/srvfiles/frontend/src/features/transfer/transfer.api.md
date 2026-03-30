# transfer.api.ts

**File:** `src/features/transfer/transfer.api.ts`
**Purpose:** WebSocket client class and types for peer-to-peer file transfers via the server relay. Implements the full transfer signalling protocol with optional E2E encryption (ECDH P-256 + HKDF + AES-256-GCM).

---

## Exports

### Interfaces

```ts
interface TransferClient {
  clientId: string;
  appName: string;
  receiving: boolean;
  ip: string;
  deviceType: 'mobile' | 'desktop';
  isServer: boolean;    // true for Tauri server instances
}

interface IncomingTransferRequest {
  transferId: string;
  from: string;         // clientId of the sender
  fromName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}
```

### `ServerMessage` (discriminated union)

Covers all message types received from the relay:
`auth_ok`, `encrypted`, `key-exchange`, `welcome`, `clients`, `send-request`, `send-accept`, `send-reject`, `send-cancel`, `send-complete`, `files-changed`.

### `class TransferConnection`

Manages a single WebSocket connection to the relay server.

**Constructor:** `new TransferConnection(serverUrl: string)`
Converts the HTTP URL to a WebSocket URL (`http → ws`) and appends `/ws`. Sets `binaryType = "arraybuffer"`.

**Public methods:**

| Method | Description |
|---|---|
| `getClientId()` | Returns the assigned `clientId` received in the `welcome` message, or `null` before it arrives. |
| `on(type, handler)` | Registers a typed message handler. Returns `this` for chaining. |
| `onBinary(handler)` | Registers a handler for raw binary frames (file chunks). Multiple handlers are supported. |
| `auth(token)` | Sends `{ type: "auth", token }` as a raw (unencrypted) frame. |
| `register(appName, isServer?)` | Sends `{ type: "hello", appName, deviceType: "desktop", isServer }`. |
| `setReceiving(receiving)` | Sends `{ type: "set-receiving", receiving }`. |
| `sendRequest(to, file, transferId)` | Sends a `send-request` with file metadata to the specified client. |
| `accept(transferId)` | Sends `send-accept`. |
| `reject(transferId)` | Sends `send-reject`. |
| `cancel(transferId)` | Sends `send-cancel`. |
| `rename(newName)` | Sends `{ type: "rename", newName }` to update display name on the relay. |
| `sendFile(transferId, file, onProgress?)` | Chunks the file into 256 KB frames prefixed with the 36-byte `transferId`, sends each frame (encrypted if cipher is active), then sends `send-complete`. |
| `close()` | Closes the WebSocket. |

### `getTransferWsUrl(serverUrl?: string): string`

Utility that converts a server HTTP URL to its `/ws` WebSocket endpoint. Falls back to `getApiUrl()` if no URL is provided.

---

## Key behaviors

### Encryption flow (E2E, ECDH P-256 + AES-256-GCM)

1. On `auth_ok`, `_doKeyExchange()` is called automatically before the external `auth_ok` handler fires.
2. The client generates an ephemeral ECDH key pair, exports the public key as Base64, and sends `{ type: "key-exchange", publicKey }` as a plaintext frame.
3. The relay responds with its own `{ type: "key-exchange", publicKey }`. `_keyExchangeResolve` resolves the pending Promise.
4. `deriveCipher(privateKey, serverPubKeyB64)` produces a `SessionCipher`; all subsequent JSON messages are encrypted via `{ type: "encrypted", iv, data }` wrappers.
5. Incoming `encrypted` frames are decrypted before routing to handlers. Incoming binary frames are decrypted with `SessionCipher.decryptBinary` (IV prepended).

If `isCryptoAvailable()` returns `false` (HTTP context), key exchange is skipped and all traffic is unencrypted.

### Send queue

Encrypted JSON sends are serialized through `_sendQueue` (a `Promise` chain) to preserve message ordering despite the async encryption step.

### Binary frame format

```
[ 36 bytes: transferId (UTF-8, space-padded) ][ N bytes: file chunk ]
```

The receiver uses the first 36 bytes to look up the correct receive buffer.

### Chunk size

`CHUNK_SIZE = 256 * 1024` (256 KB). A `setTimeout(r, 0)` yield after each chunk prevents the event loop from blocking during large file sends.
