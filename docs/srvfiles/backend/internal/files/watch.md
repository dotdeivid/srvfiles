# files/watch.go

**Archivo:** `backend/internal/files/watch.go`
**Rol:** Detecta cambios en la carpeta de archivos que no pasan por la API.

---

`WatchUploadsDir(interval)` (lo lanza `main.go` cada 2 s) compara la fecha de modificación de `UPLOADS_DIR`, que cambia al crear, borrar o renombrar archivos dentro de ella en Windows, macOS y Linux. Si cambió, invalida la caché del listado y llama a `OnFilesChanged`, que manda el evento `files-changed` por WebSocket.

Cubre lo que recibe la app de escritorio por P2P, las descargas desde otros servidores (los dos van a `Descargas/SrvFiles`, la carpeta del servidor) y los archivos copiados a mano. Los archivos en curso se escriben con un nombre temporal oculto y se renombran al terminar, así que el aviso llega con el archivo completo.
