# OnlineClients.tsx

**File:** `src/features/transfer/OnlineClients.tsx`
**Purpose:** Renders the list of other connected devices visible on the relay. Each device is shown as a row with its name, IP, transfer progress (if active), and an action area for sending files or switching to a server's file view.

---

## Exports

### `OnlineClients`

**Props:**

```ts
interface OnlineClientsProps {
  clients: TransferClient[];
  myClientId: string | null;
  activeTransfer: ActiveTransfer | null;
  onSendFile: (toClientId: string, file: File, peerName: string) => void;
  onCancelTransfer: () => void;
  onViewServer?: (serverUrl: string) => void;
  currentServerUrl?: string;
}
```

---

## Key behaviors

- **Self-filter:** `myClientId` is excluded from the rendered list so the user does not see themselves.
- **Empty state:** Returns a single `<p>` message when no other clients are connected.
- **Device icon mapping:** `mobile` → 📱, `isServer = true` → 🖥️, otherwise (browser) → 🌐.
- **"Ver" button:** Shown only for server clients (`isServer = true`) that are not the currently connected server (compared by IP via `extractIp`). Calls `onViewServer("http://{client.ip}:3001")` to switch the active server context.
- **File send:** Each row has a hidden `<input type="file">`. Clicking "Enviar" triggers the input. On file selection, `onSendFile(client.clientId, file, client.appName)` is called and the input value is reset.
- **Active transfer UI:** When `activeTransfer.peerId === client.clientId`, the actions area is replaced by a progress view:
  - `waiting: true` → shows "Esperando respuesta..."
  - `waiting: false` → shows a progress bar, percentage, and file size.
  - A cancel button (✕) calls `onCancelTransfer`.
- **Disabled state:** When a transfer is in progress for a different row (`isOtherRow`), Send and Ver buttons on all other rows are disabled.
