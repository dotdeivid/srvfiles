package webguard

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRedirectToHTTPS(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	h := RedirectToHTTPS(3002)(ok)

	cases := []struct {
		name, method, host, remote, path string
		wantLocation                     string
	}{
		{"browser from the LAN", "GET", "192.168.1.5:3001", "192.168.1.20:5000", "/?x=1", "https://192.168.1.5:3002/?x=1"},
		{"host without port", "GET", "192.168.1.5", "192.168.1.20:5000", "/assets/a.js", "https://192.168.1.5:3002/assets/a.js"},
		{"API stays on HTTP", "GET", "192.168.1.5:3001", "192.168.1.20:5000", "/api/health", ""},
		{"WebSocket stays on HTTP", "GET", "192.168.1.5:3001", "192.168.1.20:5000", "/ws", ""},
		{"POST is not redirected", "POST", "192.168.1.5:3001", "192.168.1.20:5000", "/", ""},
		{"localhost is a secure context", "GET", "localhost:3001", "127.0.0.1:5000", "/", ""},
		{"loopback connection", "GET", "192.168.1.5:3001", "127.0.0.1:5000", "/", ""},
	}
	for _, c := range cases {
		req := httptest.NewRequest(c.method, "http://"+c.host+c.path, nil)
		req.Host = c.host
		req.RemoteAddr = c.remote
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if got := rec.Header().Get("Location"); got != c.wantLocation {
			t.Errorf("%s: Location = %q, want %q", c.name, got, c.wantLocation)
		}
		if c.wantLocation == "" && rec.Code != http.StatusNoContent {
			t.Errorf("%s: request should reach the handler, got %d", c.name, rec.Code)
		}
	}
}
