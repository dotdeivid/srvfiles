# config.go

**Archivo:** `internal/config/config.go`
**Rol:** Centraliza toda la configuración del servidor leyendo variables de entorno con valores por defecto. Las constantes se exponen como variables de paquete que el resto del código importa directamente.

---

## Variables de configuración

```go
var (
    Port          = envInt("PORT", 3001)
    Host          = envStr("HOST", "0.0.0.0")
    HttpsPort     = envInt("HTTPS_PORT", Port+1)
    AppName       = envStr("APP_NAME", "SrvFiles")
    MaxFileSizeMB = envInt("MAX_FILE_SIZE_MB", 10240)
    MaxUploadCount = envInt("MAX_UPLOAD_COUNT", 50)
    UploadsDir    = envStr("UPLOADS_DIR", "./uploads")
    CertsDir      = envStr("CERTS_DIR", "./certs")
)
```

| Variable | Default | Descripción |
| :--- | :--- | :--- |
| `PORT` | `3001` | Puerto HTTP (Tauri + Flutter) |
| `HOST` | `0.0.0.0` | Interfaz de escucha (todas) |
| `HTTPS_PORT` | `PORT+1` | Puerto HTTPS (navegadores LAN) |
| `APP_NAME` | `SrvFiles` | Nombre mostrado en el banner y la UI |
| `MAX_FILE_SIZE_MB` | `10240` | Límite por archivo en MB (10 GB) |
| `MAX_UPLOAD_COUNT` | `50` | Máximo de archivos por petición de upload |
| `UPLOADS_DIR` | `./uploads` | Directorio donde se guardan los archivos |
| `CERTS_DIR` | `./certs` | Directorio donde se persisten los certificados TLS |

---

## Helpers de lectura

```go
func envStr(key, fallback string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return fallback
}

func envInt(key string, fallback int) int {
    if v := os.Getenv(key); v != "" {
        if n, err := strconv.Atoi(v); err == nil {
            return n
        }
    }
    return fallback
}
```

`envStr` devuelve el valor de la variable de entorno si no está vacío, o el fallback. `envInt` convierte a entero; si la conversión falla (valor no numérico), ignora la variable y usa el default.

---

## Integración con Tauri

Tauri lanza el sidecar como proceso hijo. Puede pasar `UPLOADS_DIR` como variable de entorno para que el backend guarde los archivos en el directorio de datos de la app en lugar de `./uploads` relativo al ejecutable:

```
UPLOADS_DIR=/Users/user/Library/Application Support/srvfiles/uploads ./srvfiles-sidecar
```

Esto es el único mecanismo de configuración en producción — no hay archivos `.env` en runtime.
