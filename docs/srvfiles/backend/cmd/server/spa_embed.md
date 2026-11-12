# cmd/server/spa_embed.go

**Archivo:** `backend/cmd/server/spa_embed.go`
**Rol:** Sirve el frontend embebido en el binario (build con `-tags embed`, lo usa el sidecar de la app de escritorio).

---

- `//go:embed frontend/dist`: `scripts/build-sidecar.sh` copia `frontend/dist` a `backend/cmd/server/frontend/dist` antes de compilar y lo borra después.
- Mismo comportamiento que `spa_dev.go`: `/api` → 404, rutas desconocidas → `index.html`.
