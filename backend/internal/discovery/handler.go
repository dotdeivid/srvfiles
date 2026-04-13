package discovery

import (
	"encoding/json"
	"net/http"

	"srvfiles/internal/logger"
)

// Handler handles GET /api/discovery/scan.
// Equivalent to scan() in discovery.controller.ts.
func Handler(w http.ResponseWriter, r *http.Request) {
	servers := ScanNetwork()
	if servers == nil {
		servers = []DiscoveredServer{} // always return an array, never null
	}

	logger.Log.Debug("discovery.handler.go", "Scan request completed", "found", len(servers))

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(servers)
}
