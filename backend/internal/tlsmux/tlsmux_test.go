package tlsmux

import (
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"testing"

	"srvfiles/internal/cert"
)

func TestPlainHTTPIsRedirectedAndTLSIsServed(t *testing.T) {
	c, err := cert.GetOrCreateCert(t.TempDir(), []string{"127.0.0.1"})
	if err != nil {
		t.Fatal(err)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	tlsLn, plainLn := Split(ln, &tls.Config{Certificates: []tls.Certificate{c}})
	t.Cleanup(func() { _ = tlsLn.Close() })

	go func() {
		_ = http.Serve(tlsLn, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = io.WriteString(w, "seguro")
		}))
	}()
	go func() {
		_ = http.Serve(plainLn, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, "https://"+r.Host+r.RequestURI, http.StatusTemporaryRedirect)
		}))
	}()

	addr := ln.Addr().String()
	noFollow := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	res, err := noFollow.Get(fmt.Sprintf("http://%s/files?x=1", addr))
	if err != nil {
		t.Fatal(err)
	}
	_ = res.Body.Close()
	if res.StatusCode != http.StatusTemporaryRedirect || res.Header.Get("Location") != "https://"+addr+"/files?x=1" {
		t.Fatalf("plain HTTP must redirect to https on the same port: %d %q", res.StatusCode, res.Header.Get("Location"))
	}

	insecure := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}
	res, err = insecure.Get(fmt.Sprintf("https://%s/", addr))
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(res.Body)
	_ = res.Body.Close()
	if string(body) != "seguro" {
		t.Fatalf("TLS must reach the HTTPS server, got %q", body)
	}
}
