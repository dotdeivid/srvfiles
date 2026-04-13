# main.go

**Archivo:** `cmd/server/main.go`
**Rol:** Punto de entrada del servidor. Inicializa el storage, configura el router chi con todas las rutas, levanta los servidores HTTP y HTTPS, imprime el banner de arranque y gestiona el shutdown limpio.

---

## Inicialización

```go
storage.Init()
files.OnFilesChanged = transfer.Default.BroadcastFilesChanged
```

`storage.Init()` crea el directorio de uploads si no existe. Luego se conecta la variable `files.OnFilesChanged` con `transfer.Default.BroadcastFilesChanged` para que las operaciones de archivos (upload, delete) notifiquen automáticamente a todos los clientes WebSocket conectados.

---

## Router

```go
r := chi.NewRouter()
r.Use(middleware.RealIP)
r.Use(middleware.Recoverer)
r.Use(corsMiddleware)
```

Se usa [chi](https://github.com/go-chi/chi) como router HTTP. Los tres middlewares globales son:

- `RealIP`: extrae la IP real del cliente de headers como `X-Forwarded-For`.
- `Recoverer`: captura cualquier `panic` en los handlers y devuelve `500` en lugar de crashar el proceso.
- `corsMiddleware`: añade los headers CORS necesarios para el frontend React y la app Flutter.

### Rutas públicas

```go
r.Get("/api/health", health.Handler)
r.Post("/api/auth", auth.Login)
r.Get("/api/pin", auth.PinHandler)
r.Get("/ws", transfer.HandleConnection)
```

No requieren token. `/ws` es el WebSocket relay — la autenticación ocurre a nivel de protocolo WS (primer mensaje `auth`).

### Rutas protegidas

```go
r.Group(func(r chi.Router) {
    r.Use(auth.RequireAuth)
    r.Get("/api/config", configapi.Handler)
    r.Get("/api/discovery/scan", discovery.Handler)
    r.Get("/api/files", files.List)
    r.Post("/api/files/upload", files.Upload)
    // ...
})
```

El grupo aplica `auth.RequireAuth` a todas las rutas del bloque. chi evalúa los middlewares del grupo antes de llamar al handler.

### SPA fallback

```go
r.Handle("/*", newSPAHandler())
```

`newSPAHandler()` es una función definida en `spa_dev.go` o `spa_embed.go` según el build tag. Sirve los archivos estáticos del frontend y hace fallback a `index.html` para React Router.

---

## Servidor HTTP

```go
httpAddr  := fmt.Sprintf("%s:%d", config.Host, config.Port)
httpServer := &http.Server{Addr: httpAddr, Handler: r}
go func() {
    if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        logger.Log.Error("main.go", "HTTP server error", "error", err)
        os.Exit(1)
    }
}()
```

Escucha en `HOST:PORT` (por defecto `0.0.0.0:3001`). Lo usan la webview de Tauri y la app Flutter. Corre en su propia goroutine para no bloquear la goroutine principal.

---

## Servidor HTTPS

```go
httpsServer := startHTTPS(r, lanIp)
```

`startHTTPS` obtiene o genera el certificado TLS autofirmado via `cert.GetOrCreateCert`, crea un listener TCP, lo envuelve con `tls.NewListener` y sirve con el mismo router. Si falla la generación del certificado o el bind del puerto, degrada a modo HTTP-only devolviendo `nil`.

El enfoque `net.Listen + tls.NewListener` permite pasar el certificado directamente como `tls.Certificate` (en memoria) sin necesitar archivos `.pem` en disco como parámetros de `ListenAndServeTLS`.

---

## Banner de arranque

```go
fmt.Printf("\n🗂️  %s running!\n", config.AppName)
fmt.Printf("   Local (Tauri):  http://localhost:%d\n", config.Port)
fmt.Printf("   Network (web):  https://%s:%d\n", lanIp, config.HttpsPort)
fmt.Printf("   Max file size:  %d MB\n", config.MaxFileSizeMB)
// Formato especial para el IPC de Tauri — NO CAMBIAR esta línea
fmt.Printf("   PIN: %s\n", pin)
```

La línea del PIN **debe mantener exactamente este formato** (`   PIN: XXXXXX` con 3 espacios) ya que el proceso Tauri parsea stdout buscando ese patrón para extraer el PIN sin que el usuario lo escriba.

---

## Shutdown limpio

```go
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
<-quit

auth.ResetAuth()
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
_ = httpServer.Shutdown(ctx)
if httpsServer != nil {
    _ = httpsServer.Shutdown(ctx)
}
```

Al recibir SIGTERM o SIGINT:
1. `auth.ResetAuth()` borra el PIN, tokens y rate limits de memoria.
2. `Shutdown(ctx)` espera hasta 5 segundos a que las conexiones activas terminen antes de cerrar el servidor.

---

## CORS middleware

```go
func corsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-SrvFiles-Token")
        if r.Method == http.MethodOptions {
            w.WriteHeader(http.StatusNoContent)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

Permite cualquier origen (`*`) ya que los clientes son apps locales (Tauri, Flutter, navegadores LAN). Responde a preflight OPTIONS con `204 No Content` sin pasar al handler.
