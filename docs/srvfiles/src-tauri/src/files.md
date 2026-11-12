# src-tauri/src/files.rs

**Archivo:** `src-tauri/src/files.rs`
**Rol:** Transferencias de archivos nativas en streaming.

---

| Comando | Qué hace |
|---|---|
| `path_info(paths)` | Nombre y tamaño de rutas arrastradas (omite carpetas). |
| `upload_files(url, token, paths, id)` | POST multipart con el token en la cabecera; evento `upload-progress`. |
| `download_file(url, token, file_name, id)` | A `Descargas/SrvFiles` sin sobrescribir; evento `download-progress`. |
| `cancel_transfer(id)` | Cancela una subida o descarga. |
| `begin_receive` / `append_receive` / `finish_receive` / `abort_receive` | Archivo de una transferencia P2P escrito chunk a chunk (`append_receive` recibe el cuerpo binario crudo con la cabecera `x-receive-id`). |

`sanitize_file_name` deja solo el último componente sin caracteres reservados; `create_unique` agrega " (n)" en lugar de sobrescribir.
