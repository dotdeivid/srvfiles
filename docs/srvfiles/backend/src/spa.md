# spa_dev.go / spa_embed.go

**Archivos:** `cmd/server/spa_dev.go` · `cmd/server/spa_embed.go`
**Rol:** Sirven el frontend React (Vite) con fallback SPA para React Router. Existen dos implementaciones seleccionadas en tiempo de compilación mediante build tags.

---

## Build tags

| Archivo | Tag | Cuándo se usa |
| :--- | :--- | :--- |
| `spa_dev.go` | `//go:build !embed` | Desarrollo y `go run` — lee del sistema de archivos |
| `spa_embed.go` | `//go:build embed` | Producción — frontend embebido en el binario |

Ambos exponen la misma función `newSPAHandler() http.Handler`, que es lo único que llama `main.go`.

---

## spa_dev.go — modo desarrollo (sistema de archivos)

```go
func newSPAHandler() http.Handler {
    return spaHandlerDir(frontendDistPath())
}

func frontendDistPath() string {
    if exe, err := os.Executable(); err == nil {
        candidate := filepath.Join(filepath.Dir(exe), "..", "frontend", "dist")
        if _, err := os.Stat(candidate); err == nil {
            return candidate
        }
    }
    return filepath.Join("..", "frontend", "dist")
}
```

`frontendDistPath` resuelve la ruta al `dist/` de Vite de forma relativa al binario compilado (útil cuando Tauri lo lanza desde cualquier directorio) o como fallback relativo al directorio de trabajo.

```go
func spaHandlerDir(distDir string) http.Handler {
    fs         := http.Dir(distDir)
    fileServer := http.FileServer(fs)

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if strings.HasPrefix(r.URL.Path, "/api") {
            http.NotFound(w, r)
            return
        }
        f, err := fs.Open(r.URL.Path)
        if err != nil {
            http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
            return
        }
        f.Close()
        fileServer.ServeHTTP(w, r)
    })
}
```

Si el path no existe en disco, sirve `index.html` para que React Router gestione la ruta en el cliente. El guard `/api` evita que el handler intercepte rutas API desconocidas (que chi ya respondió con 404 antes de llegar aquí; esta comprobación es defensiva).

---

## spa_embed.go — modo producción (binario autocontenido)

```go
//go:embed frontend/dist
var frontendAssets embed.FS
```

El directorio `frontend/dist` se copia en `cmd/server/frontend/dist` por el script de build **antes** de compilar. La directiva `//go:embed` incluye todos los archivos del directorio en el binario en tiempo de compilación. Tras compilar, el directorio copiado se elimina; el binario resultante no depende de archivos externos para el frontend.

```go
func newSPAHandler() http.Handler {
    sub, _ := fs.Sub(frontendAssets, "frontend/dist")
    fileServer := http.FileServerFS(sub)

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if strings.HasPrefix(r.URL.Path, "/api") {
            http.NotFound(w, r)
            return
        }
        path := strings.TrimPrefix(r.URL.Path, "/")
        if path == "" { path = "index.html" }

        f, err := sub.Open(path)
        if err != nil {
            // Fallback SPA: sirve index.html para React Router
            r2 := r.Clone(r.Context())
            r2.URL.Path = "/index.html"
            fileServer.ServeHTTP(w, r2)
            return
        }
        f.Close()
        fileServer.ServeHTTP(w, r)
    })
}
```

`fs.Sub` elimina el prefijo `frontend/dist` para que las rutas del frontend (`/assets/app.js`) mapeen directamente a los archivos embebidos.

---

## ¿Por qué dos archivos en lugar de una variable booleana?

Go evalúa los build tags en tiempo de compilación, lo que permite que el compilador elimine completamente el código de producción en builds de desarrollo (y viceversa). Una variable booleana o flag en runtime no reduciría el tamaño del binario ni eliminaría la dependencia en `embed.FS`. Los build tags son el mecanismo idiomático de Go para este patrón.
