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
| `UPLOADS_DIR` | `<Descargas>/SrvFiles` | Carpeta compartida (ver abajo). |
| `CERTS_DIR` | `./certs` | Certificado TLS. |

## Carpeta por defecto

`defaultUploadsDir()` = `downloadsDir()` + `SrvFiles`, la misma carpeta que usan la app de escritorio y la app Android:

| Sistema | `downloadsDir()` |
|---|---|
| Windows (`downloads_windows.go`) | `KnownFolderPath(FOLDERID_Downloads)`: respeta si Descargas se movió a otro disco. |
| Linux (`downloads_other.go`) | `XDG_DOWNLOAD_DIR` (variable de entorno o `$XDG_CONFIG_HOME/user-dirs.dirs`, p. ej. `~/Descargas`); si no, `~/Downloads`. |
| macOS | `~/Downloads`. |

Sin carpeta de descargas (contenedor, usuario sin home) → `./uploads`. Si `storage.Init` no puede crear la carpeta, también cae a `./uploads`.

Otras variables leídas en otros paquetes: `LOGS_DIR` y `APP_ENV` (logger). La app de escritorio pasa `PORT`, `HTTPS_PORT`, `UPLOADS_DIR`, `CERTS_DIR`, `LOGS_DIR` y `APP_ENV=production`.
