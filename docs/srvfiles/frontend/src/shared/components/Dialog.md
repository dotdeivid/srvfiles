# Dialog.tsx

**Archivo:** `frontend/src/shared/components/Dialog.tsx`
**Rol:** Base común de todos los modales, sobre `<dialog>.showModal()`.

---

El navegador ya mantiene el foco dentro del diálogo, deja inerte la página de atrás y lo pone en la capa superior (sin `z-index`). El componente agrega:

- **Esc controlado:** cancela la tecla y llama a `onClose`. Sin `onClose` el diálogo no se puede descartar (transferencia entrante, PIN obligatorio). Se cancela el `keydown` y no solo el evento `cancel` porque Chrome cierra igual tras varios `cancel` cancelados seguidos; si aun así se cerrara por fuera de React, lo vuelve a abrir.
- **Clic fuera:** el fondo y el margen del `<dialog>` son el propio elemento. Cierra solo si el clic empezó y terminó ahí (seleccionar texto y soltar fuera no cierra). `closeOnBackdrop={false}` para formularios.
- **Foco:** `initialFocusRef` o el primer elemento enfocable; al cerrar vuelve al elemento que lo abrió.
- `role` (`alertdialog` para confirmaciones), `labelledBy` / `label` / `describedBy`.

`onClose` se guarda en un ref para que un callback inline del padre no reinicie el efecto. El scroll de la página se bloquea con `html:has(dialog[open])` en CSS.
