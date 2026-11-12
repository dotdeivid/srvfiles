# network/network.go

**Archivo:** `backend/internal/network/network.go`
**Rol:** IP de la red local y rango a escanear.

---

- `GetLanIp()`: IPv4 de la interfaz de la ruta por defecto (un "dial" UDP que no envía paquetes). Si no hay ruta, la primera dirección privada (RFC 1918) de una interfaz física. Descarta loopback, link-local (169.254.x.x) e interfaces virtuales (Docker, VPN, `utun`, …). Devuelve `localhost` si no hay ninguna. Resultado cacheado 5 s.
- `LanIPs()`: todas las candidatas (para los SAN del certificado).
- `GetSubnetIPs()`: hosts de la subred con la máscara real, pero nunca más que una /24 alrededor de la IP propia.
