# TextPreview.tsx

**Archivo:** `frontend/src/features/preview/previews/TextPreview.tsx`
**Rol:** Vista de archivos de texto.

---

Pide solo los primeros 512 KB con `Range` (un `<pre>` de cientos de MB congela la pestaña) y avisa si el archivo está truncado, con botón para descargarlo completo.
