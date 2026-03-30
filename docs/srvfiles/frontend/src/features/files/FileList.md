# FileList.tsx

**File:** `src/features/files/FileList.tsx`
**Purpose:** Renders the full file browser UI — toolbar with search and view-mode toggle, file count, empty states, and the list or grid of `FileItem` components.

---

## Exports

### `FileList`

**Props:**

```ts
interface FileListProps {
  files: FileInfo[];
  loading: boolean;
  onRequestDelete: (filename: string) => void;
  getDownloadUrl: (filename: string) => string;
  canDelete: boolean;
  previewMaxMb?: number;
}
```

---

## Key behaviors

- **Loading state:** While `loading` is `true`, renders a spinner with "Cargando archivos..." instead of the file list.
- **Client-side search:** `filteredFiles` is derived via `useMemo` — filters `files` by case-insensitive substring match on `file.name`. The search query is local state; no server request is made.
- **View toggle:** Local `viewMode` state switches between `'list'` (table) and `'grid'` (CSS grid). Buttons use `btn-icon--active` class when their mode is active.
- **Empty states:** Two different empty messages are shown depending on whether a search is active (search not found) or the list is genuinely empty (no files yet).
- **List view:** Renders a `<table>` with columns Name, Size, and Actions. Each row is a `<FileItem viewMode="list">`.
- **Grid view:** Renders a `.file-list__grid` div with `<FileItem viewMode="grid">` cards.
- **File count label:** Shows `"{n} archivo(s)"` and appends `"(filtrando de {total})"` when a search filter is active.
