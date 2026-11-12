package storage

import (
	"os"
	"path/filepath"
	"testing"

	"srvfiles/internal/config"
)

func TestStorageInitCreatesDirectory(t *testing.T) {
	tmp := t.TempDir()
	target := filepath.Join(tmp, "nested", "uploads")
	old := config.UploadsDir
	config.UploadsDir = target
	t.Cleanup(func() {
		config.UploadsDir = old
	})

	Init()

	info, err := os.Stat(target)
	if err != nil {
		t.Fatalf("Storage directory was not created: %v", err)
	}
	if !info.IsDir() {
		t.Fatalf("Storage target is not a directory")
	}
}
