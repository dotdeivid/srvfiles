# FileItem.tsx

**Archivo:** `frontend/src/features/files/FileItem.tsx`
**Rol:** Fila/tarjeta de un archivo con acciones de vista previa, descarga y borrado.

---

- Navegador: `downloadInBrowser` pide un token de enlace (`getLinkedUrl(name, 'download')`) y dispara un `<a download>`; el token de sesión nunca va en la URL.
- App de escritorio: `downloadWithTauri(url, token, name)` usa `nativeDownload` a `Descargas/SrvFiles` con progreso y botón de cancelar en el aviso; el token va en la cabecera.
- `isLocal` (app de escritorio viendo su propio servidor): el archivo ya está en `Descargas/SrvFiles`, así que en lugar de "Descargar" se muestra "Mostrar en la carpeta" (`showInFolder`).
- Abre `PreviewModal` en un portal si `canPreview(name)`.
