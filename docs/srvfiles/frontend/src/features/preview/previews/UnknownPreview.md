# UnknownPreview.tsx

**File:** `src/features/preview/previews/UnknownPreview.tsx`
**Purpose:** Fallback preview component for file types that cannot be previewed in the browser. Offers a download button instead.

---

## Exports

### `UnknownPreview`

**Props:** `{ downloadUrl: string; fileName: string }`

---

## Key behaviors

- **Tauri vs Browser:** The download action differs by environment:
  - **Tauri:** A button calls `handleDownloadAndOpen`, which fetches the file as a `Blob` and saves it via `saveReceivedFile` (to `~/Downloads/SrvFiles/`). A `sonner` toast shows loading/success/error state.
  - **Browser:** A standard `<a href={downloadUrl} download={fileName}>` link triggers the browser's native download dialog.
- **Display:** Shows a folder emoji, the message "Este tipo de archivo no se puede previsualizar.", and the appropriate download action.
