package health

import (
	"encoding/json"
	"net/http"
	"time"

	"srvfiles/internal/config"
)

// Handler responds to GET /api/health.
// The "app" field is lowercase "srvfiles" — the discovery service does a
// case-insensitive check (.toLowerCase() === 'srvfiles'), so both work.
func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":    "ok",
		"app":       "srvfiles",
		"appName":   config.AppName,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}
