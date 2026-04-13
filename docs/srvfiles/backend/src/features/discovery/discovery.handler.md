# discovery/handler.go

**Archivo:** `internal/discovery/handler.go`
**Rol:** Handler HTTP que expone el escáner de descubrimiento de red.

---

## `Handler` — `GET /api/discovery/scan`

```go
func Handler(w http.ResponseWriter, r *http.Request) {
    servers := ScanNetwork()
    w.Header().Set("Content-Type", "application/json")
    if err := json.NewEncoder(w).Encode(servers); err != nil {
        logger.Log.Error("discovery.handler.go", "Failed to encode response", "error", err)
    }
}
```

Llama `ScanNetwork()` de forma síncrona. La respuesta puede tardar hasta ~500 ms (el timeout del sondeo). El frontend muestra un spinner mientras espera.

Siempre responde con un array JSON (nunca `null`): si no hay ningún servidor en la red, devuelve `[]`.

---

## Ruta protegida

`/api/discovery/scan` requiere autenticación. Solo los clientes autenticados pueden escanear la red.
