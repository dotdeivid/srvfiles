# cmd/server/main.go

**Archivo:** `backend/cmd/server/main.go`
**Rol:** Punto de entrada del backend: arma el router, genera el PIN y levanta los servidores HTTP y HTTPS.

---

## Arranque

1. `storage.Init()` crea la carpeta de subidas.
2. Conecta `files.OnFilesChanged` con `transfer.Default.BroadcastFilesChanged` (evento `files-changed` por WebSocket).
3. `newRouter()` y `auth.GeneratePin()`.
4. Escucha HTTP en `HOST:PORT` de forma síncrona: si el puerto está ocupado escribe `SRVFILES_ERROR port_in_use <puerto>` en stderr (la app de escritorio lo muestra en un diálogo) y sale con código 1.
5. `startHTTPS()` en `HTTPS_PORT` con el certificado de `cert.GetOrCreateCert` (si falla, sigue solo con HTTP). El puerto usa `tlsmux.Split`: las conexiones TLS van al servidor HTTPS y las de HTTP plano (alguien que escribió la IP sin `https://`) a un servidor que redirige a `https://` en el mismo puerto.
   - Si HTTPS arrancó, el servidor HTTP se envuelve con `webguard.RedirectToHTTPS`: los navegadores de otros equipos que abren la web por HTTP pasan a HTTPS.
   - `go files.WatchUploadsDir(2 * time.Second)`: avisa `files-changed` cuando la carpeta cambia por fuera de la API.
   - `announce.Start`: anuncio mDNS `_srvfiles._tcp` en el puerto HTTP; si falla solo se registra un aviso. Se detiene al apagar.
6. Imprime el banner con las URLs, la carpeta compartida y el PIN; espera SIGINT/SIGTERM y apaga con `Shutdown` (5 s).

## `newRouter()`

| Middleware | Para qué |
|---|---|
| `middleware.Recoverer` | Un panic en un handler no tumba el servidor. |
| `webguard.SecurityHeaders` | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. |
| `webguard.CORS` | Solo orígenes permitidos (ver `webguard`). |
| `compressExceptFiles` | Gzip salvo descargas, vistas previas y `/ws`. |

No se usa `middleware.RealIP`: el servidor no está detrás de un proxy y confiar en `X-Forwarded-For` permitía falsificar la IP (y leer el PIN).

| Ruta | Acceso |
|---|---|
| `GET /api/health`, `POST /api/auth`, `GET /ws` | Públicas (el WS se autentica en el primer mensaje). |
| `GET /api/pin` | Solo desde esta máquina (`auth.PinHandler`). |
| `/api/config`, `/api/discovery/scan`, `/api/files`, `/api/files/upload`, `/api/files/link`, `/api/files/stats`, `DELETE /api/files/{filename}` | `auth.RequireAuth` (cabecera `X-SrvFiles-Token`). |
| `GET /api/files/download/{filename}`, `GET /api/files/preview/{filename}` | `auth.RequireAuthOrLink` (cabecera o `?dl=` de un token de enlace). |
| `/*` | Frontend estático con fallback a `index.html` (`spa_dev.go` / `spa_embed.go`). |

## `newHTTPServer()`

`ReadHeaderTimeout` 10 s, `IdleTimeout` 120 s, `MaxHeaderBytes` 64 KB. Sin `WriteTimeout` global para no cortar descargas largas. HTTPS exige TLS 1.2+ y anuncia HTTP/2.
