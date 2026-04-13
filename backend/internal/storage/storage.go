package storage

import (
	"os"

	"srvfiles/internal/config"
	"srvfiles/internal/logger"
)

// Init ensures the uploads directory exists at startup.
// Equivalent to the MkdirSync call in infrastructure/storage.ts.
func Init() {
	if err := os.MkdirAll(config.UploadsDir, 0755); err != nil {
		logger.Log.Error("storage.go", "Failed to create uploads directory",
			"path", config.UploadsDir, "error", err)
		return
	}
	logger.Log.Debug("storage.go", "Uploads directory ready", "path", config.UploadsDir)
}
