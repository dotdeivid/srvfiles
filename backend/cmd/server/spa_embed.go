//go:build embed

package main

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

// frontendAssets holds the compiled React app bundled into the binary.
// The "frontend/dist" directory is created by the build script (copied from ../../frontend/dist).
//
//go:embed frontend/dist
var frontendAssets embed.FS

// newSPAHandler returns an http.Handler that serves the embedded frontend with SPA fallback.
// Replaces the file-system variant in spa_dev.go when built with -tags embed.
func newSPAHandler() http.Handler {
	// Strip the "frontend/dist" prefix so paths like /index.html work correctly.
	sub, err := fs.Sub(frontendAssets, "frontend/dist")
	if err != nil {
		// Should never happen since the embed path is fixed at compile time.
		panic("embed: failed to sub frontend/dist: " + err.Error())
	}
	fileServer := http.FileServerFS(sub)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Never intercept API routes
		if strings.HasPrefix(r.URL.Path, "/api") {
			http.NotFound(w, r)
			return
		}

		// Try to open the requested path in the embedded FS
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		f, err := sub.Open(path)
		if err != nil {
			// Not found — serve index.html for React Router to handle
			index, err := sub.Open("index.html")
			if err != nil {
				http.NotFound(w, r)
				return
			}
			index.Close()
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/index.html"
			fileServer.ServeHTTP(w, r2)
			return
		}
		f.Close()
		fileServer.ServeHTTP(w, r)
	})
}
