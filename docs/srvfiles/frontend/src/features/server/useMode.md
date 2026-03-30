# useMode.ts

**File:** `src/features/server/useMode.ts`
**Purpose:** React hook that determines the active backend server URL on startup. Handles three contexts: Tauri (always localhost), browser accessed from a remote device (use `getApiUrl()`), and browser on localhost (scan for the backend).

---

## Exports

### `useMode(): { serverUrl: string | null; connecting: boolean; connect: (url: string) => void; rescan: () => Promise<DiscoveredServer[]> }`

**State:**
- `serverUrl` — the resolved backend base URL, or `null` while still connecting.
- `connecting` — `true` until the server URL is resolved. `App` shows a splash screen during this time.

**Functions:**
- `connect(url)` — normalizes and sets `serverUrl` to switch to a different server.
- `rescan()` — calls `scanNetwork()` and returns the results (used by `ServerSwitcherModal`).

---

## Key behaviors

### Auto-connect logic (runs once on mount)

| Context | How detected | Action |
|---|---|---|
| **Tauri** | `isTauriApp()` returns `true` | Sets `serverUrl = "http://localhost:3001"` immediately. |
| **Remote browser** | `window.location.hostname` is not localhost/127.0.0.1/tauri.localhost | Sets `serverUrl = normalize(getApiUrl())`. |
| **Localhost browser** | `isLocalContext()` returns `true` | Scans the network via `scanNetwork()` (up to 6 attempts with 500 ms retry delay). Uses the first discovered server, or falls back to `http://localhost:3001`. |

### `isLocalContext()`

Internal function: returns `true` if the page is loaded from `localhost`, `127.0.0.1`, `tauri.localhost`, or if `__TAURI_INTERNALS__` is present in `window`.

### `normalize(url)`

Internal function: trims whitespace and removes trailing slashes from the URL before storing it.

### Cancellation

The `useEffect` sets a `cancelled` flag. If the component unmounts before the scan completes, no state updates are applied.
