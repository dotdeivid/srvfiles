package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
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
)

// ─── State ────────────────────────────────────────────────────────────────────

var mu sync.RWMutex

var (
	pinHash   string
	pinPlain  string
	sessions  = make(map[string]struct{})
	rateLimit = make(map[string]*rateLimitEntry)
)

type rateLimitEntry struct {
	count        int
	blockedUntil time.Time
}

// ─── PIN ─────────────────────────────────────────────────────────────────────

// GeneratePin creates a random 6-digit PIN, stores its SHA-256 hash,
// and returns the plaintext PIN (shown once in the console).
// Equivalent to generatePin() in auth.service.ts.
func GeneratePin() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(900_000))
	pin := fmt.Sprintf("%06d", n.Int64()+100_000)

	h := sha256.Sum256([]byte(pin))

	mu.Lock()
	pinHash = hex.EncodeToString(h[:])
	pinPlain = pin
	mu.Unlock()

	return pin
}

// GetPin returns the current plaintext PIN.
// Only used by the /api/pin localhost endpoint.
func GetPin() string {
	mu.RLock()
	defer mu.RUnlock()
	return pinPlain
}

// ValidatePin checks whether input matches the stored PIN hash.
func ValidatePin(input string) bool {
	mu.RLock()
	hash := pinHash
	mu.RUnlock()
	if hash == "" {
		return false
	}
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:]) == hash
}

// ─── Sessions ────────────────────────────────────────────────────────────────

// CreateSession generates a new UUID v4 token and stores it in memory.
func CreateSession() string {
	token := newUUID()
	mu.Lock()
	sessions[token] = struct{}{}
	mu.Unlock()
	return token
}

// ValidateToken reports whether the given token corresponds to an active session.
func ValidateToken(token string) bool {
	if token == "" {
		return false
	}
	mu.RLock()
	_, ok := sessions[token]
	mu.RUnlock()
	return ok
}

// ─── Rate limiting ───────────────────────────────────────────────────────────

// CheckRateLimit returns true if the IP is currently blocked.
func CheckRateLimit(ip string) bool {
	mu.RLock()
	entry, ok := rateLimit[ip]
	mu.RUnlock()
	if !ok {
		return false
	}
	if time.Now().Before(entry.blockedUntil) {
		return true
	}
	mu.Lock()
	delete(rateLimit, ip)
	mu.Unlock()
	return false
}

// RecordFailedAttempt increments the failure counter for an IP.
// Blocks the IP for blockDuration after maxAttempts failures.
func RecordFailedAttempt(ip string) {
	mu.Lock()
	defer mu.Unlock()
	entry, ok := rateLimit[ip]
	if !ok {
		entry = &rateLimitEntry{}
		rateLimit[ip] = entry
	}
	entry.count++
	if entry.count >= maxAttempts {
		entry.blockedUntil = time.Now().Add(blockDuration)
		logger.Log.Warn("auth.service.go", "IP blocked due to too many failed PIN attempts",
			"ip", ip, "attempts", entry.count)
	} else {
		logger.Log.Warn("auth.service.go", "Failed PIN attempt recorded",
			"ip", ip, "count", entry.count)
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
	pinHash = ""
	pinPlain = ""
	sessions = make(map[string]struct{})
	rateLimit = make(map[string]*rateLimitEntry)
	mu.Unlock()
}

// ─── UUID v4 ─────────────────────────────────────────────────────────────────

func newUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40 // Version 4
	b[8] = (b[8] & 0x3f) | 0x80 // Variant 10
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
