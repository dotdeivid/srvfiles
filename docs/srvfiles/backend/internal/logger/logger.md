# logger/logger.go

**Archivo:** `backend/internal/logger/logger.go`
**Rol:** Logger estructurado del backend.

---

Formato: `2026-01-01 12:00:00 INFO  [origen] mensaje — {"clave":"valor"}`.

- Archivo: solo WARN y ERROR, en `LOGS_DIR/errors.txt` (por defecto `./logs`). Rota a `errors.1.txt` al superar 2 MB.
- Consola: todos los niveles salvo con `APP_ENV=production`.
- Bajo `go test` no escribe en disco.
- Seguro para uso concurrente.

API: `logger.Log.Debug/Info/Warn/Error(origen, mensaje, clave, valor, …)`.
