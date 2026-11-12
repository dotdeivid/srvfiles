# files.api.ts

**Archivo:** `frontend/src/features/files/files.api.ts`
**Rol:** Cliente HTTP de la API de archivos.

---

- `getApiUrl()` (navegador): `VITE_API_URL`; en desarrollo mismo host con `VITE_BACKEND_PORT` (3001); en producción el origen actual. En la app de escritorio el puerto viene de `getBackendPort()`.
- Tipos: `FileInfo`, `DiskStats`, `UploadedFile`, `FailedFile`, `UploadResult`, `AppConfig`.
- `createFilesApi(baseUrl)`: `getFiles`, `getStats`, `getConfig`, `uploadFiles` (con progreso y cancelación vía `uploadWithProgress`), `deleteFile`, **`getLinkedUrl(name, 'download' | 'preview')`** (pide `POST /api/files/link` y arma la URL con `?dl=`) y `getPlainDownloadUrl(name)` (sin token, para las descargas nativas que mandan la cabecera).
