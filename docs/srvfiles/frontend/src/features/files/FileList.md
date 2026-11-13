# FileList.tsx

**Archivo:** `frontend/src/features/files/FileList.tsx`
**Rol:** Lista de archivos con búsqueda, vista lista/cuadrícula y virtualización.

---

- Búsqueda con debounce de 200 ms (`type="search"` con `aria-label`). Mientras se busca muestra "N de M archivos"; el total va en el título de la sección ("Carpeta compartida") en `App`.
- Botones de vista con `aria-pressed`.
- En vista lista con más de `VIRTUAL_THRESHOLD` archivos usa `@tanstack/react-virtual`.
- Estados vacío / sin resultados. Renderiza `FileItem`.
