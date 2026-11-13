# PreviewModal.tsx

**Archivo:** `frontend/src/features/preview/PreviewModal.tsx`
**Rol:** Modal de vista previa según el tipo de archivo.

---

- Pide la URL de vista previa de forma asíncrona con `getLinkedUrl(name, 'preview')` (token de enlace, 10 min).
- Carga perezosa del visor según `getFileCategory`: imagen/SVG, video, audio, PDF, texto o desconocido.
- Sobre `Dialog` (variante `dialog--preview`, fondo más oscuro): Esc o clic en el fondo cierra, el foco queda dentro y vuelve al cerrar. `onDownload` para descargar desde el visor.
