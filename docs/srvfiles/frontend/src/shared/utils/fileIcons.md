# fileIcons.ts

**File:** `src/shared/utils/fileIcons.ts`
**Purpose:** Maps file extensions to emoji icons for display in the file list and grid. Centralized so the mapping can be updated in one place.

---

## Exports

### `getFileIcon(filename: string): string`

Returns an emoji string representing the file type based on the file's extension (lowercase). Unrecognized extensions return `"📁"` (default).

**Extension-to-emoji mapping:**

| Category | Extensions | Icon |
|---|---|---|
| Documents | `pdf` | 📄 |
| Text / Office | `doc`, `docx`, `txt` | 📝 |
| Images | `jpg`, `jpeg`, `png`, `gif`, `svg`, `webp` | 🖼️ |
| Video | `mp4`, `avi`, `mkv`, `mov` | 🎬 |
| Audio | `mp3`, `wav`, `flac`, `ogg` | 🎵 |
| Archives | `zip`, `rar`, `7z`, `tar`, `gz` | 📦 |
| Code | `js`, `ts`, `py`, `java`, `cpp` | ⚙️ |
| Web | `html`, `css`, `json` | 🌐 |
| Spreadsheets | `xlsx`, `xls`, `csv` | 📊 |
| Presentations | `pptx`, `ppt` | 📊 |
| Unknown | (anything else) | 📁 |

**Note:** This mapping is for display icons only. Previewability is determined separately by `fileTypeHelper.ts`.
