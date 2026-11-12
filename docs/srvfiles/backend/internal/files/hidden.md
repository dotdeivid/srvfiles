# files/hidden_*.go

**Archivo:** `backend/internal/files/hidden_unix.go, hidden_windows.go`
**Rol:** Atributos de archivo oculto por plataforma.

---

`isHiddenPlatform(info)`: en Windows, `true` si el archivo tiene `FILE_ATTRIBUTE_HIDDEN` o `FILE_ATTRIBUTE_SYSTEM`; en el resto, siempre `false` (el punto inicial lo resuelve `IsHidden` en `service.go`).
