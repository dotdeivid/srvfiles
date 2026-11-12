package auth

import (
	"net/http"
	"net/url"
	"path"

	"srvfiles/internal/logger"
	"srvfiles/internal/webguard"
)

// RequireAuth validates the session token from the X-SrvFiles-Token header.
// El token de sesión nunca se acepta en la URL.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ValidateToken(r.Header.Get("X-SrvFiles-Token")) {
			next.ServeHTTP(w, r)
			return
		}
		unauthorized(w, r)
	})
}

// RequireAuthOrLink is for GET downloads/previews: accepts the session header
// or a link token (?dl=) issued for exactly the file in the URL.
func RequireAuthOrLink(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ValidateToken(r.Header.Get("X-SrvFiles-Token")) {
			next.ServeHTTP(w, r)
			return
		}
		if r.Method == http.MethodGet {
			name, err := url.PathUnescape(path.Base(r.URL.EscapedPath()))
			if err == nil && ValidateLinkToken(r.URL.Query().Get("dl"), name) {
				next.ServeHTTP(w, r)
				return
			}
		}
		unauthorized(w, r)
	})
}

func unauthorized(w http.ResponseWriter, r *http.Request) {
	logger.Log.Warn("auth.middleware.go", "Unauthorized request — invalid or missing token",
		"ip", webguard.ClientIP(r), "path", r.URL.Path)
	writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
}
