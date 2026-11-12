package discovery

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"srvfiles/internal/config"
	"srvfiles/internal/logger"
	"srvfiles/internal/network"
)

// ─── Types ────────────────────────────────────────────────────────────────────

type DiscoveredServer struct {
	IP        string `json:"ip"`
	URL       string `json:"url"`
	AppName   string `json:"appName"`
	HttpsPort int    `json:"httpsPort,omitempty"`
}

// ─── Probe ────────────────────────────────────────────────────────────────────

const (
	probeTimeout     = 500 * time.Millisecond
	scanConcurrency  = 64
	resultCacheTTL   = 10 * time.Second
	maxHealthBodyLen = 16 * 1024
)

var probeClient = &http.Client{Timeout: probeTimeout}

// probeHost sends GET /api/health to the given IP on the configured port.
// Returns a DiscoveredServer if the response identifies a SrvFiles server
// with files to browse, or nil otherwise. Failures are silent.
func probeHost(ip string) *DiscoveredServer {
	url := fmt.Sprintf("http://%s:%d/api/health", ip, config.Port)
	resp, err := probeClient.Get(url)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil
	}

	var body struct {
		Status     string `json:"status"`
		App        string `json:"app"`
		AppName    string `json:"appName"`
		HttpsPort  int    `json:"httpsPort"`
		Relay      bool   `json:"relay"`
		ServerMode bool   `json:"serverMode"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxHealthBodyLen)).Decode(&body); err != nil {
		return nil
	}

	if body.Status != "ok" || !strings.EqualFold(body.App, "srvfiles") {
		return nil
	}
	// Un teléfono en modo relay (sin modo servidor) no tiene archivos que explorar.
	if body.Relay && !body.ServerMode {
		return nil
	}

	appName := body.AppName
	if appName == "" {
		appName = "SrvFiles"
	}
	return &DiscoveredServer{
		IP:        ip,
		URL:       fmt.Sprintf("http://%s:%d", ip, config.Port),
		AppName:   appName,
		HttpsPort: body.HttpsPort,
	}
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

var (
	scanMu      sync.Mutex
	inFlight    *scanResult
	cached      []DiscoveredServer
	cachedUntil time.Time
)

type scanResult struct {
	done    chan struct{}
	servers []DiscoveredServer
}

// ScanNetwork probes the hosts of the local subnet with limited concurrency,
// collects SrvFiles servers and excludes the local machine.
//
// Escaneos simultáneos comparten el mismo barrido y el resultado se cachea
// unos segundos, para que varias pestañas no multipliquen el tráfico.
func ScanNetwork() []DiscoveredServer {
	scanMu.Lock()
	if time.Now().Before(cachedUntil) {
		out := append([]DiscoveredServer(nil), cached...)
		scanMu.Unlock()
		return out
	}
	if inFlight != nil {
		res := inFlight
		scanMu.Unlock()
		<-res.done
		return append([]DiscoveredServer(nil), res.servers...)
	}
	res := &scanResult{done: make(chan struct{})}
	inFlight = res
	scanMu.Unlock()

	res.servers = scan()

	scanMu.Lock()
	cached = res.servers
	cachedUntil = time.Now().Add(resultCacheTTL)
	inFlight = nil
	scanMu.Unlock()
	close(res.done)
	return append([]DiscoveredServer(nil), res.servers...)
}

func scan() []DiscoveredServer {
	ips := network.GetSubnetIPs()
	if len(ips) == 0 {
		logger.Log.Warn("discovery.service.go", "No subnet IPs available — skipping scan")
		return nil
	}

	localIp := network.GetLanIp()
	logger.Log.Info("discovery.service.go", "Starting LAN scan", "hostCount", len(ips))

	jobs := make(chan string)
	results := make(chan *DiscoveredServer, len(ips))
	var wg sync.WaitGroup
	for i := 0; i < scanConcurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for ip := range jobs {
				results <- probeHost(ip)
			}
		}()
	}
	for _, ip := range ips {
		if ip != localIp {
			jobs <- ip
		}
	}
	close(jobs)
	wg.Wait()
	close(results)

	var found []DiscoveredServer
	for server := range results {
		if server != nil {
			found = append(found, *server)
		}
	}
	sort.Slice(found, func(i, j int) bool { return found[i].IP < found[j].IP })

	logger.Log.Info("discovery.service.go", "LAN scan complete", "found", len(found))
	return found
}
