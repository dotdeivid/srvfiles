# auth/handler.go

**Archivo:** `internal/auth/handler.go`
**Rol:** Handlers HTTP para autenticación: login con PIN y lectura del PIN desde localhost.

---

## `Login` — `POST /api/auth`

```go
func Login(w http.ResponseWriter, r *http.Request) {
    ip := normalizeIP(r.RemoteAddr)

    if CheckRateLimit(ip) {
        writeJSON(w, http.StatusTooManyRequests, map[string]string{
            "error": "Too many failed attempts. Try again later.",
        })
        return
    }

    var body struct{ Pin string `json:"pin"` }
    json.NewDecoder(r.Body).Decode(&body)

    if !ValidatePin(body.Pin) {
        RecordFailedAttempt(ip)
        writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid PIN"})
        return
    }

    ClearFailedAttempts(ip)
    token := CreateSession()
    writeJSON(w, http.StatusOK, map[string]string{"token": token})
}
```

Flujo:
1. Normaliza la IP del cliente (elimina prefijo `::ffff:`, mapea `::1` → `127.0.0.1`).
2. Verifica rate limit — rechaza con 429 si la IP está bloqueada.
3. Valida el PIN (comparación hash SHA-256).
4. En fallo: registra el intento, responde 401.
5. En éxito: limpia el contador, crea sesión, responde con el token.

---

## `PinHandler` — `GET /api/pin`

```go
func PinHandler(w http.ResponseWriter, r *http.Request) {
    ip := normalizeIP(r.RemoteAddr)
    if ip != "127.0.0.1" {
        http.Error(w, "Forbidden", http.StatusForbidden)
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"pin": GetPin()})
}
```

Devuelve el PIN en texto plano, pero **solo desde localhost**. Tauri llama a este endpoint para obtener el PIN programáticamente sin que el usuario lo escriba. Rechaza cualquier IP diferente de `127.0.0.1` con 403.

---

## `normalizeIP`

```go
func normalizeIP(addr string) string {
    host, _, err := net.SplitHostPort(addr)
    if err != nil {
        host = addr
    }
    host = strings.TrimPrefix(host, "::ffff:")
    if host == "::1" {
        return "127.0.0.1"
    }
    return host
}
```

Go's `net/http` incluye el puerto en `r.RemoteAddr` y puede representar IPv4 como IPv4-mapeada en IPv6 (`::ffff:192.168.1.10`). Esta función normaliza ambos casos para que el rate limiting por IP funcione correctamente.
