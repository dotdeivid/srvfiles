# discovery/service.go

**Archivo:** `internal/discovery/service.go`
**Rol:** Escanea la red local /24 en paralelo para descubrir otras instancias de SrvFiles. Equivalente a `discovery.service.ts` del backend Node.js.

---

## `ScanNetwork`

```go
func ScanNetwork() []DiscoveredServer {
    ips    := network.GetSubnetIPs()
    selfIp := network.GetLanIp()

    results := make(chan DiscoveredServer, len(ips))
    var wg sync.WaitGroup

    for _, ip := range ips {
        if ip == selfIp {
            continue // no reportarse a sí mismo
        }
        wg.Add(1)
        go func(ip string) {
            defer wg.Done()
            if s := probeHost(ip); s != nil {
                results <- *s
            }
        }(ip)
    }

    wg.Wait()
    close(results)

    servers := make([]DiscoveredServer, 0)
    for s := range results {
        servers = append(servers, s)
    }
    return servers
}
```

Lanza 254 goroutines en paralelo (una por IP del subnet). Cada goroutine es independiente — no hay pool ni semáforo porque 254 goroutines simultáneas son triviales para el scheduler de Go (cada goroutine usa ~2 KB de stack inicial).

`sync.WaitGroup` espera a que todas terminen antes de drenar el canal. El canal es buffered con capacidad `len(ips)` para que las goroutines no bloqueen al escribir.

---

## `probeHost`

```go
var probeClient = &http.Client{
    Timeout: 500 * time.Millisecond,
    Transport: &http.Transport{
        TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
    },
}

func probeHost(ip string) *DiscoveredServer {
    url  := fmt.Sprintf("http://%s:%d/api/health", ip, config.Port)
    resp, err := probeClient.Get(url)
    if err != nil { return nil }
    defer resp.Body.Close()

    var health map[string]string
    if json.NewDecoder(resp.Body).Decode(&health) != nil { return nil }

    if health["status"] != "ok" || strings.ToLower(health["app"]) != "srvfiles" {
        return nil
    }

    return &DiscoveredServer{
        IP:      ip,
        AppName: health["appName"],
        Port:    config.Port,
    }
}
```

Timeout de 500 ms: tiempo suficiente para una red LAN, suficientemente corto para que el scan de 254 IPs no bloquee la UI más de ~500 ms (las goroutines corren en paralelo, no en serie).

`InsecureSkipVerify: true` es necesario para aceptar el certificado autofirmado del servidor HTTPS remoto. Solo se usa para el sondeo de descubrimiento, no para la comunicación real de datos.

La verificación `strings.ToLower(health["app"]) == "srvfiles"` identifica inequívocamente una instancia de SrvFiles frente a otros servidores HTTP en la red.
