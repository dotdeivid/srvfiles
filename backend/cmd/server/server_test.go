package main

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"srvfiles/internal/auth"
	"srvfiles/internal/config"
	"srvfiles/internal/files"
)

// Pruebas de la API completa a través del router real (middlewares incluidos).

func newTestServer(t *testing.T) (*httptest.Server, string) {
	t.Helper()
	old := config.UploadsDir
	config.UploadsDir = t.TempDir()
	files.InvalidateListCache()
	auth.ResetAuth()
	auth.GeneratePin()
	srv := httptest.NewServer(newRouter())
	t.Cleanup(func() {
		srv.Close()
		config.UploadsDir = old
		files.InvalidateListCache()
		auth.ResetAuth()
	})
	return srv, auth.CreateSession()
}

func do(t *testing.T, req *http.Request) (*http.Response, string) {
	t.Helper()
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	return res, string(body)
}

func upload(t *testing.T, srv *httptest.Server, token string, names ...string) map[string]any {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for _, name := range names {
		w, _ := mw.CreateFormFile("files", name)
		_, _ = w.Write([]byte("contenido de " + name))
	}
	_ = mw.Close()
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/files/upload", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("X-SrvFiles-Token", token)
	res, body := do(t, req)
	var out map[string]any
	_ = json.Unmarshal([]byte(body), &out)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("upload status %d: %s", res.StatusCode, body)
	}
	return out
}

// linkFor asks the API for a single-file link token (?dl=).
func linkFor(t *testing.T, srv *httptest.Server, token, name string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"name": name})
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/files/link", bytes.NewReader(body))
	req.Header.Set("X-SrvFiles-Token", token)
	res, out := do(t, req)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("link token for %q: %d %s", name, res.StatusCode, out)
	}
	var parsed map[string]any
	_ = json.Unmarshal([]byte(out), &parsed)
	return parsed["token"].(string)
}

func TestUploadListDownloadDelete(t *testing.T) {
	srv, token := newTestServer(t)

	out := upload(t, srv, token, "año señal.txt", "informe..v2.txt", "foo[1](2).txt", "../fuera.txt", "año señal.txt")
	var saved []string
	for _, f := range out["files"].([]any) {
		saved = append(saved, f.(map[string]any)["name"].(string))
	}
	want := []string{"año señal.txt", "informe..v2.txt", "foo[1](2).txt", "fuera.txt", "año señal (1).txt"}
	if strings.Join(saved, "|") != strings.Join(want, "|") {
		t.Fatalf("saved names = %v, want %v", saved, want)
	}

	// Corchetes escapados (chi enruta sobre RawPath): antes daba 404.
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/files/download/foo%5B1%5D%282%29.txt", nil)
	req.Header.Set("X-SrvFiles-Token", token)
	res, body := do(t, req)
	if res.StatusCode != http.StatusOK || body != "contenido de foo[1](2).txt" {
		t.Fatalf("download with escaped brackets: %d %q", res.StatusCode, body)
	}

	// Nombre no ASCII: Content-Disposition con filename* (RFC 6266/2231).
	dl := linkFor(t, srv, token, "año señal.txt")
	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/api/files/download/"+url.PathEscape("año señal.txt")+"?dl="+dl, nil)
	res, _ = do(t, req)
	if cd := res.Header.Get("Content-Disposition"); res.StatusCode != http.StatusOK || !strings.Contains(cd, "filename*=utf-8''") {
		t.Fatalf("download via link token: %d, Content-Disposition %q", res.StatusCode, cd)
	}
	// El token de enlace no abre otros archivos.
	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/api/files/download/fuera.txt?dl="+dl, nil)
	if res, _ := do(t, req); res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("link token used on another file: %d, want 401", res.StatusCode)
	}

	req, _ = http.NewRequest(http.MethodDelete, srv.URL+"/api/files/"+url.PathEscape("informe..v2.txt"), nil)
	req.Header.Set("X-SrvFiles-Token", token)
	if res, _ := do(t, req); res.StatusCode != http.StatusOK {
		t.Fatalf("delete status %d", res.StatusCode)
	}
	if res, _ := do(t, req); res.StatusCode != http.StatusNotFound {
		t.Fatalf("second delete must be 404, got %d", res.StatusCode)
	}
}

func TestPathTraversalAndQueryTokenRules(t *testing.T) {
	srv, token := newTestServer(t)

	for _, path := range []string{"/api/files/download/..%2F..%2Fsecret.txt", "/api/files/download/..%5Csecret.txt"} {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+path, nil)
		req.Header.Set("X-SrvFiles-Token", token)
		if res, _ := do(t, req); res.StatusCode != http.StatusBadRequest && res.StatusCode != http.StatusNotFound {
			t.Errorf("%s: status %d, want 400/404", path, res.StatusCode)
		}
	}

	for _, path := range []string{"/api/files?token=" + token, "/api/files/download/x.txt?token=" + token} {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+path, nil)
		if res, _ := do(t, req); res.StatusCode != http.StatusUnauthorized {
			t.Fatalf("%s: the session token must never work in the URL, got %d", path, res.StatusCode)
		}
	}
}

// Un HTML subido no debe ejecutarse en el origen del servidor si se abre el enlace.
func TestPreviewDoesNotServeActiveContent(t *testing.T) {
	srv, token := newTestServer(t)
	upload(t, srv, token, "evil.html", "logo.svg")

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/files/preview/evil.html?dl="+linkFor(t, srv, token, "evil.html"), nil)
	res, _ := do(t, req)
	if ct := res.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/plain") {
		t.Errorf("html preview Content-Type = %q, want text/plain", ct)
	}
	if csp := res.Header.Get("Content-Security-Policy"); !strings.Contains(csp, "sandbox") {
		t.Errorf("html preview CSP = %q, want sandbox", csp)
	}
	if res.Header.Get("X-Content-Type-Options") != "nosniff" {
		t.Error("missing X-Content-Type-Options: nosniff")
	}

	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/api/files/preview/logo.svg?dl="+linkFor(t, srv, token, "logo.svg"), nil)
	res, _ = do(t, req)
	if csp := res.Header.Get("Content-Security-Policy"); !strings.Contains(csp, "sandbox") {
		t.Errorf("svg preview must be sandboxed, CSP = %q", csp)
	}
}

func TestCORSAllowsOnlyKnownOrigins(t *testing.T) {
	srv, _ := newTestServer(t)
	get := func(origin string) *http.Response {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/health", nil)
		req.Header.Set("Origin", origin)
		res, _ := do(t, req)
		return res
	}
	if res := get("https://evil.example"); res.StatusCode != http.StatusForbidden {
		t.Errorf("foreign origin: status %d, want 403", res.StatusCode)
	}
	if res := get("tauri://localhost"); res.Header.Get("Access-Control-Allow-Origin") != "tauri://localhost" {
		t.Errorf("Tauri origin must be allowed, got %q", res.Header.Get("Access-Control-Allow-Origin"))
	}
	if res := get(srv.URL); res.StatusCode != http.StatusOK {
		t.Errorf("same origin must be allowed, got %d", res.StatusCode)
	}
}

// Regresión: con middleware.RealIP, X-Forwarded-For: 127.0.0.1 exponía el PIN a la LAN.
func TestPinNotExposedThroughRouterToLAN(t *testing.T) {
	newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/pin", nil)
	req.RemoteAddr = "192.168.1.50:5000"
	req.Host = "192.168.1.10:3001"
	req.Header.Set("X-Forwarded-For", "127.0.0.1")
	req.Header.Set("X-Real-IP", "127.0.0.1")
	rr := httptest.NewRecorder()
	newRouter().ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("status %d, want 403", rr.Code)
	}
}
