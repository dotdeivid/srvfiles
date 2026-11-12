# announce/announce.go

**Archivo:** `backend/internal/announce/announce.go`
**Rol:** Anuncia el servidor por mDNS para que los teléfonos lo encuentren sin barrer la red.

---

`Start(port, httpsPort, lanIPs)` publica el servicio `_srvfiles._tcp` (con `github.com/hashicorp/mdns`):

- **Instancia:** el nombre del equipo; host `<equipo>.local.`, con las IPs de la red local.
- **TXT:** `app=srvfiles`, `deviceType=desktop`, `httpsPort=<puerto>`.
- **Validación:** el anuncio solo dice "acá hay un SrvFiles"; quien lo encuentra lo valida con `/api/health`.
- **Errores:** si falla (sin multicast, sin IPs), `main.go` registra un aviso y sigue; los clientes caen al barrido de la subred o a la IP escrita a mano.
- **Log:** el de la librería se descarta, porque va a stderr, que lee la app de escritorio.

Se puede comprobar en macOS con `dns-sd -B _srvfiles._tcp`.
