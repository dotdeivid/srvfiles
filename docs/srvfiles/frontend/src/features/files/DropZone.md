# DropZone.tsx

**Archivo:** `frontend/src/features/files/DropZone.tsx`
**Rol:** Zona de arrastrar y soltar para subir archivos.

---

- Navegador: `react-dropzone` (File API, lectura en streaming al subir).
- App de escritorio: el drop del sistema llega como rutas (`onDragDropEvent`); `pathInfo` obtiene nombre y tamaño y se suben con un comando nativo sin cargar el archivo en memoria.
- **Toda la ventana acepta archivos.** En el navegador, listeners en `window` (`dragenter`/`dragleave` con contador, `dragover`, `drop`) manejan los drops fuera del área; los de adentro siguen con `react-dropzone` (se distinguen con `rootRef`). En Tauri el evento nativo ya cubre la ventana.
- `compact`: con archivos ya subidos se muestra como una barra en lugar del área grande.
- En pantallas táctiles (`pointer: coarse`) dice "Tocá para elegir archivos" en vez de "Arrastrá".
- Lista de preparados sin duplicados, aviso de archivos que superan `maxFileSizeMb` (con el motivo visible bajo "Subir", no solo en un tooltip), barra de progreso con `role="progressbar"`, cancelar. Tras subir, conserva solo los fallidos.
