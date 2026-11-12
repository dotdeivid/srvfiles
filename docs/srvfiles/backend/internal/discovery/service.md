# discovery/service.go

**Archivo:** `backend/internal/discovery/service.go`
**Rol:** Escaneo de la red local en busca de otros servidores SrvFiles.

---

- `ScanNetwork()` prueba `GET http://<ip>:<PORT>/api/health` en las IPs de `network.GetSubnetIPs()` (excepto la propia) con **64 peticiones simultáneas** y timeout de 500 ms.
- Escaneos simultáneos comparten el mismo barrido y el resultado se cachea 10 s.
- `probeHost()` acepta respuestas con `status: "ok"` y `app` igual a `srvfiles` sin distinguir mayúsculas; lee como máximo 16 KB. Descarta los teléfonos en modo relay sin modo servidor (`relay: true`, `serverMode: false`), que no tienen archivos que explorar.
- `DiscoveredServer`: `ip`, `url`, `appName`, `httpsPort` (para abrir la web del otro servidor por HTTPS).
