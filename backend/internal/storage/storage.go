package storage

import (
	"os"
	"path/filepath"

	"srvfiles/internal/config"
	"srvfiles/internal/logger"
)

// Init ensures the uploads directory exists at startup.
func Init() {
	if err := os.MkdirAll(config.UploadsDir, 0755); err != nil {
		logger.Log.Warn("storage.go", "Failed to create primary uploads directory, falling back",
			"path", config.UploadsDir, "error", err)
		fallback := filepath.Join(".", "uploads")
		if errFb := os.MkdirAll(fallback, 0755); errFb == nil {
			config.UploadsDir = fallback
			logger.Log.Info("storage.go", "Using fallback uploads directory", "path", fallback)
			return
		}
		logger.Log.Error("storage.go", "Failed to create uploads directory",
			"path", config.UploadsDir, "error", err)
		return
	}
	logger.Log.Debug("storage.go", "Uploads directory ready", "path", config.UploadsDir)
}
