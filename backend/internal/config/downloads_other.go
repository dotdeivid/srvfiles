//go:build !windows

package config

import (
	"bufio"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// downloadsDir devuelve la carpeta Descargas del usuario, la misma que usa la
// app de escritorio:
//   - macOS: ~/Downloads (el Finder la traduce, pero el nombre real no cambia);
//   - Linux: XDG_DOWNLOAD_DIR de ~/.config/user-dirs.dirs, que en un sistema
//     en español suele ser ~/Descargas; si no está, ~/Downloads.
func downloadsDir() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return ""
	}
	if runtime.GOOS != "darwin" {
		if dir := xdgDownloadDir(home); dir != "" {
			return dir
		}
	}
	return filepath.Join(home, "Downloads")
}

// xdgDownloadDir lee XDG_DOWNLOAD_DIR de la variable de entorno o de
// $XDG_CONFIG_HOME/user-dirs.dirs (por defecto ~/.config/user-dirs.dirs).
func xdgDownloadDir(home string) string {
	if dir := os.Getenv("XDG_DOWNLOAD_DIR"); dir != "" {
		return expandHome(dir, home)
	}
	configHome := os.Getenv("XDG_CONFIG_HOME")
	if configHome == "" {
		configHome = filepath.Join(home, ".config")
	}
	f, err := os.Open(filepath.Join(configHome, "user-dirs.dirs"))
	if err != nil {
		return ""
	}
	defer f.Close()
	return parseUserDirs(bufio.NewScanner(f), home)
}

// parseUserDirs busca una línea XDG_DOWNLOAD_DIR="$HOME/Descargas".
func parseUserDirs(sc *bufio.Scanner, home string) string {
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		value, ok := strings.CutPrefix(line, "XDG_DOWNLOAD_DIR=")
		if !ok {
			continue
		}
		value = strings.Trim(value, `"`)
		// "$HOME/" a secas significa "sin carpeta de descargas".
		if value == "" || value == "$HOME" || value == "$HOME/" {
			return ""
		}
		return expandHome(value, home)
	}
	return ""
}

func expandHome(path, home string) string {
	if rest, ok := strings.CutPrefix(path, "$HOME"); ok {
		return filepath.Join(home, rest)
	}
	if rest, ok := strings.CutPrefix(path, "~/"); ok {
		return filepath.Join(home, rest)
	}
	return path
}
