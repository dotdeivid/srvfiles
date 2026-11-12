package health

import (
	"encoding/json"
	"net/http"
	"time"

	"srvfiles/internal/config"
)

// Handler responds to GET /api/health. Public: lo usan el descubrimiento de
// red y la app móvil. "app" va en minúsculas; los clientes comparan sin
// distinguir mayúsculas.
func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":     "ok",
		"app":        "srvfiles",
		"appName":    config.AppName,
		"deviceType": "desktop",
		"port":       config.Port,
		"httpsPort":  config.HttpsPort,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}
