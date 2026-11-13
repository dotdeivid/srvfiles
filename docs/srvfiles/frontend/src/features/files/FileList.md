# FileList.tsx

**Archivo:** `frontend/src/features/files/FileList.tsx`
**Rol:** Lista de archivos con búsqueda, orden, selección múltiple, vista lista/cuadrícula y virtualización.

---

- Búsqueda con debounce de 200 ms (`type="search"` con `aria-label`). Mientras se busca muestra "N de M archivos"; el total va en el título de la sección ("Carpeta compartida") en `App`.
- Orden con un `<select>` (`sortFiles`). La vista y el orden se guardan en `localStorage` (por navegador, con `try/catch` por si el almacenamiento está bloqueado).
- **Selección múltiple:** checkbox por archivo y "seleccionar todos" (en la cabecera de la tabla, o en la barra en la vista cuadrícula; queda indeterminado con selección parcial). La barra fija muestra cuántos y cuánto pesan, con **Descargar** (`downloadFiles`; no aparece si los archivos ya están en este equipo) y **Eliminar** (`onRequestDelete(names)`, que confirma en `App`). La selección solo cuenta archivos que siguen existiendo y se ven con la búsqueda actual: nunca se actúa sobre algo que no está en pantalla.
- Botones de vista con `aria-pressed`.
- En vista lista con más de `VIRTUAL_THRESHOLD` archivos usa `@tanstack/react-virtual`.
- Estados vacío / sin resultados. Renderiza `FileItem`.
