# useAuth.ts

**File:** `src/features/auth/useAuth.ts`
**Purpose:** React hook that manages PIN-based authentication state for a given server URL. Handles auto-authentication for local servers, manual PIN entry for remote servers, and re-authentication when the token is cleared externally.

---

## Exports

### `useAuth(serverUrl: string): UseAuthReturn`

**Parameters:** `serverUrl` — the backend base URL (e.g. `"http://192.168.1.10:3001"`).

**Return type:**

```ts
interface UseAuthReturn {
  authenticated: boolean;
  pinDialogOpen: boolean;
  pinError: string | null;
  serverPin: string | null;   // Plain-text PIN shown in the header for local servers. Null for remote.
  submitPin: (pin: string) => Promise<void>;
}
```

---

## Key behaviors

### Authentication flow on mount (or when `serverUrl` changes)

**Local server** (`localhost`, `127.0.0.1`, `tauri.localhost`):
1. Fetches `GET /api/pin` via `toPinUrl()`, which rewrites the hostname to `localhost` so the backend's loopback guard accepts the request.
2. Stores the PIN in `serverPin` state (displayed in the header chip).
3. Always re-authenticates by calling `authenticate(serverUrl, pin)` — even if a token already exists — because the server may have restarted with a new PIN.
4. On success: sets `authenticated = true`. On failure: opens the PIN dialog.

**Remote server:**
1. If `getToken()` returns a non-null value, sets `authenticated = true` immediately (skips the dialog).
2. Otherwise opens the PIN dialog for manual entry.

### Re-authentication on external token clear

A second `useEffect` subscribes to the `"srvfiles:token-cleared"` event via `onTokenCleared`. When the event fires (e.g. when `useFiles` receives a 401 and calls `clearToken`), `authenticated` is set to `false` and the PIN dialog re-opens. A `useRef` is used to read the latest `authenticated` value inside the event listener without adding it as a dependency.

### `submitPin(pin: string)`

Calls `authenticate(serverUrl, pin)`. On success: sets `authenticated = true`, closes the dialog. On failure: sets `pinError` to an error message shown inside the dialog.

### `toPinUrl(url: string): string`

Internal helper that rewrites the hostname of any URL to `localhost`, then appends `/api/pin`. This ensures the PIN endpoint is always reached via loopback, which the backend requires.

---

## Dependencies

- `auth.service` — `getToken`, `authenticate`, `isLocalOrigin`, `onTokenCleared`
- `lib/logger` — logging throughout the auth lifecycle
