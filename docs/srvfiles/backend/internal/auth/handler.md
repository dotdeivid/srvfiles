# auth/handler.go

**Archivo:** `backend/internal/auth/handler.go`
**Rol:** Handlers HTTP de login y lectura local del PIN.

---

## `Login` — `POST /api/auth`

Body `{"pin": "123456"}` (máx. 1 KB). Respuestas: `200 {"token"}`, `400` sin PIN, `401` PIN incorrecto, `429` IP o servidor bloqueados. La IP es la del socket (`webguard.ClientIP`).

## `PinHandler` — `GET /api/pin`

Lo usa la app de escritorio (y el navegador en la misma máquina) para autenticarse sola y mostrar el PIN. Responde solo si:

- la conexión viene de loopback según la IP real del socket (`webguard.IsLoopback`), y
- el `Host` es un nombre local (`webguard.HasLocalHost`) — protege contra DNS rebinding.

Además el middleware CORS rechaza orígenes de navegador no permitidos. `Cache-Control: no-store`.
