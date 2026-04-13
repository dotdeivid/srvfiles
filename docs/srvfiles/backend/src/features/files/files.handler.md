# files/handler.go

**Archivo:** `internal/files/handler.go`
**Rol:** Handlers HTTP para todas las operaciones de archivo: listar, subir, descargar, previsualizar, eliminar y estadísticas de disco. Emite notificaciones WebSocket tras mutaciones.

---

## `OnFilesChanged`

```go
var OnFilesChanged func()
```

Variable de función inyectada desde `main.go`:

```go
files.OnFilesChanged = transfer.Default.BroadcastFilesChanged
```

Permite que el paquete `files` notifique a los clientes WebSocket sin importar `transfer` directamente (evita dependencia circular). Se llama después de cada upload y delete exitoso.

---

## `List` — `GET /api/files`

```go
func List(w http.ResponseWriter, r *http.Request) {
    list, err := ListFiles()
    if err != nil {
        http.Error(w, "Internal Server Error", http.StatusInternalServerError)
        return
    }
    writeJSON(w, http.StatusOK, list)
}
```

---

## `Upload` — `POST /api/files/upload`

```go
func Upload(w http.ResponseWriter, r *http.Request) {
    r.ParseMultipartForm(int64(config.MaxFileSizeMB) << 20)
    form := r.MultipartForm
    if form == nil { /* 400 */ return }

    var uploaded []UploadedFileInfo
    for _, headers := range form.File {
        for _, header := range headers {
            name := SafeName(header.Filename)
            dst, _ := os.Create(filepath.Join(config.UploadsDir, name))
            src, _ := header.Open()
            io.Copy(dst, src)
            src.Close()
            dst.Close()
            uploaded = append(uploaded, UploadedFileInfo{Name: name, Size: header.Size})
        }
    }

    if OnFilesChanged != nil { OnFilesChanged() }
    writeJSON(w, http.StatusOK, map[string]any{"uploaded": uploaded})
}
```

`ParseMultipartForm` con el límite en bytes actúa como el middleware `multer` de Express: rechaza automáticamente cuerpos que superen el límite. `io.Copy` transfiere el stream del multipart directamente a disco sin cargar el archivo completo en memoria.

---

## `Download` — `GET /api/files/download/{filename}`

```go
func Download(w http.ResponseWriter, r *http.Request) {
    filename := chi.URLParam(r, "filename")
    path, err := ResolvePath(filename)
    if err != nil { http.Error(w, "Not Found", 404); return }

    w.Header().Set("Content-Disposition",
        fmt.Sprintf(`attachment; filename="%s"`, filename))
    http.ServeFile(w, r, path)
}
```

`Content-Disposition: attachment` fuerza la descarga en el navegador. `http.ServeFile` usa el syscall `sendfile` en Linux/macOS para transferir el archivo directamente del kernel sin copiarlo a userspace — máxima eficiencia para archivos grandes.

---

## `Preview` — `GET /api/files/preview/{filename}`

```go
func Preview(w http.ResponseWriter, r *http.Request) {
    filename := chi.URLParam(r, "filename")
    path, err := ResolvePath(filename)
    if err != nil { http.Error(w, "Not Found", 404); return }

    // Sin Content-Disposition: inline por defecto → el navegador muestra el archivo
    http.ServeFile(w, r, path)
}
```

Sin header `Content-Disposition`, el navegador decide si mostrar o descargar según el MIME type. `http.ServeFile` detecta automáticamente el MIME type por la extensión.

---

## `Delete` — `DELETE /api/files/{filename}`

```go
func Delete(w http.ResponseWriter, r *http.Request) {
    filename := chi.URLParam(r, "filename")
    if err := DeleteFile(filename); err != nil {
        http.Error(w, "Not Found", http.StatusNotFound)
        return
    }
    if OnFilesChanged != nil { OnFilesChanged() }
    w.WriteHeader(http.StatusNoContent)
}
```

---

## `Stats` — `GET /api/files/stats`

```go
func Stats(w http.ResponseWriter, r *http.Request) {
    stats, err := GetDiskStats()
    if err != nil {
        http.Error(w, "Internal Server Error", 500)
        return
    }
    writeJSON(w, http.StatusOK, stats)
}
```

Devuelve `{ total, free, used }` en bytes.
