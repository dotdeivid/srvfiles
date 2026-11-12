# DropZone.tsx

**Archivo:** `frontend/src/features/files/DropZone.tsx`
**Rol:** Zona de arrastrar y soltar para subir archivos.

---

- Navegador: `react-dropzone` (File API, lectura en streaming al subir).
- App de escritorio: el drop del sistema llega como rutas (`onDragDropEvent`); `pathInfo` obtiene nombre y tamaño y se suben con un comando nativo sin cargar el archivo en memoria.
- Lista de preparados sin duplicados, aviso de archivos que superan `maxFileSizeMb`, barra de progreso, cancelar. Tras subir, conserva solo los fallidos.
