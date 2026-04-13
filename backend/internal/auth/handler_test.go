package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ─── helpers ──────────────────────────────────────────────────────────────────

func postAuth(t *testing.T, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/auth", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "10.0.0.1:9999"
	rr := httptest.NewRecorder()
	Login(rr, req)
	return rr
}

func getPin(t *testing.T, remoteAddr string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/pin", nil)
	req.RemoteAddr = remoteAddr
	rr := httptest.NewRecorder()
	PinHandler(rr, req)
	return rr
}

func getProtected(t *testing.T, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/protected", nil)
	if token != "" {
		req.Header.Set("X-SrvFiles-Token", token)
	}
	req.RemoteAddr = "10.0.0.1:9999"
	rr := httptest.NewRecorder()
	RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})).ServeHTTP(rr, req)
	return rr
}

// ─── POST /api/auth ───────────────────────────────────────────────────────────

func TestLogin_CorrectPin(t *testing.T) {
	setup(t)
	pin := GeneratePin()
	rr := postAuth(t, map[string]any{"pin": pin})
	if rr.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rr.Code)
	}
	var body map[string]string
	_ = json.NewDecoder(rr.Body).Decode(&body)
	if body["token"] == "" {
		t.Error("response body missing token")
	}
}

func TestLogin_TokenIsUUIDv4(t *testing.T) {
	setup(t)
	pin := GeneratePin()
	rr := postAuth(t, map[string]any{"pin": pin})
	var body map[string]string
	_ = json.NewDecoder(rr.Body).Decode(&body)
	if !isUUIDv4(body["token"]) {
		t.Errorf("token %q is not UUID v4", body["token"])
	}
}

func TestLogin_WrongPin(t *testing.T) {
	setup(t)
	GeneratePin()
	rr := postAuth(t, map[string]any{"pin": "000000"})
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rr.Code)
	}
}

func TestLogin_MissingPin(t *testing.T) {
	setup(t)
	GeneratePin()
	rr := postAuth(t, map[string]any{})
	if rr.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rr.Code)
	}
}

func TestLogin_RateLimited(t *testing.T) {
	setup(t)
	GeneratePin()
	ip := "10.0.0.1"
	for i := 0; i < 5; i++ {
		RecordFailedAttempt(ip)
	}
	rr := postAuth(t, map[string]any{"pin": "000000"})
	if rr.Code != http.StatusTooManyRequests {
		t.Errorf("status = %d, want 429", rr.Code)
	}
}

func TestLogin_SuccessResetsCounter(t *testing.T) {
	setup(t)
	pin := GeneratePin()
	ip := "10.0.0.1"
	// 4 failures
	for i := 0; i < 4; i++ {
		RecordFailedAttempt(ip)
	}
	// correct PIN — should clear counter
	postAuth(t, map[string]any{"pin": pin})
	// 4 more failures should not block
	for i := 0; i < 4; i++ {
		rr := postAuth(t, map[string]any{"pin": "000000"})
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("attempt %d: status = %d, want 401", i+1, rr.Code)
		}
	}
}

// ─── GET /api/pin ─────────────────────────────────────────────────────────────

func TestPinHandler_LocalhostAllowed(t *testing.T) {
	setup(t)
	pin := GeneratePin()
	rr := getPin(t, "127.0.0.1:1234")
	if rr.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rr.Code)
	}
	var body map[string]string
	_ = json.NewDecoder(rr.Body).Decode(&body)
	if body["pin"] != pin {
		t.Errorf("pin = %q, want %q", body["pin"], pin)
	}
}

func TestPinHandler_RemoteForbidden(t *testing.T) {
	setup(t)
	GeneratePin()
	rr := getPin(t, "192.168.1.50:1234")
	if rr.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rr.Code)
	}
}

func TestPinHandler_NoPinGenerated(t *testing.T) {
	setup(t)
	// No GeneratePin call
	rr := getPin(t, "127.0.0.1:1234")
	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want 503", rr.Code)
	}
}

// ─── RequireAuth middleware ───────────────────────────────────────────────────

func TestRequireAuth_NoToken(t *testing.T) {
	setup(t)
	rr := getProtected(t, "")
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rr.Code)
	}
}

func TestRequireAuth_InvalidToken(t *testing.T) {
	setup(t)
	rr := getProtected(t, "bad-token")
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rr.Code)
	}
}

func TestRequireAuth_ValidToken(t *testing.T) {
	setup(t)
	token := CreateSession()
	rr := getProtected(t, token)
	if rr.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rr.Code)
	}
}

func TestRequireAuth_InvalidatedAfterReset(t *testing.T) {
	setup(t)
	token := CreateSession()
	ResetAuth()
	rr := getProtected(t, token)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401 after ResetAuth", rr.Code)
	}
}

// ─── internal helper ─────────────────────────────────────────────────────────

func isUUIDv4(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, c := range s {
		switch i {
		case 8, 13, 18, 23:
			if c != '-' {
				return false
			}
		case 14:
			if c != '4' {
				return false
			}
		case 19:
			if c != '8' && c != '9' && c != 'a' && c != 'b' {
				return false
			}
		default:
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
				return false
			}
		}
	}
	return true
}
