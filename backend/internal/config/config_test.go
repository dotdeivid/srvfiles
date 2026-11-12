package config

import (
	"path/filepath"
	"testing"
)

func TestDefaultUploadsDirIsInsideDownloads(t *testing.T) {
	if dir := downloadsDir(); dir != "" {
		if got := defaultUploadsDir(); got != filepath.Join(dir, "SrvFiles") {
			t.Fatalf("defaultUploadsDir() = %q, want <downloads>/SrvFiles", got)
		}
	}
}

func TestEnvStrOverride(t *testing.T) {
	t.Setenv("UPLOADS_DIR", "/custom/uploads")
	if got := envStr("UPLOADS_DIR", "fallback"); got != "/custom/uploads" {
		t.Fatalf("envStr(UPLOADS_DIR) = %q", got)
	}
}
