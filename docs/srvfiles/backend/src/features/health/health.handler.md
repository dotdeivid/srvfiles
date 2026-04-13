# health/handler.go

**Archivo:** `internal/health/handler.go`
**Rol:** Handler HTTP para el endpoint de salud. Lo usan el escáner de descubrimiento y los clientes para verificar que el servidor es una instancia de SrvFiles.

---

## `Handler` — `GET /api/health`

```go
func Handler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "status":    "ok",
        "app":       "srvfiles",
        "appName":   config.AppName,
        "timestamp": time.Now().UTC().Format(time.RFC3339),
    })
}
```

Respuesta de ejemplo:

```json
{
  "status":    "ok",
  "app":       "srvfiles",
  "appName":   "SrvFiles",
  "timestamp": "2026-04-03T14:00:00Z"
}
```

### Campo `app`

El campo `app` es **siempre** `"srvfiles"` en minúsculas. El escáner de descubrimiento (`discovery.service.go`) verifica:

```go
strings.ToLower(health["app"]) == "srvfiles"
```

Esto identifica inequívocamente una instancia de SrvFiles frente a otros servidores HTTP que puedan estar corriendo en la red local.

### Campo `appName`

`appName` es el nombre configurable vía `APP_NAME` (por defecto `"SrvFiles"`). La UI lo usa para mostrarlo en el banner y en la lista de dispositivos descubiertos.

---

## Ruta pública

`/api/health` no requiere autenticación para que el escáner de red pueda sondearlo sin token. Está registrada fuera del grupo protegido en `main.go`.
