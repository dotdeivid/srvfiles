//go:build !embed

package main

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// newSPAHandler returns the file-system based SPA handler used during development.
// In production builds (go build -tags embed) spa_embed.go provides this function instead.
func newSPAHandler() http.Handler {
	return spaHandlerDir(frontendDistPath())
}

// spaHandlerDir serves static files from distDir with SPA fallback to index.html.
func spaHandlerDir(distDir string) http.Handler {
	fs         := http.Dir(distDir)
	fileServer := http.FileServer(fs)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Never intercept API routes — let chi return its own 404
		if strings.HasPrefix(r.URL.Path, "/api") {
			http.NotFound(w, r)
			return
		}
		f, err := fs.Open(r.URL.Path)
		if err != nil {
			// Path not found in dist — serve SPA shell for React Router
			http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
			return
		}
		f.Close()
		fileServer.ServeHTTP(w, r)
	})
}

// frontendDistPath resolves the path to the built React app relative to the binary.
func frontendDistPath() string {
	if exe, err := os.Executable(); err == nil {
		candidate := filepath.Join(filepath.Dir(exe), "..", "frontend", "dist")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return filepath.Join("..", "frontend", "dist")
}
