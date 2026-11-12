# files/diskstats_*.go

**Archivo:** `backend/internal/files/diskstats_unix.go, diskstats_windows.go`
**Rol:** Espacio total/libre del volumen de subidas, por plataforma.

---

- Unix: `syscall.Statfs` (`Bavail` × `Bsize` como libre).
- Windows: `GetDiskFreeSpaceEx` vía `golang.org/x/sys/windows`.
