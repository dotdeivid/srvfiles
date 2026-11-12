package auth

import (
	"encoding/json"
	"io"
	"net/http"

	"srvfiles/internal/logger"
	"srvfiles/internal/webguard"
)

// Login handles POST /api/auth.
// Body: { "pin": "123456" }
// Returns: { "token": "..." } or 400/401/429.
func Login(w http.ResponseWriter, r *http.Request) {
	ip := webguard.ClientIP(r)

	if CheckRateLimit(ip) {
		logger.Log.Warn("auth.handler.go", "Rate limited auth attempt", "ip", ip)
		writeJSON(w, http.StatusTooManyRequests,
			map[string]string{"error": "Demasiados intentos. Intentá de nuevo en 60 segundos."})
		return
	}

	var body struct {
		Pin string `json:"pin"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1024)).Decode(&body); err != nil || body.Pin == "" {
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

// PinHandler handles GET /api/pin. Lo usa la app de escritorio para
// autenticarse sola y mostrar el PIN.
//
// Solo responde si la conexión viene de esta máquina (IP real del socket) y
// el Host es un nombre de loopback (evita DNS rebinding). Además el
// middleware CORS rechaza orígenes de navegador no permitidos.
func PinHandler(w http.ResponseWriter, r *http.Request) {
	if !webguard.IsLoopback(r) || !webguard.HasLocalHost(r) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Forbidden"})
		return
	}
	pin := GetPin()
	if pin == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Server not ready"})
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]string{"pin": pin})
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

// writeJSON writes a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
