package health

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandler_Status200(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rr := httptest.NewRecorder()
	Handler(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rr.Code)
	}
}

func TestHandler_BodyStatusOK(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rr := httptest.NewRecorder()
	Handler(rr, req)
	var body map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("status = %q, want \"ok\"", body["status"])
	}
}

func TestHandler_ContentTypeJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rr := httptest.NewRecorder()
	Handler(rr, req)
	ct := rr.Header().Get("Content-Type")
	if ct == "" {
		t.Error("Content-Type header is missing")
	}
}

func TestHandler_NoAuthRequired(t *testing.T) {
	// No auth header — endpoint must be public
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rr := httptest.NewRecorder()
	Handler(rr, req)
	if rr.Code == http.StatusUnauthorized {
		t.Error("health endpoint must be public (got 401)")
	}
}
