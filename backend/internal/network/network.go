package network

import (
	"net"
	"strings"
	"sync"
	"time"
)

// cacheTTL: la IP se reutiliza unos segundos en lugar de recorrer las
// interfaces en cada petición.
const cacheTTL = 5 * time.Second

var (
	cacheMu    sync.Mutex
	cachedIP   string
	cachedNet  *net.IPNet
	cacheUntil time.Time
)

// GetLanIp returns the IPv4 of the interface used for the local network.
//
// Prefiere la interfaz de la ruta por defecto (no envía ningún paquete). Si no
// hay ruta, elige una dirección privada (RFC 1918) de una interfaz física,
// descartando loopback, link-local (169.254.x.x) e interfaces virtuales
// (Docker, VPN). Devuelve "localhost" si no encuentra ninguna.
func GetLanIp() string {
	ip, _ := lanAddr()
	return ip
}

// LanIPs returns every candidate LAN IPv4 address (for certificate SANs).
func LanIPs() []string {
	var out []string
	for _, c := range candidates() {
		out = append(out, c.ip.String())
	}
	return out
}

// GetSubnetIPs returns the host IPs to scan in the LAN subnet.
// Usa la máscara real, pero nunca más de una /24 alrededor de la IP propia.
// Returns nil when no external network interface is available.
func GetSubnetIPs() []string {
	ipStr, ipNet := lanAddr()
	if ipStr == "localhost" || ipNet == nil {
		return nil
	}
	ip := net.ParseIP(ipStr).To4()
	ones, _ := ipNet.Mask.Size()
	if ones < 24 {
		ones = 24
	}
	mask := net.CIDRMask(ones, 32)
	base := ip.Mask(mask)
	hostCount := 1<<(32-ones) - 2
	if hostCount <= 0 {
		return nil
	}
	ips := make([]string, 0, hostCount)
	for i := 1; i <= hostCount; i++ {
		h := make(net.IP, 4)
		copy(h, base)
		h[3] += byte(i)
		ips = append(ips, h.String())
	}
	return ips
}

func lanAddr() (string, *net.IPNet) {
	cacheMu.Lock()
	defer cacheMu.Unlock()
	if time.Now().Before(cacheUntil) {
		return cachedIP, cachedNet
	}

	cachedIP, cachedNet = "localhost", nil
	all := candidates()
	if routeIP := defaultRouteIP(); routeIP != nil {
		for _, c := range all {
			if c.ip.Equal(routeIP) {
				cachedIP, cachedNet = c.ip.String(), c.net
				break
			}
		}
	}
	if cachedNet == nil && len(all) > 0 {
		cachedIP, cachedNet = all[0].ip.String(), all[0].net
	}
	cacheUntil = time.Now().Add(cacheTTL)
	return cachedIP, cachedNet
}

// defaultRouteIP: dirección local que el sistema usaría para salir a internet.
// Un "dial" UDP no envía paquetes; solo resuelve la ruta.
func defaultRouteIP() net.IP {
	conn, err := net.Dial("udp4", "8.8.8.8:80")
	if err != nil {
		return nil
	}
	defer conn.Close()
	if addr, ok := conn.LocalAddr().(*net.UDPAddr); ok {
		return addr.IP.To4()
	}
	return nil
}

type candidate struct {
	ip  net.IP
	net *net.IPNet
}

var virtualPrefixes = []string{"docker", "br-", "veth", "vmnet", "vboxnet", "utun", "tun", "tap", "wg", "zt", "llw", "awdl", "bridge"}

func candidates() []candidate {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var out []candidate
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		name := strings.ToLower(iface.Name)
		virtual := false
		for _, p := range virtualPrefixes {
			if strings.HasPrefix(name, p) {
				virtual = true
				break
			}
		}
		if virtual {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ip4 := ipNet.IP.To4()
			if ip4 == nil || ip4.IsLoopback() || ip4.IsLinkLocalUnicast() || !ip4.IsPrivate() {
				continue
			}
			out = append(out, candidate{ip: ip4, net: ipNet})
		}
	}
	return out
}
