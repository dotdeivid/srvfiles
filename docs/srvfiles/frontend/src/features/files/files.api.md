# files.api.ts

**File:** `src/features/files/files.api.ts`
**Purpose:** Central API module for the files feature. Defines all data types, the runtime URL resolver, the `AuthError` class, and a factory function that creates a scoped set of API methods bound to a specific backend URL.

---

## Exports

### `getApiUrl(): string`

Resolves the backend base URL at runtime. Priority order:

| Priority | Condition | Result |
|---|---|---|
| 1 | `VITE_API_URL` env var is set | The env var value (explicit override) |
| 2 | `window.location.hostname === "tauri.localhost"` | `http://localhost:3001` (Tauri 2 macOS/Linux webview) |
| 3 | Protocol is `https:` | `https://{hostname}:{window.location.port \| "443"}` |
| 4 | Protocol is `http:` | `http://{hostname}:{VITE_BACKEND_PORT \| "3001"}` |

The HTTPS/HTTP split is necessary because over HTTPS the frontend and backend share the same port (e.g. `:3002`), while over HTTP the Vite dev server and the backend run on different ports.

### Interfaces

```ts
interface FileInfo {
  name: string;
  size: number;        // bytes
  createdAt: string;   // ISO 8601
  downloadUrl: string;
}

interface DiskStats {
  total: number;  // bytes
  used: number;
  free: number;
}

interface UploadedFile {
  name: string;
  originalName: string;
  size: number;
  downloadUrl: string;
}

interface AppConfig {
  appName: string;
  lanIp: string;
  port: number;                 // HTTP backend port (e.g. 3001)
  httpsPort: number;            // HTTPS port for external browsers (e.g. 3002)
  frontendPort: number;         // Vite dev-server port (e.g. 5173)
  maxFileSizeMb: number;
  previewMaxFileSizeMb: number;
  lanUrl: string;
}
```

### `class AuthError`

Thrown by the axios response interceptor when the server returns `401`. Extends `Error` with `name = "AuthError"`. Callers can use `instanceof AuthError` to distinguish auth failures from other errors.

### `createFilesApi(baseUrl: string)`

Factory pattern: creates a set of API functions bound to `baseUrl`. Used by `useFiles` to communicate with a chosen server (local or remote on the LAN).

Internally creates an `axios` instance with `baseURL = "{baseUrl}/api/files"` and two interceptors:
- **Request interceptor:** attaches `X-SrvFiles-Token` header from `getToken()` on every request.
- **Response interceptor:** on `401`, calls `clearToken()` and rejects with `AuthError`; on other errors, logs and re-rejects.

**Returned methods:**

| Method | HTTP call | Returns |
|---|---|---|
| `getFiles()` | `GET /api/files/` | `{ files: FileInfo[], count: number }` |
| `uploadFiles(files, onProgress?)` | `POST /api/files/upload` (multipart) | `{ message: string, files: UploadedFile[] }` |
| `deleteFile(filename)` | `DELETE /api/files/{filename}` | `{ message: string }` |
| `getStats()` | `GET /api/files/stats` | `DiskStats` |
| `getConfig()` | `GET /api/config` (direct axios, not the instance) | `AppConfig` |
| `getDownloadUrl(filename)` | Synchronous — no network call | Download URL string with token as query param |

---

## Key behaviors

- **Token in download URL:** `getDownloadUrl` appends `?token={token}` so download links work inside `<a href>` tags and iframes that cannot set custom headers.
- **Preview URL derivation:** `PreviewModal` derives preview URLs by replacing `/api/files/download/` with `/api/files/preview/` in the download URL, preserving the token automatically.
- **`getConfig` uses plain axios:** The `/api/config` endpoint is outside the `/api/files` prefix, so it bypasses the instance and sends the token manually via `headers`.
