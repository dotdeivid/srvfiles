# logger.go

**Archivo:** `internal/logger/logger.go`
**Rol:** Sistema de logging estructurado con formato compatible con el winston del backend Node.js. Escribe a stdout en desarrollo y a `logs/errors.txt` para WARN y superiores.

---

## Formato de log

```
2026-01-01 12:00:05 INFO  [source] msg — {"key":"value"}
```

El formato replica exactamente el output de winston para que las herramientas de observabilidad existentes (Tauri log viewer, parsers de CI) no necesiten cambios.

- **Timestamp**: `2006-01-02 15:04:05` (formato de referencia de Go)
- **Nivel**: `DEBUG`, `INFO `, `WARN `, `ERROR` (con padding para alinear columnas)
- **Source**: nombre del archivo que llama al logger, entre corchetes
- **Msg**: mensaje libre
- **Contexto**: pares clave-valor serializados como JSON inline tras ` — `

---

## Niveles

```go
type level int
const (
    levelDebug level = iota
    levelInfo
    levelWarn
    levelError
)
```

Los métodos públicos son `Debug`, `Info`, `Warn` y `Error`. Todos tienen la misma firma:

```go
func (l *Logger) Info(source, msg string, args ...any)
```

`args` son pares `key, value` que se serializan como objeto JSON en el contexto del log.

---

## Destinos de escritura

```go
func (l *Logger) write(lvl level, source, msg string, args ...any) {
    // ...
    if lvl >= levelWarn {
        fmt.Fprint(l.fileOut, line) // → logs/errors.txt
    }
    if l.isDev {
        fmt.Fprint(os.Stdout, line) // → stdout (solo en dev)
    }
}
```

- **Siempre**: WARN y ERROR se escriben en `logs/errors.txt`.
- **Solo en dev** (`APP_ENV != "production"`): todos los niveles van a stdout.

En producción (binario de Tauri) el servidor no escribe a stdout después del banner de arranque, evitando que el IPC de Tauri confunda logs con el PIN.

---

## Singleton global

```go
var Log = newLogger()
```

`newLogger()` se llama al inicializar el paquete. Crea el directorio `logs/` si no existe, abre (o crea) `logs/errors.txt` en modo append, y detecta si `APP_ENV == "production"`. El resto del código usa `logger.Log.Info(...)` directamente.

---

## ¿Por qué no `log/slog`?

Go 1.21 introdujo `log/slog`, pero su formato por defecto no coincide con el de winston. Implementar un handler `slog.Handler` personalizado requeriría más código que el logger propio. Dado que el formato es un requisito explícito del proyecto, el logger custom es la opción más simple y directa.
