# network.go

**Archivo:** `internal/network/network.go`
**Rol:** Utilidades de red: detecta la IP LAN del servidor y genera la lista de IPs del subnet /24 para el escáner de descubrimiento.

---

## `GetLanIp`

```go
func GetLanIp() string {
    ifaces, _ := net.Interfaces()
    for _, iface := range ifaces {
        if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
            continue
        }
        addrs, _ := iface.Addrs()
        for _, addr := range addrs {
            var ip net.IP
            switch v := addr.(type) {
            case *net.IPNet:  ip = v.IP
            case *net.IPAddr: ip = v.IP
            }
            if ip == nil || ip.IsLoopback() || ip.To4() == nil {
                continue
            }
            return ip.String()
        }
    }
    return "127.0.0.1"
}
```

Itera todas las interfaces de red del sistema. Descarta:
- Interfaces de loopback (`127.x.x.x`, `::1`)
- Interfaces que no están activas (`FlagUp`)
- Direcciones IPv6

Devuelve la primera IPv4 no-loopback que encuentre. Si no hay ninguna (máquina sin red), devuelve `127.0.0.1` como fallback.

---

## `GetSubnetIPs`

```go
func GetSubnetIPs() []string {
    lanIp := GetLanIp()
    parts := strings.Split(lanIp, ".")
    if len(parts) != 4 {
        return nil
    }
    prefix := strings.Join(parts[:3], ".")
    ips := make([]string, 0, 254)
    for i := 1; i <= 254; i++ {
        ips = append(ips, fmt.Sprintf("%s.%d", prefix, i))
    }
    return ips
}
```

Construye la lista de las 254 IPs del subnet /24 (`.1` a `.254`) tomando los tres primeros octetos de `GetLanIp()`. Usado por `discovery.ScanNetwork()` para saber qué IPs sondear.

Por ejemplo, si `GetLanIp()` devuelve `192.168.1.42`, genera `["192.168.1.1", ..., "192.168.1.254"]`.
