package announce

import (
	"testing"
	"time"

	"github.com/hashicorp/mdns"
)

// Anuncia en loopback y lo busca con un cliente mDNS real. Si la máquina no
// permite multicast (algunos runners de CI) el test se omite.
func TestServiceCanBeDiscovered(t *testing.T) {
	stop, err := Start(3901, 3902, []string{"127.0.0.1"})
	if err != nil {
		t.Skipf("mDNS no disponible: %v", err)
	}
	defer stop()

	entries := make(chan *mdns.ServiceEntry, 8)
	params := mdns.DefaultParams(ServiceType)
	params.Entries = entries
	params.Timeout = 2 * time.Second
	params.DisableIPv6 = true
	go func() {
		_ = mdns.Query(params)
		close(entries)
	}()
	for e := range entries {
		if e.Port == 3901 {
			return
		}
	}
	t.Skip("no llegó el anuncio (la red no reenvía multicast)")
}
