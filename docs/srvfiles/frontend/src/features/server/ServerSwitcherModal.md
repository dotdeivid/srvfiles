# ServerSwitcherModal.tsx

**File:** `src/features/server/ServerSwitcherModal.tsx`
**Purpose:** Modal for viewing the currently connected server, discovering other SrvFiles servers on the network, and switching to them. Includes a pre-authentication PIN flow for Tauri connecting to remote servers.

---

## Exports

### `ServerSwitcherModal`

**Props:**

```ts
interface ServerSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentServerUrl: string;          // Backend URL with real LAN IP (e.g. 192.168.1.5:3001)
  copyUrl: string | null;            // HTTPS frontend URL for QR/copy (may differ from backend URL)
  serverClients: TransferClient[];   // Relay peers with isServer=true
  localLanIp: string | null;         // LAN IP of the local machine (Tauri), persisted across server switches
  onConnect: (url: string) => void;
  onRescan: () => Promise<DiscoveredServer[]>;
}
```

---

## Key behaviors

### On open

Triggers an automatic `onRescan()` call, resets all internal state (scanned results, same-server message, pending PIN URL and fields).

### Server list merging

The "Other servers" list merges two sources, deduplicating by IP and excluding the current server:
1. **Relay peers** (`serverClients` filtered to `isServer=true`, mapped to `DiscoveredServer` shape).
2. **Scan results** (`scanned`, filtered to exclude IPs already in the relay list).

In Tauri, if the user is connected to a remote server, "Este equipo" (this machine) is prepended using `localLanIp` so the user can return to their own server without memorizing its IP.

### `handleConnect(url)`

Behavior depends on context:
- **Browser:** Opens `url` in a new tab (`window.open`).
- **Tauri → local (localhost / 127.0.0.1 / own LAN IP):** Calls `onConnect` and closes the modal immediately (auto-auth handles credentials).
- **Tauri → remote server:** Sets `pendingUrl` to show the PIN prompt instead of changing servers immediately.

### Pre-auth PIN flow (Tauri only)

When `pendingUrl` is set, the modal renders the PIN prompt UI instead of the server list. The user enters the 6-digit PIN, which is sent to the remote server via `authenticate(pendingUrl, pin)`. On success, `onConnect(pendingUrl)` is called and the modal closes. On failure, `connectPinError` is shown inline. Cancelling resets `pendingUrl` back to `null`.

### Manual connect

An IP input field at the bottom allows manually entering an IP. The handler normalizes input by prepending `http://` if missing and appending `:3001` if no port is specified.

### `CopyBtn` (internal component)

A small inline button that copies a given text to the clipboard and shows a checkmark for 2 seconds.

### Current server display

Always shows two URL rows:
- **Servidor** (backend URL, shown with a server-rack icon).
- **Web** (HTTPS frontend URL from `copyUrl`, shown with a globe icon).

Each row has a `CopyBtn`.
