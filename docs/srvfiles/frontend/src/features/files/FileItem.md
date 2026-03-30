# FileItem.tsx

**File:** `src/features/files/FileItem.tsx`
**Purpose:** Renders a single file entry in either list (table row) or grid (card) view. Handles download, delete, and preview actions.

---

## Exports

### `FileItem`

**Props:**

```ts
interface FileItemProps {
  file: FileInfo;
  onRequestDelete: (filename: string) => void;
  viewMode: 'list' | 'grid';
  getDownloadUrl: (filename: string) => string;
  canDelete: boolean;
  previewMaxMb?: number;   // default 50
}
```

---

## Key behaviors

- **Download in Tauri:** When the download anchor is clicked inside Tauri, the default navigation is prevented and the file is fetched as a `Blob` then saved via `saveReceivedFile`. A `sonner` toast shows loading/success/error state.
- **Preview gating:** `handlePreview` checks `file.size` against `previewMaxMb * 1024 * 1024`. If the file is too large, a warning toast is shown and the preview modal is not opened.
- **Preview eligibility:** The eye button is only rendered when `canPreview(file.name)` returns `true` (i.e. the file type is recognized by `fileTypeHelper`).
- **PreviewModal portal:** The `PreviewModal` is rendered into `document.body` via `createPortal` to escape any CSS stacking context set by the table or grid container.
- **View mode rendering:**
  - `grid` — renders a `.file-card` `<div>` with icon, name, size, and action buttons.
  - `list` — renders a `.file-row` `<tr>` (must be placed inside a `<tbody>`).
- **Delete:** Calls `onRequestDelete(file.name)` without directly deleting — the parent (`FileList` / `App`) owns the confirmation flow.
