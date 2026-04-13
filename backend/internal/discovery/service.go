package discovery

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"srvfiles/internal/config"
	"srvfiles/internal/logger"
	"srvfiles/internal/network"
)

// ─── Types ────────────────────────────────────────────────────────────────────

type DiscoveredServer struct {
	IP      string `json:"ip"`
	URL     string `json:"url"`
	AppName string `json:"appName"`
}

// ─── Probe ────────────────────────────────────────────────────────────────────

// client is reused across all probeHost calls — one per scan, shared goroutines.
// Timeout of 500 ms matches the Node.js implementation exactly.
var probeClient = &http.Client{Timeout: 500 * time.Millisecond}

// probeHost sends GET /api/health to the given IP on the configured port.
// Returns a DiscoveredServer if the response identifies a SrvFiles instance,
// or nil otherwise. Never returns an error — failures are silent (same as Node.js).
func probeHost(ip string) *DiscoveredServer {
	url := fmt.Sprintf("http://%s:%d/api/health", ip, config.Port)
	resp, err := probeClient.Get(url)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	var body struct {
		Status  string `json:"status"`
		App     string `json:"app"`
		AppName string `json:"appName"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil
	}

	// Same check as discovery.service.ts:
	//   json.status === 'ok' && String(json.app).toLowerCase() === 'srvfiles'
	if body.Status != "ok" || body.App != "srvfiles" {
		return nil
	}

	appName := body.AppName
	if appName == "" {
		appName = "SrvFiles"
	}
	return &DiscoveredServer{
		IP:      ip,
		URL:     fmt.Sprintf("http://%s:%d", ip, config.Port),
		AppName: appName,
	}
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

// ScanNetwork probes all 254 hosts in the local /24 subnet in parallel,
// collects SrvFiles instances, and excludes the local machine.
// Equivalent to scanNetwork() in discovery.service.ts.
func ScanNetwork() []DiscoveredServer {
	ips := network.GetSubnetIPs()
	if len(ips) == 0 {
		logger.Log.Warn("discovery.service.go", "No subnet IPs available — skipping scan")
		return nil
	}

	localIp := network.GetLanIp()
	subnet := ips[0][:len(ips[0])-1] + "x" // e.g. "192.168.1.x" for logging
	logger.Log.Info("discovery.service.go", "Starting LAN scan",
		"subnet", subnet, "hostCount", len(ips))

	results := make(chan *DiscoveredServer, len(ips))
	var wg sync.WaitGroup

	for _, ip := range ips {
		wg.Add(1)
		go func(ip string) {
			defer wg.Done()
			results <- probeHost(ip)
		}(ip)
	}

	// Close the channel once all goroutines finish
	go func() {
		wg.Wait()
		close(results)
	}()

	var found []DiscoveredServer
	for server := range results {
		if server == nil || server.IP == localIp {
			continue
		}
		found = append(found, *server)
	}

	logger.Log.Info("discovery.service.go", "LAN scan complete", "found", len(found))
	return found
}
