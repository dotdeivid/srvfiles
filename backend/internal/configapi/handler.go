package configapi

import (
	"encoding/json"
	"fmt"
	"net/http"

	"srvfiles/internal/config"
	"srvfiles/internal/network"
)

// Handler handles GET /api/config.
// Returns the app configuration needed by the frontend.
func Handler(w http.ResponseWriter, r *http.Request) {
	lanIp := network.GetLanIp()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"appName":              config.AppName,
		"lanIp":                lanIp,
		"port":                 config.Port,
		"httpsPort":            config.HttpsPort,
		"frontendPort":         config.FrontendPort,
		"maxFileSizeMb":        config.MaxFileSizeMB,
		"maxUploadCount":       config.MaxUploadCount,
		"previewMaxFileSizeMb": config.PreviewMaxSizeMB,
		"lanUrl":               fmt.Sprintf("http://%s:%d", lanIp, config.Port),
	})
}
