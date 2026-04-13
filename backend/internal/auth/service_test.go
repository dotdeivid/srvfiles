package auth

import (
	"regexp"
	"testing"
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

func setup(t *testing.T) {
	t.Helper()
	ResetAuth()
	t.Cleanup(ResetAuth)
}

// ─── GeneratePin ──────────────────────────────────────────────────────────────

func TestGeneratePin_Format(t *testing.T) {
	setup(t)
	pin := GeneratePin()
	if matched, _ := regexp.MatchString(`^\d{6}$`, pin); !matched {
		t.Errorf("pin %q is not a 6-digit string", pin)
	}
}

func TestGeneratePin_Range(t *testing.T) {
	setup(t)
	for i := 0; i < 20; i++ {
		pin := GeneratePin()
		var n int
		if _, err := parsePin(pin, &n); err != nil {
			t.Fatalf("pin %q is not numeric: %v", pin, err)
		}
		if n < 100_000 || n > 999_999 {
			t.Errorf("pin %d out of range [100000, 999999]", n)
		}
	}
}

func TestGeneratePin_GetPinMatchesCurrent(t *testing.T) {
	setup(t)
	pin := GeneratePin()
	if got := GetPin(); got != pin {
		t.Errorf("GetPin() = %q, want %q", got, pin)
	}
}

func TestGeneratePin_Uniqueness(t *testing.T) {
	setup(t)
	seen := make(map[string]bool)
	for i := 0; i < 10; i++ {
		seen[GeneratePin()] = true
	}
	if len(seen) < 2 {
		t.Error("10 consecutive calls all returned the same PIN (statistically impossible)")
	}
}

// ─── ValidatePin ──────────────────────────────────────────────────────────────

func TestValidatePin_Correct(t *testing.T) {
	setup(t)
	pin := GeneratePin()
	if !ValidatePin(pin) {
		t.Error("ValidatePin(correct) returned false")
	}
}

func TestValidatePin_Wrong(t *testing.T) {
	setup(t)
	GeneratePin()
	if ValidatePin("000000") {
		t.Error("ValidatePin(wrong) returned true")
	}
}

func TestValidatePin_NoPinGenerated(t *testing.T) {
	setup(t)
	if ValidatePin("123456") {
		t.Error("ValidatePin returned true before any PIN was generated")
	}
}

func TestValidatePin_ExactMatch(t *testing.T) {
	setup(t)
	pin := GeneratePin()
	if ValidatePin(pin + " ") {
		t.Error("ValidatePin accepted PIN with trailing space")
	}
}

// ─── GetPin ───────────────────────────────────────────────────────────────────

func TestGetPin_EmptyBeforeGeneration(t *testing.T) {
	setup(t)
	if got := GetPin(); got != "" {
		t.Errorf("GetPin() = %q before generation, want empty string", got)
	}
}

func TestGetPin_EmptyAfterReset(t *testing.T) {
	setup(t)
	GeneratePin()
	ResetAuth()
	if got := GetPin(); got != "" {
		t.Errorf("GetPin() = %q after ResetAuth, want empty string", got)
	}
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

func TestCreateSession_UUIDv4Format(t *testing.T) {
	setup(t)
	token := CreateSession()
	uuidRe := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	if !uuidRe.MatchString(token) {
		t.Errorf("token %q does not match UUID v4 pattern", token)
	}
}

func TestValidateToken_ValidSession(t *testing.T) {
	setup(t)
	token := CreateSession()
	if !ValidateToken(token) {
		t.Error("ValidateToken returned false for a created session")
	}
}

func TestValidateToken_UnknownToken(t *testing.T) {
	setup(t)
	if ValidateToken("not-a-real-token") {
		t.Error("ValidateToken returned true for unknown token")
	}
}

func TestValidateToken_Empty(t *testing.T) {
	setup(t)
	if ValidateToken("") {
		t.Error("ValidateToken returned true for empty string")
	}
}

func TestCreateSession_MultipleIndependent(t *testing.T) {
	setup(t)
	t1 := CreateSession()
	t2 := CreateSession()
	if t1 == t2 {
		t.Error("two consecutive sessions returned the same token")
	}
	if !ValidateToken(t1) || !ValidateToken(t2) {
		t.Error("one of two concurrent sessions failed validation")
	}
}

func TestResetAuth_InvalidatesSessions(t *testing.T) {
	setup(t)
	token := CreateSession()
	ResetAuth()
	if ValidateToken(token) {
		t.Error("ValidateToken returned true after ResetAuth")
	}
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

const testIP = "10.0.0.1"
const otherIP = "10.0.0.2"

func TestRateLimit_NotBlockedInitially(t *testing.T) {
	setup(t)
	if CheckRateLimit(testIP) {
		t.Error("IP should not be blocked initially")
	}
}

func TestRateLimit_NotBlockedBeforeMax(t *testing.T) {
	setup(t)
	for i := 0; i < 4; i++ {
		RecordFailedAttempt(testIP)
	}
	if CheckRateLimit(testIP) {
		t.Error("IP should not be blocked after 4 failures (threshold is 5)")
	}
}

func TestRateLimit_BlockedAtMax(t *testing.T) {
	setup(t)
	for i := 0; i < 5; i++ {
		RecordFailedAttempt(testIP)
	}
	if !CheckRateLimit(testIP) {
		t.Error("IP should be blocked after 5 failures")
	}
}

func TestRateLimit_IsolatedPerIP(t *testing.T) {
	setup(t)
	for i := 0; i < 5; i++ {
		RecordFailedAttempt(testIP)
	}
	if CheckRateLimit(otherIP) {
		t.Error("blocking one IP should not affect another IP")
	}
}

func TestRateLimit_ClearUnblocks(t *testing.T) {
	setup(t)
	for i := 0; i < 5; i++ {
		RecordFailedAttempt(testIP)
	}
	ClearFailedAttempts(testIP)
	if CheckRateLimit(testIP) {
		t.Error("IP should not be blocked after ClearFailedAttempts")
	}
}

func TestRateLimit_ResetAuthClears(t *testing.T) {
	setup(t)
	for i := 0; i < 5; i++ {
		RecordFailedAttempt(testIP)
	}
	ResetAuth()
	if CheckRateLimit(testIP) {
		t.Error("IP should not be blocked after ResetAuth")
	}
}

// ─── internal helper ─────────────────────────────────────────────────────────

func parsePin(s string, out *int) (int, error) {
	var n int
	_, err := parseIntStr(s, &n)
	if out != nil {
		*out = n
	}
	return n, err
}

func parseIntStr(s string, out *int) (int, error) {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, &parseError{s}
		}
		n = n*10 + int(c-'0')
	}
	if out != nil {
		*out = n
	}
	return n, nil
}

type parseError struct{ s string }

func (e *parseError) Error() string { return "not numeric: " + e.s }
