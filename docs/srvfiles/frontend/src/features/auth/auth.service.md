# auth.service.ts

**File:** `src/features/auth/auth.service.ts`
**Purpose:** Core authentication service — manages the session token in `sessionStorage` and provides functions to authenticate against a server PIN endpoint.

---

## Exports

### Token management

| Function | Signature | Description |
|---|---|---|
| `getToken` | `() => string \| null` | Reads the session token from `sessionStorage` (`srvfiles-session-token`). Returns `null` if absent. |
| `setToken` | `(token: string) => void` | Writes the token to `sessionStorage`. |
| `clearToken` | `() => void` | Removes the token from `sessionStorage` and dispatches a `"srvfiles:token-cleared"` `CustomEvent` on `window`. |
| `onTokenCleared` | `(cb: () => void) => () => void` | Subscribes to the token-cleared event. Returns a cleanup function that removes the listener. |

### Authentication

#### `authenticate(baseUrl: string, pin: string): Promise<boolean>`

Posts `{ pin }` to `{baseUrl}/api/auth`. On a `200 ok` response, stores the returned `token` via `setToken` and returns `true`. Returns `false` on wrong-PIN (non-ok) or network errors.

#### `autoAuthenticate(baseUrl: string): Promise<boolean>`

Only proceeds if `isLocalOrigin(baseUrl)` is true. Fetches `{baseUrl}/api/pin` to retrieve the server's plain-text PIN, then calls `authenticate`. Returns `true` on success, `false` if the origin is not local, if `/api/pin` fails, or if authentication fails.

### `isLocalOrigin(baseUrl: string): boolean`

Returns `true` when the URL's hostname is `localhost`, `127.0.0.1`, or `tauri.localhost`. Returns `false` for LAN IPs, malformed URLs, or empty strings.

---

## Key behaviors

- **Session scope:** The token is stored in `sessionStorage` (tab-scoped), so it is cleared when the tab closes. This is intentional — if the server restarts and generates a new PIN, old tokens from previous sessions become invalid automatically.
- **Token-cleared event:** `clearToken` dispatches `"srvfiles:token-cleared"` on `window`. `useAuth` listens to this event (via `onTokenCleared`) so it can re-open the PIN dialog when a 401 clears the token externally (e.g. from inside `useFiles`).
- **Logging:** All auth lifecycle events (success, failure, error) are logged via `lib/logger` with the `[auth]` tag.
