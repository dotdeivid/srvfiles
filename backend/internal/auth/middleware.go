package auth

import (
	"net/http"

	"srvfiles/internal/logger"
)

// RequireAuth is a middleware that validates the session token.
// Token is read from the X-SrvFiles-Token header or the ?token query param.
// Equivalent to requireAuth in auth.middleware.ts.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("X-SrvFiles-Token")
		if token == "" {
			token = r.URL.Query().Get("token")
		}

		if ValidateToken(token) {
			next.ServeHTTP(w, r)
			return
		}

		ip := normalizeIP(r)
		logger.Log.Warn("auth.middleware.go", "Unauthorized request — invalid or missing token",
			"ip", ip, "path", r.URL.Path)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	})
}
