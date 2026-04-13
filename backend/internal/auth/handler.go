package auth

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"

	"srvfiles/internal/logger"
)

// Login handles POST /api/auth.
// Body: { "pin": "123456" }
// Returns: { "token": "..." } or 400/401/429.
func Login(w http.ResponseWriter, r *http.Request) {
	ip := normalizeIP(r)

	if CheckRateLimit(ip) {
		logger.Log.Warn("auth.handler.go", "Rate limited auth attempt", "ip", ip)
		writeJSON(w, http.StatusTooManyRequests,
			map[string]string{"error": "Demasiados intentos. Intentá de nuevo en 60 segundos."})
		return
	}

	var body struct {
		Pin string `json:"pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Pin == "" {
		logger.Log.Warn("auth.handler.go", "Auth attempt with missing PIN", "ip", ip)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "PIN requerido"})
		return
	}

	if ValidatePin(body.Pin) {
		ClearFailedAttempts(ip)
		token := CreateSession()
		logger.Log.Info("auth.handler.go", "Auth successful, session created", "ip", ip)
		writeJSON(w, http.StatusOK, map[string]string{"token": token})
	} else {
		RecordFailedAttempt(ip)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "PIN incorrecto"})
	}
}

// PinHandler handles GET /api/pin.
// Only responds to connections coming from localhost (used by Tauri IPC).
func PinHandler(w http.ResponseWriter, r *http.Request) {
	ip := normalizeIP(r)
	if ip != "127.0.0.1" && ip != "::1" && ip != "" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Forbidden"})
		return
	}
	pin := GetPin()
	if pin == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Server not ready"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"pin": pin})
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

// normalizeIP extracts and normalizes the client IP from the request.
// Strips ::ffff: prefix (IPv4-mapped IPv6) and normalizes ::1 to 127.0.0.1.
func normalizeIP(r *http.Request) string {
	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	ip = strings.TrimPrefix(ip, "::ffff:")
	if ip == "::1" {
		ip = "127.0.0.1"
	}
	return ip
}

// writeJSON writes a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
