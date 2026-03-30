# useTransfer.ts

**File:** `src/features/transfer/useTransfer.ts`
**Purpose:** React hook that manages the WebSocket connection and all state for direct peer-to-peer file transfers. Handles connection lifecycle, incoming/outgoing transfer requests, file chunking, and receive-buffer assembly.

---

## Exports

### `useTransfer(...)`

**Signature:**
```ts
function useTransfer(
  serverUrl: string,
  appName: string,
  onFileReceived: (fileName: string, mimeType: string, blob: Blob) => void,
  onSendRejected?: () => void,
  authenticated?: boolean,
  onFilesChanged?: () => void,
): UseTransferReturn
```

**Return type includes:**
- `myClientId: string | null`
- `onlineClients: TransferClient[]`
- `incomingRequest: IncomingTransferRequest | null`
- `activeTransfer: ActiveTransfer | null`
- `sendFileTo(toClientId, file, peerName): void`
- `acceptTransfer(): void`
- `rejectTransfer(): void`
- `cancelTransfer(): void`
- `rename(newName): void`

### `ActiveTransfer`

```ts
interface ActiveTransfer {
  transferId: string;
  fileName: string;
  fileSize: number;
  progress: number;
  direction: 'sending' | 'receiving';
  peerName: string;
  peerId: string;
  waiting: boolean;   // true while sender awaits accept/reject from peer
}
```

---

## Key behaviors

### Connection lifecycle

The WebSocket connection is (re-)created whenever `serverUrl` or `authenticated` changes. `appName` is intentionally excluded from the dependency array and read via a ref so that renaming the device does not restart the connection.

On `ws.onopen`: sends `auth(token)` if a token is present.
On `auth_ok`: calls `conn.register(appNameRef.current, isTauriApp())` and `conn.setReceiving(true)`.

Callback props (`onFileReceived`, `onSendRejected`, `onFilesChanged`) are also stored in refs so they can be updated without triggering a reconnect.

### Receive buffer

Binary frames are routed to `receiveBuffers` (a `Map<transferId, buffer>`). Each buffer accumulates chunks with a running `received` byte counter. On `send-complete`, the chunks are assembled into a `Blob` and `onFileReceived` is called. Progress percentage is computed from `received / total`.

### `sendFileTo`

Generates a UUID (with a fallback for HTTP contexts where `crypto.randomUUID` is unavailable), sets `activeTransfer` with `waiting: true`, stores the pending send in `pendingSendRef`, and sends a `send-request` message to the relay.

### `acceptTransfer`

Initializes a receive buffer for the transfer, sets `activeTransfer` with `direction: "receiving"`, and sends `send-accept`. Clears `incomingRequest`.

### `cancelTransfer`

Sends `send-cancel`, clears the receive buffer, clears `pendingSendRef`, and sets `activeTransfer` to `null`.

### `rename`

Updates `appNameRef` and sends `{ type: "rename", newName }` over the existing connection without reconnecting.

### `files-changed` event

When the relay sends `{ type: "files-changed" }`, `onFilesChangedRef.current()` is called. `App.tsx` wires this to `fetchFiles` + `fetchStats` so the file list refreshes automatically after another device uploads a file.
