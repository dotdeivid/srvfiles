# discovery.api.ts

**File:** `src/features/server/discovery.api.ts`
**Purpose:** API module for discovering other SrvFiles instances on the local network. Delegates the actual subnet scan to the backend and returns the results.

---

## Exports

### `DiscoveredServer`

```ts
interface DiscoveredServer {
  ip: string;       // e.g. "192.168.1.10"
  url: string;      // e.g. "http://192.168.1.10:3001"
  appName: string;  // name of the SrvFiles instance found
}
```

### `scanNetwork(): Promise<DiscoveredServer[]>`

Sends `GET {localApi}/api/discovery/scan` to the local backend with a 15-second timeout. Attaches `X-SrvFiles-Token` if a token is present. Logs start, completion, and errors via `lib/logger`.

The scan itself happens server-side (the backend probes each IP in the `/24` subnet). The frontend cannot do this directly due to browser CORS restrictions.

---

## Key behaviors

- **Server-side scan:** The backend tries `GET /api/health` on all 254 IPs in the subnet in parallel. Only IPs that respond with `{ app: "SrvFiles" }` are included in the results.
- **15-second timeout:** Accommodates slow networks where probing 254 IPs may take several seconds.
- **Auth header:** `X-SrvFiles-Token` is included because the `/api/discovery/scan` endpoint is protected. Without it, PIN-enabled servers would reject the request with 401.
- **Error propagation:** On failure, the error is logged and re-thrown. The caller (`useMode`) catches it and retries up to 6 times with 500 ms delay.
