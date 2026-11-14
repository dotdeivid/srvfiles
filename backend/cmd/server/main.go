package main

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"srvfiles/internal/announce"
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
	"srvfiles/internal/tlsmux"
	"srvfiles/internal/transfer"
	"srvfiles/internal/webguard"
)

func main() {
	// ─── Init ────────────────────────────────────────────────────────────
	storage.Init()

	// Wire up file-change notifications to the WebSocket relay
	files.OnFilesChanged = transfer.Default.BroadcastFilesChanged

	r := newRouter()

	// ─── Generate PIN ─────────────────────────────────────────────────────
	pin := auth.GeneratePin()
	lanIp := network.GetLanIp()

	// ─── HTTP server (loopback + LAN — Tauri webview and Flutter) ─────────
	// Bind the port synchronously so any "address already in use" error is
	// caught here, before printing the banner, rather than racing in a goroutine.
	httpAddr := fmt.Sprintf("%s:%d", config.Host, config.Port)
	httpLn, err := net.Listen("tcp", httpAddr)
	if err != nil {
		logger.Log.Error("main.go", "Cannot bind HTTP port — is another instance running?",
			"addr", httpAddr, "error", err)
		// La app de escritorio lee esta línea de stderr para explicar el error.
		fmt.Fprintf(os.Stderr, "SRVFILES_ERROR port_in_use %d\n", config.Port)
		os.Exit(1)
	}

	// ─── HTTPS server (LAN — external browsers) ──────────────────────────
	httpsServer := startHTTPS(r, lanIp)

	// Con HTTPS activo, los navegadores de otros equipos que abren la web por
	// HTTP pasan a HTTPS (sin contexto seguro no pueden transferir archivos).
	var httpHandler = r
	if httpsServer != nil {
		httpHandler = webguard.RedirectToHTTPS(config.HttpsPort)(r)
	}
	httpServer := newHTTPServer(httpHandler)

	// Archivos que aparecen o desaparecen en la carpeta sin pasar por la API
	// (recibidos por la app de escritorio, copiados a mano): avisar a los clientes.
	go files.WatchUploadsDir(2 * time.Second)

	// Anuncio mDNS: los teléfonos encuentran el servidor sin barrer la red.
	stopAnnounce, err := announce.Start(config.Port, config.HttpsPort, network.LanIPs())
	if err != nil {
		logger.Log.Warn("main.go", "mDNS announcement disabled", "error", err)
		stopAnnounce = func() {}
	}

	// ─── Startup banner ───────────────────────────────────────────────────
	fmt.Printf("\n🗂️  %s running!\n", config.AppName)
	fmt.Printf("   Local:          http://localhost:%d\n", config.Port)
	fmt.Printf("   Network (web):  https://%s:%d\n", lanIp, config.HttpsPort)
	fmt.Printf("   Shared folder:  %s\n", config.UploadsDir)
	fmt.Printf("   Max file size:  %d MB\n", config.MaxFileSizeMB)
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
	stopAnnounce()
	auth.ResetAuth()
	// http.Server.Shutdown no toca los WebSocket (conexiones secuestradas):
	// se cierran acá con un código que el navegador muestra como "servidor
	// detenido" en lugar de quedarse reconectando.
	transfer.Default.CloseAll(transfer.ServerStoppedCode, "Servidor detenido")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(ctx)
	if httpsServer != nil {
		_ = httpsServer.Shutdown(ctx)
	}
}

// newRouter builds the router shared by the HTTP and HTTPS servers.
//
// No se usa middleware.RealIP: el servidor no está detrás de un proxy y
// confiar en X-Forwarded-For permitía falsificar la IP (y leer el PIN).
func newRouter() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(webguard.SecurityHeaders)
	r.Use(webguard.CORS)
	r.Use(compressExceptFiles)

	// ─── Public routes ────────────────────────────────────────────────────
	r.Get("/api/health", health.Handler)
	r.Post("/api/auth", auth.Login)
	r.Get("/api/pin", auth.PinHandler) // solo loopback; ver auth.PinHandler

	// WebSocket relay — auth handled at WS protocol level (first message)
	r.Get("/ws", transfer.HandleConnection)

	// ─── Protected routes (require valid session token) ───────────────────
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Get("/api/config", configapi.Handler)
		r.Get("/api/discovery/scan", discovery.Handler)
		r.Get("/api/files", files.List)
		r.Post("/api/files/upload", files.Upload)
		r.Post("/api/files/link", files.Link)
		r.Get("/api/files/stats", files.Stats)
		r.Delete("/api/files/{filename}", files.Delete)
	})

	// Downloads and previews also accept a short-lived, single-file link
	// token in the query (?dl=): <a href>, <img> y <video> no mandan cabeceras.
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuthOrLink)
		r.Get("/api/files/download/{filename}", files.Download)
		r.Get("/api/files/preview/{filename}", files.Preview)
	})

	// ─── Frontend static files + SPA fallback ────────────────────────────
	r.Handle("/*", newSPAHandler())
	return r
}

// compressExceptFiles compresses API/JSON and static assets, but not file
// downloads/previews: comprimirlos gasta CPU y quita Content-Length (sin
// progreso ni reanudación).
func compressExceptFiles(next http.Handler) http.Handler {
	compressed := middleware.Compress(5)(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/files/download/") ||
			strings.HasPrefix(r.URL.Path, "/api/files/preview/") ||
			r.URL.Path == "/ws" {
			next.ServeHTTP(w, r)
			return
		}
		compressed.ServeHTTP(w, r)
	})
}

// newHTTPServer: timeouts against slow-header attacks. Sin WriteTimeout global
// porque cortaría las descargas largas.
func newHTTPServer(handler http.Handler) *http.Server {
	return &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    64 * 1024,
	}
}

// startHTTPS creates the TLS certificate and starts the HTTPS server in a goroutine.
// Returns the server so main can shut it down gracefully.
// If cert generation fails, logs the error and returns nil (HTTP-only mode).
//
// El mismo puerto acepta HTTP plano y lo redirige a https:// (quien escribe
// la IP sin "https://" en el navegador ya no ve un error de conexión).
func startHTTPS(handler http.Handler, lanIp string) *http.Server {
	tlsCert, err := cert.GetOrCreateCert(config.CertsDir, network.LanIPs())
	if err != nil {
		logger.Log.Error("main.go", "Failed to get TLS certificate — HTTPS disabled", "error", err)
		return nil
	}

	httpsAddr := fmt.Sprintf("%s:%d", config.Host, config.HttpsPort)
	ln, err := net.Listen("tcp", httpsAddr)
	if err != nil {
		logger.Log.Error("main.go", "Failed to listen on HTTPS port — HTTPS disabled",
			"port", config.HttpsPort, "error", err)
		return nil
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{tlsCert},
		MinVersion:   tls.VersionTLS12,
		NextProtos:   []string{"h2", "http/1.1"},
	}
	tlsListener, plainListener := tlsmux.Split(ln, tlsConfig)

	server := newHTTPServer(handler)
	go func() {
		if err := server.Serve(tlsListener); err != nil && err != http.ErrServerClosed {
			logger.Log.Error("main.go", "HTTPS server error", "error", err)
		}
	}()

	redirect := newHTTPServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://"+r.Host+r.URL.RequestURI(), http.StatusFound)
	}))
	go func() {
		if err := redirect.Serve(plainListener); err != nil && err != http.ErrServerClosed && !errors.Is(err, net.ErrClosed) {
			logger.Log.Error("main.go", "HTTP→HTTPS redirect error", "error", err)
		}
	}()

	logger.Log.Debug("main.go", "HTTPS server started", "port", config.HttpsPort, "lanIp", lanIp)
	return server
}
