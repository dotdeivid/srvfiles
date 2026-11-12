# files/handler.go

**Archivo:** `backend/internal/files/handler.go`
**Rol:** Handlers HTTP de archivos.

---

| Handler | Ruta | Detalles |
|---|---|---|
| `List` | `GET /api/files` | `{files, count}`. |
| `Upload` | `POST /api/files/upload` | Multipart **en streaming** (`MultipartReader` + `SaveStream`): cada archivo se escribe una sola vez. Comprueba espacio libre (si viene `Content-Length`), límite por archivo y cantidad máxima. Responde `{files, failed}` con el motivo de cada fallo; `400` si no se guardó ninguno; `507` sin espacio. |
| `Link` | `POST /api/files/link` | `{"name"}` → `{token, expiresIn}`: token de enlace de un solo archivo para URLs. |
| `Download` | `GET /api/files/download/{filename}` | `attachment` con `filename*` UTF-8 (RFC 6266), CSP `sandbox`, `Range` vía `http.ServeFile`. |
| `Preview` | `GET /api/files/preview/{filename}` | Inline. HTML/XML/JS se sirven como `text/plain`; todo salvo PDF lleva CSP `sandbox` (un archivo subido no puede ejecutar scripts en el origen del servidor). SVG conserva su tipo para verse en `<img>`. |
| `Delete` | `DELETE /api/files/{filename}` | `404` si no existe, `400` si el nombre es inválido. |
| `Stats` | `GET /api/files/stats` | `{total, free, used}`. |

`fileParam(r)` decodifica `{filename}` cuando chi enruta sobre `RawPath` (escapes como `%5B` en `foo[1].txt`, que antes daban 404).

Tras subir o borrar llama a `OnFilesChanged` (broadcast `files-changed`).
