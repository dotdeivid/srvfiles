# CopyButton.tsx

**Archivo:** `frontend/src/shared/components/CopyButton.tsx`
**Rol:** Botón de copiar con confirmación (✓) durante 2 s.

---

Usa `navigator.clipboard` y, sin contexto seguro (HTTP), un `textarea` con `execCommand('copy')`. Ese `textarea` se agrega dentro del `<dialog>` abierto si lo hay, porque con un modal abierto el resto de la página es inerte y no se puede seleccionar.
