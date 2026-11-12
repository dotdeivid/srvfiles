package health

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// El descubrimiento de red (web y móvil) depende de estos campos.
func TestHealthReportsDiscoveryFields(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler(rr, httptest.NewRequest(http.MethodGet, "/api/health", nil))

	var body map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if rr.Code != http.StatusOK || body["status"] != "ok" || !strings.EqualFold(body["app"].(string), "srvfiles") {
		t.Fatalf("unexpected health response: %d %v", rr.Code, body)
	}
	for _, key := range []string{"appName", "port", "httpsPort"} {
		if _, ok := body[key]; !ok {
			t.Errorf("missing %q", key)
		}
	}
}
