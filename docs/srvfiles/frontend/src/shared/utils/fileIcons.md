# fileIcons.ts

**Archivo:** `frontend/src/shared/utils/fileIcons.ts`
**Rol:** Emoji por extensión de archivo.

---

`getFileIcon(nombre)` según la extensión (sin distinguir mayúsculas):

| Grupo | Ícono | Ejemplos |
|---|---|---|
| Texto y documentos | 📝 | `txt`, `md`, `markdown`, `doc`, `docx`, `odt`, `rtf`, `log` |
| PDF | 📄 | `pdf` |
| Imágenes | 🖼️ | `jpg`, `png`, `gif`, `svg`, `webp`, `heic` |
| Video | 🎬 | `mp4`, `mkv`, `mov`, `webm` |
| Audio | 🎵 | `mp3`, `wav`, `flac`, `m4a`, `opus` |
| Comprimidos | 📦 | `zip`, `rar`, `7z`, `tar`, `gz` |
| Apps e instaladores | 💿 | `apk`, `exe`, `msi`, `dmg`, `deb`, `iso` |
| Código | ⚙️ | `js`, `ts`, `py`, `go`, `rs`, `dart`, `sh` |
| Web y datos | 🌐 | `html`, `css`, `json`, `xml`, `yaml`, `toml` |
| Hojas y presentaciones | 📊 | `xlsx`, `csv`, `pptx`, `ods` |

Por defecto, 📃 (documento genérico; antes era 📁, que parecía una carpeta). La app móvil tiene el mismo mapa en `lib/utils/file_icons.dart`.
