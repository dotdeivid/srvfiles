# src-tauri/src/lib.rs

**Archivo:** `src-tauri/src/lib.rs`
**Rol:** Shell de la app de escritorio.

---

- **Backend sidecar:** `choose_port()` usa 3001 si está libre (el que buscan los demás al escanear) o el primer par libre desde 3011. `spawn_backend` lanza el binario Go con `PORT`, `HTTPS_PORT`, `UPLOADS_DIR`, `CERTS_DIR`, `LOGS_DIR` y `APP_ENV=production`. `UPLOADS_DIR` es `Descargas/SrvFiles` (la misma carpeta de descargas y recepciones); antes de lanzar mueve ahí lo que hubiera en `<datos de la app>/uploads`. Si `Descargas` no está disponible, usa la carpeta de datos de la app. Si se cae lo reinicia hasta `MAX_RESTARTS` (3) veces y emite `backend-restarted`; si no puede arrancar (p. ej. `SRVFILES_ERROR port_in_use`) muestra un diálogo con la causa.
- **Una sola instancia:** abrir la app otra vez enfoca la ventana existente.
- **Plugins:** log, dialog, single-instance, shell, **updater** y **process** (reinicio tras actualizar).
- **Comandos:** `backend_port` y los de `files.rs` (incluido `show_in_folder`).
- Al cerrar, mata el sidecar.
