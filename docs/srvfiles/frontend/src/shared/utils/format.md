# format.ts

**Archivo:** `frontend/src/shared/utils/format.ts`
**Rol:** Formato de textos.

---

`stripProtocol(url)`, `formatBytes(bytes)` (B … EB, base 1024).

## `formatDate(iso, now?)`

Fecha corta para la lista de archivos: "hoy 14:05", "ayer 09:12", "13 nov" (este año) o "13 nov 2025". Hora de 24 h. Devuelve `''` si la fecha no es válida.
