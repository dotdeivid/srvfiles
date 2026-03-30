# PreviewModal.tsx

**File:** `src/features/preview/PreviewModal.tsx`
**Purpose:** Full-screen preview modal that renders the appropriate preview component based on the file's type category. Supports keyboard (ESC) and backdrop-click dismissal.

---

## Exports

### `PreviewModal`

**Props:**

```ts
interface Props {
  file: FileInfo;
  downloadUrl: string;
  onClose: () => void;
}
```

---

## Key behaviors

- **Preview URL:** Derives the inline preview URL by replacing `/api/files/download/` with `/api/files/preview/` in `downloadUrl`. The `/preview/` endpoint serves the file without `Content-Disposition: attachment`, allowing browsers to embed it in `<img>`, `<video>`, `<audio>`, and `<iframe>` elements. The session token query param is preserved automatically.
- **Type routing:** `getFileCategory(file.name)` from `shared/utils/fileTypeHelper` determines which preview component to render:

  | Category | Component |
  |---|---|
  | `image`, `svg` | `ImagePreview` |
  | `video` | `VideoPreview` |
  | `audio` | `AudioPreview` |
  | `pdf` | `PdfPreview` |
  | `text` | `TextPreview` |
  | `unknown` | `UnknownPreview` |

- **ESC key:** A `keydown` listener on `document` closes the modal on `Escape`.
- **Body scroll lock:** `document.body.style.overflow = "hidden"` while the modal is open; restored on unmount.
- **Backdrop click:** Closes the modal when the click target is the overlay element itself (checked via `e.target === overlayRef.current`), not when clicking inside the modal panel.
- **Rendered into portal:** `FileItem` renders this component via `createPortal(…, document.body)` to escape any CSS stacking context from the file table.
