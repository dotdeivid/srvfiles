# health/handler.go

**Archivo:** `backend/internal/health/handler.go`
**Rol:** `GET /api/health`: identificación pública del servidor.

---

Devuelve `status: "ok"`, `app: "srvfiles"`, `appName`, `deviceType: "desktop"`, `port`, `httpsPort` y `timestamp`. Lo usan el descubrimiento de red (web y móvil) y los clientes para validar una dirección escrita a mano.
