# useFiles.ts

**File:** `src/features/files/useFiles.ts`
**Purpose:** React hook that manages all file-related state for a given server URL — file listing, disk stats, app config, upload, and delete. Pauses when `serverUrl` is `null` (e.g. during auth).

---

## Exports

### `useFiles(serverUrl?: string | null): UseFilesReturn`

**Parameters:** `serverUrl` — optional backend base URL. Defaults to `getApiUrl()`. Pass `null` to pause all fetching (used while the PIN dialog is open).

**Return type:**

```ts
interface UseFilesReturn {
  files: FileInfo[];
  stats: DiskStats | null;
  config: AppConfig | null;
  loading: boolean;
  uploading: boolean;
  uploadProgress: number;       // 0–100
  error: string | null;
  fetchFiles: () => Promise<void>;
  fetchStats: () => Promise<void>;
  upload: (files: File[]) => Promise<boolean>;
  remove: (filename: string) => Promise<boolean>;
  getDownloadUrl: (filename: string) => string;
}
```

---

## Key behaviors

- **API instance:** `createFilesApi(serverUrl ?? getApiUrl())` is memoized via `useMemo` on `serverUrl`, so the axios instance is only recreated when the server changes.
- **Null pause:** When `serverUrl === null`, the initial-fetch `useEffect` sets `loading = false` immediately and returns without fetching. This prevents requests with a missing auth token while the PIN dialog is open.
- **Parallel initial fetch:** On mount (or when `serverUrl` changes to a non-null value), `fetchFileList`, `fetchDiskStats`, and `fetchConfig` are called in parallel via `Promise.all`. State is reset to empty/null before the fetch starts.
- **Upload:** Sets `uploading = true`, resets `uploadProgress = 0`, calls `api.uploadFiles` with an `onProgress` callback that updates `uploadProgress`, then refreshes files and stats on success. Returns `true` on success, `false` on error.
- **Delete:** Calls `api.deleteFile`, then refreshes files and stats on success. Returns `true`/`false`.
- **Error surfacing:** `fetchFiles` errors are surfaced to the UI via the `error` field. `fetchStats` and `fetchConfig` errors are logged but not surfaced (non-critical).
- **Logging:** All operations are logged via `lib/logger` with the `[useFiles]` tag.
