# format.ts

**File:** `src/shared/utils/format.ts`
**Purpose:** String and number formatting utilities shared across the frontend.

---

## Exports

### `stripProtocol(url: string): string`

Removes `http://` or `https://` from the beginning of a URL. Used to display clean host:port strings in the UI (e.g. `"192.168.1.5:3001"`).

### `extractIp(url: string): string`

Strips the protocol and the trailing `:{port}` from a URL to return just the IP or hostname (e.g. `"192.168.1.5"`). Uses `stripProtocol` internally.

### `formatBytes(bytes: number): string`

Converts a byte count to a human-readable string with one decimal place:
- `0` → `"0 B"`
- `1024` → `"1.0 KB"`
- `1048576` → `"1.0 MB"`
- etc.

Uses base-1024 (binary units: B, KB, MB, GB, TB).
