# storage.go

**Archivo:** `internal/storage/storage.go`
**Rol:** Garantiza que el directorio de uploads exista en disco al arrancar el servidor.

---

## `Init`

```go
func Init() {
    if err := os.MkdirAll(config.UploadsDir, 0755); err != nil {
        logger.Log.Error("storage.go", "Failed to create uploads directory",
            "path", config.UploadsDir, "error", err)
        os.Exit(1)
    }
    logger.Log.Info("storage.go", "Uploads directory ready", "path", config.UploadsDir)
}
```

`os.MkdirAll` crea el directorio y todos los intermedios necesarios. Es idempotente: si el directorio ya existe, no hace nada. Los permisos `0755` permiten al proceso leer y escribir, y a otros usuarios leer (comportamiento estándar en Unix).

Se llama una sola vez al inicio de `main()`, antes de registrar cualquier ruta.

---

## ¿Por qué un paquete separado?

- Centraliza la decisión de qué directorio usar (`config.UploadsDir`).
- `main.go` llama `storage.Init()` explícitamente, lo que deja clara la secuencia de inicialización.
- Los tests de `files` pueden apuntar a un directorio temporal sin modificar `main.go`.
