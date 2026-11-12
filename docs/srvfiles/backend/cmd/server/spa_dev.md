# cmd/server/spa_dev.go

**Archivo:** `backend/cmd/server/spa_dev.go`
**Rol:** Sirve el frontend desde disco durante el desarrollo (build sin la etiqueta `embed`).

---

- `newSPAHandler()` sirve `../frontend/dist` (relativo al binario o al directorio actual).
- Las rutas que empiezan por `/api` devuelven 404 (nunca el `index.html`).
- Cualquier otra ruta inexistente devuelve `index.html` para el enrutado del lado del cliente.

En producción lo reemplaza `spa_embed.go`.
