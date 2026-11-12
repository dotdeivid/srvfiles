# config/config.go

**Archivo:** `backend/internal/config/config.go`
**Rol:** Configuración por variables de entorno.

---

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | 3001 | HTTP. |
| `HOST` | `0.0.0.0` | Interfaz de escucha. |
| `HTTPS_PORT` | `PORT + 1` | HTTPS (LAN). |
| `APP_NAME` | SrvFiles | Nombre en la UI y en `/api/health`. |
| `FRONTEND_PORT` | 5173 | Puerto del frontend en desarrollo. |
| `MAX_FILE_SIZE_MB` | 10240 | Límite por archivo en subidas. |
| `MAX_UPLOAD_COUNT` | 50 | Archivos por subida. |
| `PREVIEW_MAX_FILE_SIZE_MB` | 1024 | Tamaño máximo para vista previa. |
| `UPLOADS_DIR` | `./uploads` | Carpeta de archivos. |
| `CERTS_DIR` | `./certs` | Certificado TLS. |

Otras variables leídas en otros paquetes: `LOGS_DIR` y `APP_ENV` (logger). La app de escritorio pasa `PORT`, `HTTPS_PORT`, `UPLOADS_DIR`, `CERTS_DIR`, `LOGS_DIR` y `APP_ENV=production`.
