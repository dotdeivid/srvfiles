//go:build !windows

package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseUserDirs(t *testing.T) {
	const home = "/home/ana"
	cases := map[string]string{
		"# comentario\nXDG_DESKTOP_DIR=\"$HOME/Escritorio\"\nXDG_DOWNLOAD_DIR=\"$HOME/Descargas\"\n": "/home/ana/Descargas",
		"XDG_DOWNLOAD_DIR=\"/datos/bajadas\"\n":                                                      "/datos/bajadas",
		"XDG_DOWNLOAD_DIR=\"$HOME/\"\n":                                                              "",
		"XDG_MUSIC_DIR=\"$HOME/Música\"\n":                                                           "",
	}
	for in, want := range cases {
		if got := parseUserDirs(bufio.NewScanner(strings.NewReader(in)), home); got != want {
			t.Errorf("parseUserDirs(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestXDGDownloadDirReadsUserDirsFile(t *testing.T) {
	home := t.TempDir()
	cfg := filepath.Join(home, "cfg")
	if err := os.MkdirAll(cfg, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cfg, "user-dirs.dirs"), []byte(`XDG_DOWNLOAD_DIR="$HOME/Descargas"`+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("XDG_DOWNLOAD_DIR", "")
	t.Setenv("XDG_CONFIG_HOME", cfg)
	if got := xdgDownloadDir(home); got != filepath.Join(home, "Descargas") {
		t.Fatalf("xdgDownloadDir = %q", got)
	}
}
