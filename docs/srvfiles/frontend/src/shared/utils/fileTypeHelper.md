# fileTypeHelper.ts

**File:** `src/shared/utils/fileTypeHelper.ts`
**Purpose:** Determines the previewable category of a file based on its extension. Used to decide which preview component to render and whether to show the eye button on a file.

---

## Exports

### `FileCategory`

```ts
type FileCategory = 'image' | 'svg' | 'video' | 'audio' | 'pdf' | 'text' | 'unknown';
```

### `getFileCategory(filename: string): FileCategory`

Returns the category for a file based on its lowercase extension. Iterates the `EXTENSIONS` map and returns the matching category, or `'unknown'` if no match is found.

**Extension coverage:**

| Category | Extensions |
|---|---|
| `image` | `jpg`, `jpeg`, `png`, `gif`, `webp`, `bmp`, `ico` |
| `svg` | `svg` |
| `video` | `mp4`, `mov`, `m4v`, `webm` |
| `audio` | `mp3`, `wav`, `aac`, `m4a`, `ogg`, `flac`, `opus` |
| `pdf` | `pdf` |
| `text` | `txt`, `md`, `json`, `xml`, `csv`, `yaml`, `yml`, `html`, `htm`, `js`, `jsx`, `ts`, `tsx`, `dart`, `py`, `go`, `rs`, `swift`, `kt`, `java`, `c`, `cpp`, `h`, `css`, `sh`, `bash`, `zsh` |
| `unknown` | anything else |

### `canPreview(filename: string): boolean`

Convenience wrapper: returns `true` when `getFileCategory(filename) !== 'unknown'`. Used by `FileItem` to conditionally render the eye (preview) button.

---

## Key behaviors

- **SVG is separate from `image`:** `PreviewModal` routes `svg` to `ImagePreview`, which handles it correctly via the `<img>` tag. The separation exists in case different handling is needed in the future.
- **Text covers code:** The `text` category includes common source code and markup extensions so they can be rendered in the `<pre>` text viewer.
