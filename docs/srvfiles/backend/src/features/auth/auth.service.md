# auth/service.go

**Archivo:** `internal/auth/service.go`
**Rol:** Gestiona el ciclo de vida del PIN y las sesiones en memoria. Expone funciones para generar, validar y limpiar el estado de autenticación, incluyendo rate limiting por IP. Todo el acceso al estado está protegido por `sync.RWMutex`.

---

## Estado en memoria

```go
var (
    mu         sync.RWMutex
    pinHash    string
    pinPlain   string
    sessions   = make(map[string]struct{})
    rateLimit  = make(map[string]*rateLimitEntry)
)

type rateLimitEntry struct {
    count        int
    blockedUntil time.Time
}
```

- `pinHash`: SHA-256 del PIN en hex. Nunca se compara texto plano contra texto plano.
- `pinPlain`: PIN en claro. Solo lo lee el endpoint `/api/pin` (exclusivo de localhost).
- `sessions`: set de tokens UUID activos. Se usa `struct{}` como valor para no desperdiciar memoria.
- `rateLimit`: contador de intentos fallidos y timestamp de fin de bloqueo por IP.

`mu` protege todas las variables. Las lecturas usan `RLock`/`RUnlock` y las escrituras `Lock`/`Unlock`.

---

## Generación del PIN

```go
func GeneratePin() string {
    n, _ := rand.Int(rand.Reader, big.NewInt(900_000))
    pin   := fmt.Sprintf("%06d", n.Int64()+100_000)
    h     := sha256.Sum256([]byte(pin))

    mu.Lock()
    pinHash  = hex.EncodeToString(h[:])
    pinPlain = pin
    mu.Unlock()

    return pin
}
```

`rand.Int` con `crypto/rand` es criptográficamente seguro. El rango `[100000, 999999]` garantiza siempre 6 dígitos. El PIN se almacena en texto plano (para el endpoint localhost) y como hash SHA-256 (para las comparaciones).

---

## `ValidatePin`

```go
func ValidatePin(input string) bool {
    h := sha256.Sum256([]byte(input))
    mu.RLock()
    defer mu.RUnlock()
    return pinHash != "" && hex.EncodeToString(h[:]) == pinHash
}
```

Hashea el input y compara. Si `pinHash` está vacío (el servidor aún no generó PIN), devuelve `false`.

---

## Gestión de sesiones

```go
func CreateSession() string {
    token := newUUID()
    mu.Lock()
    sessions[token] = struct{}{}
    mu.Unlock()
    return token
}

func ValidateToken(token string) bool {
    mu.RLock()
    defer mu.RUnlock()
    _, ok := sessions[token]
    return ok
}
```

`CreateSession` genera un UUID v4 con `crypto/rand` (sin dependencias externas) y lo registra. `ValidateToken` verifica la existencia en el map.

---

## Rate limiting

```go
const (
    maxAttempts    = 5
    blockDuration  = 60 * time.Second
)

func CheckRateLimit(ip string) bool   // true = bloqueado
func RecordFailedAttempt(ip string)
func ClearFailedAttempts(ip string)
```

Después de 5 intentos fallidos desde la misma IP, se bloquea durante 60 segundos. `CheckRateLimit` limpia la entrada del map cuando `blockedUntil` ya pasó (auto-expiración sin goroutines adicionales). `ClearFailedAttempts` se llama en login exitoso.

---

## `ResetAuth`

```go
func ResetAuth() {
    mu.Lock()
    defer mu.Unlock()
    pinHash  = ""
    pinPlain = ""
    sessions  = make(map[string]struct{})
    rateLimit = make(map[string]*rateLimitEntry)
}
```

Borra todo el estado de autenticación. Se llama desde `main.go` al recibir SIGTERM/SIGINT para que el PIN y los tokens no persistan si el proceso se reutiliza.
