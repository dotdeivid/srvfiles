# src-tauri/src/files.rs

**Archivo:** `src-tauri/src/files.rs`
**Rol:** Transferencias de archivos nativas en streaming.

---

| Comando | Qué hace |
|---|---|
| `path_info(paths)` | Nombre y tamaño de rutas arrastradas (omite carpetas). |
| `upload_files(url, token, paths, id)` | POST multipart con el token en la cabecera; evento `upload-progress`. |
| `download_file(url, token, file_name, id)` | A `Descargas/SrvFiles` sin sobrescribir; evento `download-progress`. |
| `show_in_folder(file_name)` | Muestra un archivo de `Descargas/SrvFiles` en el explorador del sistema (`open -R` en macOS, `explorer /select,` en Windows, `xdg-open` de la carpeta en Linux). Valida el nombre. |
| `cancel_transfer(id)` | Cancela una subida o descarga. |
| `begin_receive` / `append_receive` / `finish_receive` / `abort_receive` | Archivo de una transferencia P2P escrito chunk a chunk (`append_receive` recibe el cuerpo binario crudo con la cabecera `x-receive-id`). |

`Descargas/SrvFiles` (`downloads_dir`) es también la carpeta que comparte el servidor interno, así que lo descargado y lo recibido aparece en la lista de archivos.

- `sanitize_file_name` deja solo el último componente sin caracteres reservados.
- `create_temp` crea un archivo oculto `.srvfiles-upload-*`: el mismo prefijo que usa el backend Go para sus subidas, que nunca lo lista ni permite descargarlo. Descargas y recepciones se escriben ahí.
- `publish` lo publica al terminar con el primer nombre libre (`a.txt`, `a (1).txt`…) mediante un hard link, que falla si el nombre existe; en FAT/exFAT cae a renombrar. Nunca sobrescribe.
- `migrate_legacy_uploads` mueve a la carpeta compartida lo que quedó en `<datos de la app>/uploads`, la carpeta que usaba el servidor en versiones anteriores.
