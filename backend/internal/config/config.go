package config

import (
	"os"
	"path/filepath"
	"strconv"
)

// ─── Server ──────────────────────────────────────────────────────────────────

var Port      = envInt("PORT", 3001)
var Host      = envStr("HOST", "0.0.0.0")
var HttpsPort = envInt("HTTPS_PORT", Port+1)

// ─── App ─────────────────────────────────────────────────────────────────────

var AppName = envStr("APP_NAME", "SrvFiles")

// ─── Files ───────────────────────────────────────────────────────────────────

var FrontendPort     = envInt("FRONTEND_PORT", 5173)
var MaxFileSizeMB    = envInt("MAX_FILE_SIZE_MB", 10240)
var MaxUploadCount   = envInt("MAX_UPLOAD_COUNT", 50)
var PreviewMaxSizeMB = envInt("PREVIEW_MAX_FILE_SIZE_MB", 1024)

// ─── Paths ───────────────────────────────────────────────────────────────────

var UploadsDir = envStr("UPLOADS_DIR", filepath.Join(".", "uploads"))
var CertsDir   = envStr("CERTS_DIR", filepath.Join(".", "certs"))

// ─── Helpers ─────────────────────────────────────────────────────────────────

func envStr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
