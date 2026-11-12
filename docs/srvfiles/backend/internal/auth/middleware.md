# auth/middleware.go

**Archivo:** `backend/internal/auth/middleware.go`
**Rol:** Middlewares de autorización de las rutas protegidas.

---

- `RequireAuth`: exige `X-SrvFiles-Token` válido. El token de sesión **nunca** se acepta en la URL.
- `RequireAuthOrLink`: para `GET` de descargas y vistas previas. Acepta la cabecera o `?dl=<token de enlace>` emitido para exactamente el archivo de la URL (último segmento decodificado).

Ambos responden `401 {"error":"Unauthorized"}` y registran la IP y la ruta.
