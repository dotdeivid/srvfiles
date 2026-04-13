package network

import (
	"fmt"
	"net"
)

// GetLanIp returns the first non-loopback IPv4 address found on the system.
// Falls back to "localhost" if no external interface is available.
func GetLanIp() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "localhost"
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() {
				continue
			}
			if ip4 := ip.To4(); ip4 != nil {
				return ip4.String()
			}
		}
	}
	return "localhost"
}

// GetSubnetIPs returns all 254 host IPs in the same /24 subnet as the LAN IP.
// Returns nil when no external network interface is available.
func GetSubnetIPs() []string {
	lanIp := GetLanIp()
	if lanIp == "localhost" {
		return nil
	}
	ip := net.ParseIP(lanIp).To4()
	if ip == nil {
		return nil
	}
	subnet := fmt.Sprintf("%d.%d.%d", ip[0], ip[1], ip[2])
	ips := make([]string, 254)
	for i := range ips {
		ips[i] = fmt.Sprintf("%s.%d", subnet, i+1)
	}
	return ips
}
