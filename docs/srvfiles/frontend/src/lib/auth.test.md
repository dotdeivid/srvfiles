# auth.test.ts

**File:** `src/lib/auth.test.ts`
**Purpose:** Vitest unit-test suite for `features/auth/auth.service`. Covers all public functions exported by that module using jsdom's `sessionStorage` and `vi.stubGlobal` fetch mocks.

---

## Test suites

### `isLocalOrigin`

Verifies the helper correctly classifies URLs:
- `localhost` and `127.0.0.1` → `true`
- `tauri.localhost` → `true`
- LAN IP (e.g. `192.168.1.10`) → `false`
- Empty string or malformed URL → `false`

### `getToken / setToken / clearToken`

Verifies session-token storage in `sessionStorage`:
- `getToken()` returns `null` when nothing is stored.
- `setToken` stores a token that `getToken` retrieves.
- `clearToken` removes the stored token.
- A second `setToken` call overwrites the previous token.

### `authenticate`

Uses `vi.stubGlobal('fetch', ...)` to mock network calls:
- Returns `true` and stores the token on a `200 ok` response with `{ token }`.
- Returns `false` and stores nothing on a non-ok response.
- Returns `false` on a network error (rejected promise).
- Verifies that `POST /api/auth` is called with the correct body `{ pin }`.

### `autoAuthenticate`

- Returns `false` immediately for non-local origins without fetching anything.
- For a local origin: fetches `/api/pin`, then calls `authenticate` with the returned PIN — returns `true` on success with the token stored.
- Returns `false` when the `/api/pin` request fails (non-ok or network error).

---

## Key behaviors

- **beforeEach:** `sessionStorage.clear()` and `vi.restoreAllMocks()` are called before every test to ensure isolation.
- **No Tauri dependency:** The test file imports only from `features/auth/auth.service`, which does not call any Tauri API, so the tests run entirely in the jsdom environment without mocking Tauri internals.
