# diskstats_unix.go / diskstats_windows.go

**Archivos:** `internal/files/diskstats_unix.go` · `internal/files/diskstats_windows.go`
**Rol:** Implementación multiplataforma de `getDiskStats` mediante build tags. Devuelve el espacio total, libre y usado del disco donde vive el directorio de uploads.

---

## Build tags

| Archivo | Tag | Plataforma |
| :--- | :--- | :--- |
| `diskstats_unix.go` | `//go:build !windows` | macOS, Linux |
| `diskstats_windows.go` | `//go:build windows` | Windows |

Ambos exponen la misma función interna `getDiskStats(path string) (DiskStats, error)`.

---

## diskstats_unix.go

```go
//go:build !windows

func getDiskStats(path string) (DiskStats, error) {
    var stat syscall.Statfs_t
    if err := syscall.Statfs(path, &stat); err != nil {
        return DiskStats{}, err
    }
    total := stat.Blocks * uint64(stat.Bsize)
    free  := stat.Bavail * uint64(stat.Bsize)
    return DiskStats{
        Total: total,
        Free:  free,
        Used:  total - free,
    }, nil
}
```

`syscall.Statfs` es una llamada al sistema POSIX disponible en macOS y Linux. `Bavail` (bloques disponibles para procesos no-root) en lugar de `Bfree` (bloques libres totales) da el espacio que un proceso de usuario puede usar realmente.

---

## diskstats_windows.go

```go
//go:build windows

func getDiskStats(path string) (DiskStats, error) {
    pathPtr, _ := syscall.UTF16PtrFromString(path)
    var freeBytesAvailable, totalBytes, totalFreeBytes uint64
    err := syscall.GetDiskFreeSpaceEx(
        pathPtr,
        &freeBytesAvailable,
        &totalBytes,
        &totalFreeBytes,
    )
    if err != nil { return DiskStats{}, err }
    return DiskStats{
        Total: totalBytes,
        Free:  freeBytesAvailable,
        Used:  totalBytes - freeBytesAvailable,
    }, nil
}
```

`GetDiskFreeSpaceEx` es la API Win32 equivalente a `Statfs`. `freeBytesAvailable` es el espacio disponible para el usuario actual (respeta quotas de disco).

---

## ¿Por qué build tags en lugar de `runtime.GOOS`?

Los build tags eliminan el código de la plataforma no objetivo en tiempo de compilación. Con `runtime.GOOS` ambas implementaciones compilarían en todos los targets, lo que requeriría stubs o imports condicionales. Los build tags son el patrón idiomático de Go para código específico de plataforma.
