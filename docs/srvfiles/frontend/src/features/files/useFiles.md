# useFiles.ts

**Archivo:** `frontend/src/features/files/useFiles.ts`
**Rol:** Estado de archivos de un servidor: lista, espacio y configuración.

---

- Sin polling: refresca con `files-changed`, al reconectar y tras subir o borrar. Descarta respuestas de un servidor anterior al cambiar.
- `serverUrl = null` pausa (diálogo de PIN abierto).
- `upload(items)`: los `File` del navegador van en un multipart; las rutas de la app de escritorio con `nativeUpload` (streaming, evento `upload-progress`). Progreso combinado en bytes, cancelación con `cancelUpload()`. Devuelve `UploadOutcome` con los fallidos.
- `remove(name)`, `getLinkedUrl`, `getPlainDownloadUrl` (memoizados con `useCallback`).
