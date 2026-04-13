# configapi/handler.go

**Archivo:** `internal/configapi/handler.go`
**Rol:** Handler HTTP que devuelve la configuración del servidor que el frontend necesita para inicializarse: URLs, puertos, límites y nombre de la app.

---

## `Handler` — `GET /api/config`

```go
func Handler(w http.ResponseWriter, r *http.Request) {
    lanIp := network.GetLanIp()
    writeJSON(w, http.StatusOK, map[string]any{
        "appName":             config.AppName,
        "lanIp":               lanIp,
        "port":                config.Port,
        "httpsPort":           config.HttpsPort,
        "frontendPort":        5173,
        "maxFileSizeMb":       config.MaxFileSizeMB,
        "previewMaxFileSizeMb": 50,
        "lanUrl":              fmt.Sprintf("http://%s", lanIp),
    })
}
```

Respuesta de ejemplo:

```json
{
  "appName":              "SrvFiles",
  "lanIp":               "192.168.1.42",
  "port":                3001,
  "httpsPort":           3002,
  "frontendPort":        5173,
  "maxFileSizeMb":       10240,
  "previewMaxFileSizeMb": 50,
  "lanUrl":              "http://192.168.1.42"
}
```

### `frontendPort`

Hardcodeado a `5173` (puerto de Vite en desarrollo). El frontend lo usa para construir la URL del dev server cuando corre en modo desarrollo sin el backend embebido.

### `previewMaxFileSizeMb`

Límite para la previsualización de archivos en el navegador (imágenes, PDFs). Separado de `maxFileSizeMb` para evitar cargar archivos enormes en memoria del navegador al previsualizar.

### `lanUrl`

Solo HTTP (`http://`), sin puerto. Los clientes Flutter y Tauri lo usan como base URL para las llamadas al servidor HTTP (puerto 3001). El frontend web usa HTTPS directamente vía la URL de la barra del navegador.

---

## Ruta protegida

`/api/config` requiere autenticación. El frontend solo la llama después de hacer login exitoso con el PIN.
