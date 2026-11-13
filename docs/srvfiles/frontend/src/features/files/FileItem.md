# FileItem.tsx

**Archivo:** `frontend/src/features/files/FileItem.tsx`
**Rol:** Fila/tarjeta de un archivo con selección y acciones de vista previa, descarga y borrado.

---

- Checkbox de selección (`selected` / `onToggleSelected`); la fila o tarjeta seleccionada se resalta.
- Columnas en la lista: selección, nombre, tamaño, fecha (`formatDate`, oculta en pantallas angostas) y acciones. Cada `<td>` envuelve su contenido en un `div`: un `<td>` con `display: flex` deja de ser celda y corta los bordes de la fila.
- Descarga con `downloadFile` (ver `download.ts`).
- `isLocal` (app de escritorio viendo su propio servidor): el archivo ya está en `Descargas/SrvFiles`, así que en lugar de "Descargar" se muestra "Mostrar en la carpeta" (`showInFolder`).
- Eliminar llama a `onRequestDelete([name])`.
- Abre `PreviewModal` en un portal si `canPreview(name)`.
