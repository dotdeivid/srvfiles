# FileList.tsx

**Archivo:** `frontend/src/features/files/FileList.tsx`
**Rol:** Lista de archivos con búsqueda, vista lista/cuadrícula y virtualización.

---

- Búsqueda con debounce de 200 ms.
- En vista lista con más de `VIRTUAL_THRESHOLD` archivos usa `@tanstack/react-virtual`.
- Estados vacío / sin resultados. Renderiza `FileItem`.
