package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"fmt"
	"math/big"
	"sync"
	"time"

	"srvfiles/internal/logger"
)

// ─── Constants ────────────────────────────────────────────────────────────────

const (
	maxAttempts   = 5
	blockDuration = 60 * time.Second

	// Límite global: con muchas IPs distintas (o falsificadas) igual se frena
	// la fuerza bruta sobre un PIN de 6 dígitos.
	maxGlobalFailures = 20
	globalWindow      = 60 * time.Second

	// Las sesiones vencen tras este tiempo sin uso.
	sessionTTL = 12 * time.Hour

	// Los tokens de enlace (descargas y vistas previas) valen para un solo
	// archivo y por poco tiempo.
	LinkTokenTTL = 10 * time.Minute
)

// ─── State ────────────────────────────────────────────────────────────────────

var mu sync.Mutex

var (
	pin                string // en memoria; se pierde al reiniciar
	sessions           = make(map[string]time.Time)
	rateLimit          = make(map[string]*rateLimitEntry)
	globalFailures     []time.Time
	globalBlockedUntil time.Time
	linkTokens         = make(map[string]linkToken)
)

type linkToken struct {
	filename string
	expiry   time.Time
}

type rateLimitEntry struct {
	count        int
	lastAttempt  time.Time
	blockedUntil time.Time
}

// now es reemplazable en tests.
var now = time.Now

// ─── PIN ─────────────────────────────────────────────────────────────────────

// GeneratePin creates a random 6-digit PIN, keeps it in memory and returns it
// (shown in the console and to the local app through /api/pin).
func GeneratePin() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(900_000))
	p := fmt.Sprintf("%06d", n.Int64()+100_000)

	mu.Lock()
	pin = p
	mu.Unlock()

	return p
}

// GetPin returns the current PIN. Only used by the loopback-only /api/pin.
func GetPin() string {
	mu.Lock()
	defer mu.Unlock()
	return pin
}

// ValidatePin checks input against the current PIN in constant time.
func ValidatePin(input string) bool {
	mu.Lock()
	current := pin
	mu.Unlock()
	if current == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(input), []byte(current)) == 1
}

// ─── Sessions ────────────────────────────────────────────────────────────────

// CreateSession generates a new random token and stores it in memory.
func CreateSession() string {
	token := NewID()
	mu.Lock()
	sessions[token] = now().Add(sessionTTL)
	mu.Unlock()
	return token
}

// ValidateToken reports whether token is an active session, and extends it.
func ValidateToken(token string) bool {
	if token == "" {
		return false
	}
	mu.Lock()
	defer mu.Unlock()
	expiry, ok := sessions[token]
	if !ok {
		return false
	}
	t := now()
	if t.After(expiry) {
		delete(sessions, token)
		return false
	}
	sessions[token] = t.Add(sessionTTL)
	return true
}

// ─── Link tokens ─────────────────────────────────────────────────────────────

// CreateLinkToken returns a token that authorizes GET downloads/previews of
// a single file for LinkTokenTTL. Se usa en URLs (<a>, <img>, <video>) en
// lugar del token de sesión, que nunca va en la URL. Puede usarse varias
// veces dentro del plazo (el video pide rangos sucesivos).
func CreateLinkToken(filename string) string {
	token := NewID()
	mu.Lock()
	defer mu.Unlock()
	t := now()
	for k, v := range linkTokens { // limpieza de vencidos
		if t.After(v.expiry) {
			delete(linkTokens, k)
		}
	}
	linkTokens[token] = linkToken{filename: filename, expiry: t.Add(LinkTokenTTL)}
	return token
}

// ValidateLinkToken reports whether token is valid for filename.
func ValidateLinkToken(token, filename string) bool {
	if token == "" {
		return false
	}
	mu.Lock()
	defer mu.Unlock()
	lt, ok := linkTokens[token]
	if !ok || now().After(lt.expiry) {
		delete(linkTokens, token)
		return false
	}
	return lt.filename == filename
}

// ─── Rate limiting ───────────────────────────────────────────────────────────

// CheckRateLimit returns true if the IP (or the whole server) is currently blocked.
func CheckRateLimit(ip string) bool {
	mu.Lock()
	defer mu.Unlock()
	t := now()
	if t.Before(globalBlockedUntil) {
		return true
	}
	entry, ok := rateLimit[ip]
	if !ok {
		return false
	}
	if t.Before(entry.blockedUntil) {
		return true
	}
	// Solo se olvida el contador cuando la ventana venció; antes, borrar la
	// entrada en cada comprobación impedía que se llegara al máximo.
	if t.Sub(entry.lastAttempt) > blockDuration {
		delete(rateLimit, ip)
	}
	return false
}

// RecordFailedAttempt increments the failure counters for an IP and globally.
// Blocks the IP for blockDuration after maxAttempts failures.
func RecordFailedAttempt(ip string) {
	mu.Lock()
	defer mu.Unlock()
	t := now()

	entry, ok := rateLimit[ip]
	if !ok {
		entry = &rateLimitEntry{}
		rateLimit[ip] = entry
	}
	entry.count++
	entry.lastAttempt = t
	if entry.count >= maxAttempts {
		entry.blockedUntil = t.Add(blockDuration)
		entry.count = 0
		logger.Log.Warn("auth.service.go", "IP blocked due to too many failed PIN attempts", "ip", ip)
	} else {
		logger.Log.Warn("auth.service.go", "Failed PIN attempt recorded", "ip", ip, "count", entry.count)
	}

	kept := globalFailures[:0]
	for _, f := range globalFailures {
		if t.Sub(f) <= globalWindow {
			kept = append(kept, f)
		}
	}
	globalFailures = append(kept, t)
	if len(globalFailures) >= maxGlobalFailures {
		globalBlockedUntil = t.Add(blockDuration)
		globalFailures = nil
		logger.Log.Warn("auth.service.go", "Too many failed PIN attempts overall — login paused")
	}
}

// ClearFailedAttempts removes the rate limit record for an IP.
func ClearFailedAttempts(ip string) {
	mu.Lock()
	delete(rateLimit, ip)
	mu.Unlock()
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

// ResetAuth clears all PIN, session, and rate limit state.
// Called on server shutdown so a fresh PIN is required on restart.
func ResetAuth() {
	mu.Lock()
	pin = ""
	sessions = make(map[string]time.Time)
	rateLimit = make(map[string]*rateLimitEntry)
	globalFailures = nil
	globalBlockedUntil = time.Time{}
	linkTokens = make(map[string]linkToken)
	mu.Unlock()
}

// ─── IDs ─────────────────────────────────────────────────────────────────────

// NewID returns a random UUID v4. Shared by sessions and WebSocket clients.
func NewID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40 // Version 4
	b[8] = (b[8] & 0x3f) | 0x80 // Variant 10
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
