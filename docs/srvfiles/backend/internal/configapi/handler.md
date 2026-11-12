# configapi/handler.go

**Archivo:** `backend/internal/configapi/handler.go`
**Rol:** `GET /api/config`: configuración que necesita el frontend.

---

Devuelve `appName`, `lanIp`, `port`, `httpsPort`, `frontendPort`, `maxFileSizeMb`, `maxUploadCount`, `previewMaxFileSizeMb` y `lanUrl` (`http://<ip>:<puerto>`). Requiere sesión.
