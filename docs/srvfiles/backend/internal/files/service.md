# files/service.go

**Archivo:** `backend/internal/files/service.go`
**Rol:** Lógica de archivos: nombres seguros, resolución de rutas, listado, guardado y borrado.

---

## Nombres

- `SanitizeFilename(name)` para subidas: normaliza a NFC, se queda con el último componente de la ruta, reemplaza caracteres de control y los reservados de Windows (`: * ? " < > |`), quita puntos y espacios de los extremos, limita a 240 bytes y antepone `_` a nombres reservados (`CON`, `PRN`, …). Conserva letras de cualquier idioma, espacios y `..` dentro del nombre. Error `ErrInvalidName` si queda vacío.
- `ResolvePath(name)` para lectura y borrado: **valida sin transformar** (rechaza `/`, `\`, NUL, `.`, `..` y temporales) y comprueba que la ruta quede dentro de `UPLOADS_DIR`. Así los archivos copiados a mano con acentos se pueden descargar y borrar.

## Guardado

`SaveStream(name, reader, maxBytes)`:

1. Copia el contenido a un temporal oculto `.srvfiles-upload-*` (no se lista).
2. Si supera `maxBytes` → `ErrTooLarge` sin dejar nada en disco.
3. Publica con `os.Link` al nombre final, que falla si ya existe: dos subidas simultáneas con el mismo nombre nunca se pisan (`nombre (1).ext`, `nombre (2).ext`…). Si el sistema de archivos no soporta hard links usa `rename`.

## Listado y otros

- `ListFiles()` (caché de 500 ms, invalidada con `InvalidateListCache()` tras subir o borrar), más reciente primero.
- `DeleteFile(name)`, `GetDiskStats()` (implementación por plataforma en `diskstats_*.go`).
