# discovery.api.ts

**Archivo:** `frontend/src/features/server/discovery.api.ts`
**Rol:** Escaneo de servidores en la LAN.

---

`scanNetwork(localUrl)` → `GET /api/discovery/scan` al backend local con su token. `DiscoveredServer`: `ip`, `url`, `appName`, `httpsPort`.
