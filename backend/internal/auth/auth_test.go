package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func setup(t *testing.T) {
	t.Helper()
	ResetAuth()
	t.Cleanup(func() {
		ResetAuth()
		now = time.Now
	})
}

func login(t *testing.T, ip, pin string) int {
	t.Helper()
	b, _ := json.Marshal(map[string]string{"pin": pin})
	req := httptest.NewRequest(http.MethodPost, "/api/auth", bytes.NewReader(b))
	req.RemoteAddr = ip + ":9999"
	rr := httptest.NewRecorder()
	Login(rr, req)
	return rr.Code
}

func TestPinValidation(t *testing.T) {
	setup(t)
	if ValidatePin("123456") {
		t.Fatal("no PIN generated yet: must reject")
	}
	pin := GeneratePin()
	if len(pin) != 6 || !ValidatePin(pin) || ValidatePin("000000") || ValidatePin(pin+" ") {
		t.Fatalf("PIN %q validation is wrong", pin)
	}
}

// Regresión: CheckRateLimit borraba la entrada en cada comprobación y el
// bloqueo nunca se activaba.
func TestRateLimitBlocksAfterMaxAttemptsAndExpires(t *testing.T) {
	setup(t)
	pin := GeneratePin()
	clock := time.Now()
	now = func() time.Time { return clock }

	for i := 0; i < maxAttempts; i++ {
		if code := login(t, "10.0.0.1", "000000"); code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: status %d, want 401", i+1, code)
		}
	}
	if code := login(t, "10.0.0.1", pin); code != http.StatusTooManyRequests {
		t.Fatalf("after %d failures even the right PIN must get 429, got %d", maxAttempts, code)
	}
	if code := login(t, "10.0.0.2", pin); code != http.StatusOK {
		t.Fatalf("another IP must not be blocked, got %d", code)
	}

	clock = clock.Add(blockDuration + time.Second)
	if code := login(t, "10.0.0.1", pin); code != http.StatusOK {
		t.Fatalf("block must expire, got %d", code)
	}
}

func TestGlobalRateLimitAcrossIPs(t *testing.T) {
	setup(t)
	pin := GeneratePin()
	for i := 0; i < maxGlobalFailures; i++ {
		ip := "10.1.0." + string(rune('a'+i%26)) // IPs distintas, nunca el máximo por IP
		login(t, ip, "000000")
	}
	if code := login(t, "10.9.9.9", pin); code != http.StatusTooManyRequests {
		t.Fatalf("global limit must pause logins, got %d", code)
	}
}

func TestSessionsExpireAndRequireHeader(t *testing.T) {
	setup(t)
	clock := time.Now()
	now = func() time.Time { return clock }
	token := CreateSession()

	protected := RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	call := func(target string, header bool) int {
		req := httptest.NewRequest(http.MethodGet, target, nil)
		if header {
			req.Header.Set("X-SrvFiles-Token", token)
		}
		rr := httptest.NewRecorder()
		protected.ServeHTTP(rr, req)
		return rr.Code
	}

	if call("/x", true) != http.StatusOK {
		t.Fatal("valid header token rejected")
	}
	if call("/x?token="+token, false) != http.StatusUnauthorized {
		t.Fatal("the session token must never be accepted in the URL")
	}

	clock = clock.Add(sessionTTL + time.Minute)
	if call("/x", true) != http.StatusUnauthorized {
		t.Fatal("expired session must be rejected")
	}
}

// Los enlaces de descarga llevan un token propio: un solo archivo, pocos minutos.
func TestLinkTokensAreScopedToOneFileAndExpire(t *testing.T) {
	setup(t)
	clock := time.Now()
	now = func() time.Time { return clock }
	link := CreateLinkToken("año.pdf")

	h := RequireAuthOrLink(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	call := func(target string) int {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, target, nil))
		return rr.Code
	}

	if call("/api/files/download/a%C3%B1o.pdf?dl="+link) != http.StatusOK {
		t.Fatal("link token must open its own file")
	}
	if call("/api/files/download/otro.pdf?dl="+link) != http.StatusUnauthorized {
		t.Fatal("link token must not open other files")
	}
	clock = clock.Add(LinkTokenTTL + time.Second)
	if call("/api/files/download/a%C3%B1o.pdf?dl="+link) != http.StatusUnauthorized {
		t.Fatal("expired link token must be rejected")
	}
}

func TestPinHandlerOnlyForLoopbackAndLocalHost(t *testing.T) {
	setup(t)
	pin := GeneratePin()
	get := func(remote, host, xff string) (int, string) {
		req := httptest.NewRequest(http.MethodGet, "/api/pin", nil)
		req.RemoteAddr = remote
		req.Host = host
		if xff != "" {
			req.Header.Set("X-Forwarded-For", xff)
		}
		rr := httptest.NewRecorder()
		PinHandler(rr, req)
		return rr.Code, rr.Body.String()
	}

	if code, body := get("127.0.0.1:5000", "localhost:3001", ""); code != http.StatusOK || !bytes.Contains([]byte(body), []byte(pin)) {
		t.Fatalf("loopback request must get the PIN, got %d", code)
	}
	// Regresión: con middleware.RealIP, X-Forwarded-For: 127.0.0.1 daba el PIN a la LAN.
	if code, _ := get("192.168.1.50:5000", "192.168.1.10:3001", "127.0.0.1"); code != http.StatusForbidden {
		t.Fatalf("LAN request with spoofed X-Forwarded-For must be forbidden, got %d", code)
	}
	// DNS rebinding: socket local pero Host de un dominio ajeno.
	if code, _ := get("127.0.0.1:5000", "evil.example:3001", ""); code != http.StatusForbidden {
		t.Fatalf("non-local Host must be forbidden, got %d", code)
	}
}
