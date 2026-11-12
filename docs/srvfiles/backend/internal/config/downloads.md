# config/downloads_*.go

**Archivo:** `backend/internal/config/downloads_windows.go, downloads_other.go`
**Rol:** Carpeta Descargas real del usuario, por plataforma.

---

`downloadsDir()` devuelve la carpeta Descargas que muestra el sistema, para que el servidor web comparta la misma carpeta que la app de escritorio:

- **Windows:** `windows.KnownFolderPath(FOLDERID_Downloads)`.
- **Linux:** `XDG_DOWNLOAD_DIR` de la variable de entorno o de `user-dirs.dirs` (`parseUserDirs` expande `$HOME`; `"$HOME/"` a secas significa sin carpeta). Si no está, `~/Downloads`.
- **macOS:** `~/Downloads`.

Devuelve `""` si no hay home; `config` cae entonces a `./uploads`.
