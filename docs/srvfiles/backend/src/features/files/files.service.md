# files/service.go

**Archivo:** `internal/files/service.go`
**Rol:** Lógica de negocio para operaciones de archivo: listar, resolver rutas, eliminar, estadísticas de disco y sanitización de nombres. Equivalente a `files.service.ts` + `shared/utils/sanitize.ts`.

---

## Tipos

```go
type FileInfo struct {
    Name    string    `json:"name"`
    Size    int64     `json:"size"`
    ModTime time.Time `json:"modTime"`
    MimeType string   `json:"mimeType"`
}

type DiskStats struct {
    Total uint64 `json:"total"`
    Free  uint64 `json:"free"`
    Used  uint64 `json:"used"`
}
```

---

## `ListFiles`

```go
func ListFiles() ([]FileInfo, error) {
    entries, _ := os.ReadDir(config.UploadsDir)
    files := make([]FileInfo, 0, len(entries))
    for _, e := range entries {
        if e.IsDir() { continue }
        info, _ := e.Info()
        files = append(files, FileInfo{
            Name:     e.Name(),
            Size:     info.Size(),
            ModTime:  info.ModTime(),
            MimeType: mime.TypeByExtension(filepath.Ext(e.Name())),
        })
    }
    sort.Slice(files, func(i, j int) bool {
        return files[i].ModTime.After(files[j].ModTime)
    })
    return files, nil
}
```

Ordena por `ModTime` descendente (más reciente primero), igual que el backend Node.js.

---

## `SanitizeFilename`

```go
var (
    reUnsafe   = regexp.MustCompile(`[^\w\s\-.]`)
    reSpaces   = regexp.MustCompile(`\s+`)
)

func SanitizeFilename(name string) string {
    // Rechaza path traversal
    if strings.Contains(name, "..") ||
       strings.Contains(name, "/")  ||
       strings.Contains(name, "\\") {
        return ""
    }
    name = reUnsafe.ReplaceAllString(name, "")
    name = reSpaces.ReplaceAllString(name, "_")
    name = strings.Trim(name, ".")
    return name
}
```

Replica exactamente la lógica de `sanitize.ts`:
1. Rechaza nombres con `..`, `/`, `\` (path traversal).
2. Elimina caracteres que no sean `\w`, espacios, `-` o `.`.
3. Colapsa espacios y los convierte en `_`.
4. Elimina puntos al inicio y al final.

Si el resultado está vacío, el handler genera un nombre de fallback con timestamp.

---

## `SafeName`

```go
func SafeName(originalName string) string {
    sanitized := SanitizeFilename(originalName)
    if sanitized == "" {
        ext := filepath.Ext(originalName)
        sanitized = fmt.Sprintf("file_%d%s", time.Now().UnixMilli(), ext)
    }
    return resolveConflict(sanitized)
}

func resolveConflict(name string) string {
    path := filepath.Join(config.UploadsDir, name)
    if _, err := os.Stat(path); os.IsNotExist(err) {
        return name
    }
    ext  := filepath.Ext(name)
    base := strings.TrimSuffix(name, ext)
    return fmt.Sprintf("%s_%d%s", base, time.Now().UnixMilli(), ext)
}
```

Si ya existe un archivo con el mismo nombre, añade un timestamp en milisegundos al nombre base. Equivale al comportamiento de `multer` con `filename` personalizado en el backend Node.js.

---

## `GetDiskStats`

```go
func GetDiskStats() (DiskStats, error) {
    return getDiskStats(config.UploadsDir)
}
```

Delega a una función definida en `diskstats_unix.go` o `diskstats_windows.go` según el sistema operativo en tiempo de compilación (build tags).

---

## `ResolvePath` / `DeleteFile`

```go
func ResolvePath(filename string) (string, error) {
    clean := filepath.Clean(filepath.Join(config.UploadsDir, filename))
    if !strings.HasPrefix(clean, config.UploadsDir) {
        return "", errors.New("path traversal detected")
    }
    return clean, nil
}

func DeleteFile(filename string) error {
    path, err := ResolvePath(filename)
    if err != nil { return err }
    return os.Remove(path)
}
```

`ResolvePath` usa `filepath.Clean` para resolver `..` y verifica que la ruta resultante siga dentro de `UploadsDir`. Es la segunda línea de defensa contra path traversal (la primera es `SanitizeFilename`).
