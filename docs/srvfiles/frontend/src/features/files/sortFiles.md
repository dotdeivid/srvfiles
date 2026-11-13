# sortFiles.ts

**Archivo:** `frontend/src/features/files/sortFiles.ts`
**Rol:** Orden de la lista de archivos.

---

`SortKey`: `newest` (por defecto), `oldest`, `name` (orden natural en español: `a2` antes que `a10`) y `size` (más pesados primero). `sortFiles` devuelve una copia y resuelve empates por nombre. `SORT_LABELS` da el texto del selector e `isSortKey` valida lo guardado en `localStorage`.
