package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"srvfiles/internal/auth"
	"srvfiles/internal/cert"
	"srvfiles/internal/config"
	"srvfiles/internal/configapi"
	"srvfiles/internal/discovery"
	"srvfiles/internal/files"
	"srvfiles/internal/health"
	"srvfiles/internal/logger"
	"srvfiles/internal/network"
	"srvfiles/internal/storage"
	"srvfiles/internal/transfer"
)

func main() {
	// ─── Init ────────────────────────────────────────────────────────────
	storage.Init()

	// Wire up file-change notifications to the WebSocket relay
	files.OnFilesChanged = transfer.Default.BroadcastFilesChanged

	// ─── Router (shared between HTTP and HTTPS) ───────────────────────
	r := chi.NewRouter()
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)
	r.Use(middleware.Compress(5))

	// ─── Public routes ────────────────────────────────────────────────────
	r.Get("/api/health", health.Handler)
	r.Post("/api/auth", auth.Login)
	r.Get("/api/pin", auth.PinHandler)

	// WebSocket relay — auth handled at WS protocol level (first message)
	// Works for both ws:// (HTTP) and wss:// (HTTPS)
	r.Get("/ws", transfer.HandleConnection)

	// ─── Protected routes (require valid session token) ───────────────────
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth)

		// Config
		r.Get("/api/config", configapi.Handler)

		// Discovery
		r.Get("/api/discovery/scan", discovery.Handler)

		// Files
		r.Get("/api/files", files.List)
		r.Post("/api/files/upload", files.Upload)
		r.Get("/api/files/download/{filename}", files.Download)
		r.Get("/api/files/preview/{filename}", files.Preview)
		r.Get("/api/files/stats", files.Stats)
		r.Delete("/api/files/{filename}", files.Delete)
	})

	// ─── Frontend static files + SPA fallback ────────────────────────────
	r.Handle("/*", newSPAHandler())

	// ─── Generate PIN ─────────────────────────────────────────────────────
	pin   := auth.GeneratePin()
	lanIp := network.GetLanIp()

	// ─── HTTP server (loopback + LAN — Tauri webview and Flutter) ─────────
	// Bind the port synchronously so any "address already in use" error is
	// caught here, before printing the banner, rather than racing in a goroutine.
	httpAddr := fmt.Sprintf("%s:%d", config.Host, config.Port)
	httpLn, err := net.Listen("tcp", httpAddr)
	if err != nil {
		logger.Log.Error("main.go", "Cannot bind HTTP port — is another instance running?",
			"addr", httpAddr, "error", err)
		os.Exit(1)
	}
	httpServer := &http.Server{Handler: r}

	// ─── HTTPS server (LAN — external browsers) ──────────────────────────
	httpsServer := startHTTPS(r, lanIp)

	// ─── Startup banner ───────────────────────────────────────────────────
	fmt.Printf("\n🗂️  %s running!\n", config.AppName)
	fmt.Printf("   Local (Tauri):  http://localhost:%d\n", config.Port)
	fmt.Printf("   Network (web):  https://%s:%d\n", lanIp, config.HttpsPort)
	fmt.Printf("   Max file size:  %d MB\n", config.MaxFileSizeMB)
	// Special format for Tauri IPC to parse the PIN — DO NOT change this line
	fmt.Printf("   PIN: %s\n", pin)
	fmt.Println()

	logger.Log.Info("main.go", "Servers started",
		"httpPort", config.Port, "httpsPort", config.HttpsPort, "lanIp", lanIp)

	go func() {
		if err := httpServer.Serve(httpLn); err != nil && err != http.ErrServerClosed {
			logger.Log.Error("main.go", "HTTP server error", "error", err)
		}
	}()

	// ─── Graceful shutdown ────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit

	logger.Log.Info("main.go", "Servers shutting down")
	auth.ResetAuth()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(ctx)
	if httpsServer != nil {
		_ = httpsServer.Shutdown(ctx)
	}
}

// startHTTPS creates the TLS certificate and starts the HTTPS server in a goroutine.
// Returns the server so main can shut it down gracefully.
// If cert generation fails, logs the error and returns nil (HTTP-only mode).
func startHTTPS(handler http.Handler, lanIp string) *http.Server {
	tlsCert, err := cert.GetOrCreateCert(config.CertsDir)
	if err != nil {
		logger.Log.Error("main.go", "Failed to get TLS certificate — HTTPS disabled", "error", err)
		return nil
	}

	httpsAddr := fmt.Sprintf("%s:%d", config.Host, config.HttpsPort)

	// Use net.Listen + tls.NewListener so we can pass the cert directly
	// without relying on certFile/keyFile path parameters.
	ln, err := net.Listen("tcp", httpsAddr)
	if err != nil {
		logger.Log.Error("main.go", "Failed to listen on HTTPS port — HTTPS disabled",
			"port", config.HttpsPort, "error", err)
		return nil
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{tlsCert},
		// Enable HTTP/2
		NextProtos: []string{"h2", "http/1.1"},
	}
	tlsListener := tls.NewListener(ln, tlsConfig)

	server := &http.Server{Handler: handler}
	go func() {
		if err := server.Serve(tlsListener); err != nil && err != http.ErrServerClosed {
			logger.Log.Error("main.go", "HTTPS server error", "error", err)
		}
	}()

	logger.Log.Debug("main.go", "HTTPS server started", "port", config.HttpsPort, "lanIp", lanIp)
	return server
}

// ─── CORS middleware ──────────────────────────────────────────────────────────

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-SrvFiles-Token, Range")
		// Expose headers needed for Range/streaming (video seek, partial downloads)
		w.Header().Set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

