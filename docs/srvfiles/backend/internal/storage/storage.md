# storage/storage.go

**Archivo:** `backend/internal/storage/storage.go`
**Rol:** Inicialización de la carpeta de subidas.

---

`Init()` crea `UPLOADS_DIR` si no existe (lo llama `main` al arrancar). Si no puede (p. ej. sin permiso sobre Descargas), usa `./uploads` y lo registra en el log.
