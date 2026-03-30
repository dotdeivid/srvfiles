# DropZone.tsx

**File:** `src/features/files/DropZone.tsx`
**Purpose:** Drag-and-drop upload zone. Stages files before uploading and supports both browser HTML5 drag-and-drop and Tauri's native OS drag-drop event API.

---

## Exports

### `DropZone`

**Props:**

```ts
interface DropZoneProps {
  onUpload: (files: File[]) => Promise<boolean>;
  uploading: boolean;
  uploadProgress: number;   // 0–100
}
```

---

## Key behaviors

- **Dual drag-drop handling:**
  - **Browser:** `react-dropzone` handles both click-to-browse and HTML5 drag-drop events.
  - **Tauri:** `react-dropzone` handles click-to-browse only (`noDrag: isTauriApp()`). A separate `useEffect` subscribes to `webview.onDragDropEvent` from `@tauri-apps/api/webview` because Tauri intercepts OS-level drag events before they reach the DOM. Files are read via `@tauri-apps/plugin-fs` `readFile` and converted to `File` objects.
- **Staging:** Dropped or selected files are added to `stagedFiles` state rather than uploaded immediately. Staged files are deduplicated by `name:size` to prevent Tauri's double-fire behavior.
- **Upload action:** `handleUpload` calls `onUpload(stagedFiles)`. On success (`true` returned), `stagedFiles` is cleared. On failure, staged files remain so the user can retry.
- **Progress bar:** While `uploading` is `true`, renders an `.upload-progress` bar driven by `uploadProgress` (0–100).
- **Staged list:** Shows the list of staged files with individual remove buttons and a "Clear all" button. The "Upload" button label adapts to file count.
- **Tauri cleanup:** The `onDragDropEvent` listener is unregistered on unmount via the returned `unlisten()` function.
- **Visual state:** The dropzone div gets `dropzone--active` class while a drag is in progress (either browser or Tauri drag), and `dropzone--disabled` while an upload is in progress.
