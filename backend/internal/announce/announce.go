// Package announce anuncia el servidor por mDNS como "_srvfiles._tcp".
//
// Los teléfonos buscan ese servicio (Android NSD / iOS Bonjour) en lugar de
// barrer la subred con 254 peticiones HTTP. El anuncio solo dice "acá hay un
// SrvFiles en este puerto": quien lo encuentra lo valida con /api/health.
package announce

import (
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"strings"

	"github.com/hashicorp/mdns"
)

// ServiceType es el mismo que buscan y anuncian las apps móviles.
const ServiceType = "_srvfiles._tcp"

// Start anuncia el servidor en port para las IPs dadas. Devuelve la función
// que detiene el anuncio. Un error (sin multicast, puerto 5353 ocupado por
// otro respondedor que no comparte) no impide usar SrvFiles: los clientes
// caen al barrido de la subred o a la IP escrita a mano.
func Start(port, httpsPort int, lanIPs []string) (stop func(), err error) {
	host, _ := os.Hostname()
	host = strings.TrimSuffix(host, ".local")
	if host == "" {
		host = "srvfiles"
	}
	var ips []net.IP
	for _, s := range lanIPs {
		if ip := net.ParseIP(s); ip != nil {
			ips = append(ips, ip)
		}
	}
	if len(ips) == 0 {
		return nil, fmt.Errorf("sin IPs de red local para anunciar")
	}
	txt := []string{"app=srvfiles", "deviceType=desktop", fmt.Sprintf("httpsPort=%d", httpsPort)}
	svc, err := mdns.NewMDNSService(host, ServiceType, "", host+".local.", port, ips, txt)
	if err != nil {
		return nil, err
	}
	server, err := mdns.NewServer(&mdns.Config{
		Zone:   svc,
		Logger: log.New(io.Discard, "", 0), // su log va a stderr, que lee la app de escritorio
	})
	if err != nil {
		return nil, err
	}
	return func() { _ = server.Shutdown() }, nil
}
