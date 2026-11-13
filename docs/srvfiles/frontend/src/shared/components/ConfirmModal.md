# ConfirmModal.tsx

**Archivo:** `frontend/src/shared/components/ConfirmModal.tsx`
**Rol:** Modal de confirmación (reemplaza `window.confirm`).

---

Título, mensaje, botones confirmar/cancelar; variante peligrosa (`.btn--danger`, rojo oscuro con texto blanco) para borrar. Es un `alertdialog` con título y mensaje enlazados por `aria-labelledby` / `aria-describedby`. El foco arranca en **Cancelar**, Esc cancela y al cerrarse el foco vuelve al elemento que lo abrió. `onCancel` se guarda en un ref para que un callback inline del padre no reinicie el efecto en cada render.
