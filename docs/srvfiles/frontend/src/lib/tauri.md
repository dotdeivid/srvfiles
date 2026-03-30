# tauri.ts

**File:** `src/lib/tauri.ts`
**Purpose:** Tauri-specific utilities — runtime environment detection and file-saving abstraction that works both inside the Tauri webview and in a regular browser.

---

## Exports

### `isTauriApp(): boolean`

Checks whether the app is running inside a Tauri webview by testing for the presence of `window.__TAURI_INTERNALS__`, which Tauri injects at startup.

Returns `true` inside Tauri, `false` in a standard browser.

### `saveReceivedFile(fileName: string, blob: Blob): Promise<string | null>`

Saves a received file to disk using the most appropriate method for the current environment:

| Environment | Behavior |
|---|---|
| **Tauri** | Creates `~/Downloads/SrvFiles/` (controlled by `VITE_SUBFOLDER`, default `"SrvFiles"`) and writes the file via `@tauri-apps/plugin-fs`. Returns the absolute path on success. Falls back to browser download dialog if the Tauri write fails. |
| **Browser** | Creates a temporary object URL, triggers a native `<a download>` click, and revokes the URL. Returns `null`. |

**Parameters:**
- `fileName` — filename to use when saving (e.g. `"report.pdf"`).
- `blob` — assembled file data as a `Blob`.

**Returns:** The absolute save path string in Tauri (e.g. `/Users/user/Downloads/SrvFiles/report.pdf`), or `null` when the browser download dialog is used.

---

## Key behaviors

- **Subfolder:** The Tauri save path is `{downloadDir}/{VITE_SUBFOLDER}/{fileName}`. `VITE_SUBFOLDER` defaults to `"SrvFiles"`. The directory is created recursively if it does not exist.
- **Tauri fallback:** If `@tauri-apps/plugin-fs` throws (e.g. permission denied), the error is logged and the code falls through to the browser download path so the file is never silently lost.
- **Dynamic imports:** `@tauri-apps/api/path`, `@tauri-apps/plugin-fs`, are imported lazily (only when `isTauriApp()` is true) to avoid bundling Tauri internals in the browser build.
- **Logging:** All save and error events are logged via `lib/logger` using the `[saveReceivedFile]` tag.
