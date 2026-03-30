# PdfPreview.tsx

**File:** `src/features/preview/previews/PdfPreview.tsx`
**Purpose:** Preview component for PDF files. Embeds the file in a full-height `<iframe>` so the browser's built-in PDF viewer handles rendering.

---

## Exports

### `PdfPreview`

**Props:** `{ src: string }`

Renders a single `<iframe src={src} className="preview-pdf" title="Vista previa PDF">`. No state, no effects. The browser PDF viewer provides all navigation and zoom controls.
