# auth/middleware.go

**Archivo:** `internal/auth/middleware.go`
**Rol:** Middleware chi que protege las rutas privadas verificando que la petición incluya un token de sesión válido.

---

## `RequireAuth`

```go
func RequireAuth(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("X-SrvFiles-Token")
        if token == "" {
            token = r.URL.Query().Get("token")
        }
        if !ValidateToken(token) {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

Busca el token en dos lugares (en orden):

1. **Header `X-SrvFiles-Token`**: usado por las llamadas fetch del frontend React y la app Flutter.
2. **Query param `?token=`**: usado por el endpoint de descarga (`/api/files/download/:filename`) cuando el navegador abre la URL directamente (no puede añadir headers custom a una navegación `<a href>`).

Si el token no está presente o no es válido, responde `401 Unauthorized` y **no** llama al handler siguiente.

---

## Integración con chi

El middleware se aplica a un grupo de rutas en `main.go`:

```go
r.Group(func(r chi.Router) {
    r.Use(auth.RequireAuth)
    // ... rutas protegidas
})
```

chi evalúa los middlewares del grupo antes de hacer match de la ruta, por lo que `RequireAuth` se ejecuta incluso si la ruta no existe dentro del grupo (devuelve 401 antes del 404).
