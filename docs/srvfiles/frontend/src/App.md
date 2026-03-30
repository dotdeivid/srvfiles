# App.tsx

**File:** `src/App.tsx`
**Purpose:** Root component. Orchestrates all application logic, composes hooks, and decides what to render. Defines three components: `App`, `ConnectingScreen`, and `FileApp`.

---

## Components

### `App` (default export)

Uses `useMode()` to resolve the backend server URL. While `connecting` is `true`, renders `<ConnectingScreen />`. Once resolved, renders `<FileApp serverUrl={serverUrl!} onConnect={connect} onRescan={rescan} />`.

### `ConnectingScreen`

Purely presentational splash screen shown while the backend URL is being resolved. Renders a spinner and "Buscando servidor..." text.

### `FileApp`

**Props:** `{ serverUrl: string; onConnect: (url) => void; onRescan: () => Promise<DiscoveredServer[]> }`

The main application UI. Composes all domain hooks and manages local modal state.

**Hooks used:**

| Hook | Purpose |
|---|---|
| `useAuth(serverUrl)` | PIN authentication; provides `authenticated`, `pinDialogOpen`, `pinError`, `serverPin`, `submitPin`. |
| `useFiles(serverUrl \| null)` | File listing, upload, delete. Receives `null` while auth is pending. |
| `useDeviceName()` | Device display name for the transfer peer list. |
| `useTransfer(...)` | WebSocket connection and P2P transfer state. Reconnects when `serverUrl` or `authenticated` changes. |

**Local state:**
- `renameOpen` — controls the rename modal (device name).
- `switcherOpen` — controls the `ServerSwitcherModal`.
- `confirmOpen` + `pendingDelete` — controls the delete confirmation flow.
- `localLanIp` — tracks the LAN IP of the local machine; populated from `config.lanIp` when connected to localhost and persists after switching to a remote server so `ServerSwitcherModal` can show "Este equipo".

**Derived values:**
- `appName` — from `config.appName`, then `VITE_APP_NAME`, then `"SrvFiles"`.
- `webUrl` — `https://{config.lanIp}:{config.httpsPort}` when available. Used for the QR code and the "Web" row in `ServerSwitcherModal`.
- `backendLanUrl` — `http://{config.lanIp}:{config.port}` when available, else `serverUrl`. Shown in `PinDialog` and `ServerSwitcherModal` to display the real LAN IP instead of "localhost".
- `serverClients` — relay peers with `isServer = true`, passed to `ServerSwitcherModal`.
- `otherClients` — all relay peers except self, used to animate the clients panel open/closed.

**File receive flow:** `handleFileReceived` calls `saveReceivedFile` (Tauri: saves to disk; browser: download dialog) and shows a `sonner` toast.

**Delete flow:** `handleRequestDelete` sets `pendingDelete` and opens `ConfirmModal`. `handleConfirmDelete` calls `remove(pendingDelete)` and shows a success/error toast.

**Transfer rejection:** `handleRejectTransfer` calls `rejectTransfer()` and shows an error toast.

**Rename flow:** `handleSaveName` calls `saveName(name)` to persist and also `rename(name)` to update the relay without reconnecting. Closes `renameOpen`.

**JSX structure:**
1. `<Toaster>` + all modals (`PinDialog`, `NameModal`, `IncomingTransferModal`, `ServerSwitcherModal`, `ConfirmModal`) — outside the main layout containers.
2. `<header>` — full-width, outside `.app`. Contains app title, server-switcher chip (shows server name + optional PIN), device-name chip, and `DiskStats`.
3. `<div className="app">` — max-width container. Contains error banner, `DropZone`, clients panel (animated open when `otherClients.length > 0`), `FileList`, and `QRFooter`.
