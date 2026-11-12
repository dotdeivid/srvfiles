# webguard/webguard.go

**Archivo:** `backend/internal/webguard/webguard.go`
**Rol:** Decide qué orígenes de navegador pueden usar la API y qué peticiones vienen de esta máquina.

---

El servidor no está detrás de un proxy: la IP del cliente es siempre la del socket. Nunca se confía en `X-Forwarded-For` ni `X-Real-IP`.

| Función | Qué hace |
|---|---|
| `ClientIP(r)` | IP del socket normalizada (`::ffff:` fuera, `::1` → `127.0.0.1`). |
| `IsLoopback(r)` | La conexión viene de esta máquina. |
| `HasLocalHost(r)` | `Host` es `localhost`, `127.0.0.1`, `::1` o `tauri.localhost`. |
| `AllowedOrigin(r)` | Sin `Origin` (apps nativas, curl); mismo origen que la página (`Origin` host == `Host`); app de escritorio (`tauri://localhost`, `http(s)://tauri.localhost`); Vite en `localhost:5173`. Lo usa también el WebSocket (`CheckOrigin`). |
| `CORS` | Responde preflights y pone las cabeceras CORS solo para orígenes permitidos; los demás reciben 403, así una web cualquiera abierta en el navegador no puede usar la API local. |
| `SecurityHeaders` | `X-Content-Type-Options: nosniff` y `Referrer-Policy: no-referrer` en todas las respuestas. |
