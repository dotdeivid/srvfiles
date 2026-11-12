// Package webguard decide qué orígenes de navegador pueden hablar con el
// servidor y qué peticiones vienen realmente de esta máquina.
//
// El servidor no está detrás de un proxy, así que la IP del cliente es la del
// socket (r.RemoteAddr). Nunca se confía en X-Forwarded-For ni X-Real-IP.
package webguard

import (
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// ClientIP devuelve la IP real del socket, normalizada (sin ::ffff:, ::1 → 127.0.0.1).
func ClientIP(r *http.Request) string {
	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	ip = strings.TrimPrefix(ip, "::ffff:")
	if ip == "::1" {
		ip = "127.0.0.1"
	}
	return ip
}

// IsLoopback reports whether the request comes from this machine (socket address).
func IsLoopback(r *http.Request) bool {
	parsed := net.ParseIP(ClientIP(r))
	return parsed != nil && parsed.IsLoopback()
}

// HasLocalHost reports whether the Host header names this machine by a
// loopback name. Protege contra DNS rebinding: una web maliciosa que resuelva
// su dominio a 127.0.0.1 manda su propio dominio en Host.
func HasLocalHost(r *http.Request) bool {
	host := r.Host
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.Trim(host, "[]")
	switch host {
	case "localhost", "127.0.0.1", "::1", "tauri.localhost":
		return true
	}
	return false
}

// AllowedOrigin reports whether a browser Origin may use the API:
//   - sin Origin (apps nativas, curl, navegación directa);
//   - el mismo origen que sirve la página (Origin host == Host);
//   - la app de escritorio Tauri;
//   - el servidor de desarrollo de Vite en localhost.
func AllowedOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	switch u.Scheme + "://" + u.Host {
	case "tauri://localhost", "http://tauri.localhost", "https://tauri.localhost":
		return true
	}
	if u.Host == r.Host {
		return true
	}
	h := u.Hostname()
	return (h == "localhost" || h == "127.0.0.1") && u.Port() == "5173"
}

// CORS answers preflights and sets CORS headers only for allowed origins.
// Las peticiones de otros orígenes se rechazan con 403 para que una web
// cualquiera abierta en el navegador no pueda usar la API local.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if !AllowedOrigin(r) {
				http.Error(w, "Origin not allowed", http.StatusForbidden)
				return
			}
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Add("Vary", "Origin")
			h.Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Content-Type, X-SrvFiles-Token, Range")
			h.Set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Disposition")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// SecurityHeaders adds headers that apply to every response.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		// El token puede ir en la URL de descargas: no filtrarlo por Referer.
		h.Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

// RedirectToHTTPS manda a https://<host>:<httpsPort> las páginas que un
// navegador de otro equipo abre por HTTP. Sin contexto seguro el navegador
// no tiene WebCrypto y no puede enviar ni recibir archivos (cifrado de
// extremo a extremo obligatorio).
//
// No se redirige:
//   - la API ni el WebSocket (/api/*, /ws): los usan la app móvil, la de
//     escritorio y el descubrimiento de red por HTTP;
//   - esta máquina (localhost ya es un contexto seguro);
//   - métodos que no sean GET/HEAD.
//
// Redirección temporal (302): si HTTPS se desactiva no queda cacheada.
func RedirectToHTTPS(httpsPort int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !shouldRedirectToHTTPS(r) {
				next.ServeHTTP(w, r)
				return
			}
			host := r.Host
			if h, _, err := net.SplitHostPort(host); err == nil {
				host = h
			}
			host = strings.Trim(host, "[]")
			target := "https://" + net.JoinHostPort(host, strconv.Itoa(httpsPort)) + r.URL.RequestURI()
			http.Redirect(w, r, target, http.StatusFound)
		})
	}
}

func shouldRedirectToHTTPS(r *http.Request) bool {
	if r.TLS != nil || (r.Method != http.MethodGet && r.Method != http.MethodHead) {
		return false
	}
	if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/ws" {
		return false
	}
	return !IsLoopback(r) && !HasLocalHost(r)
}
