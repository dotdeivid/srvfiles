# ConfirmModal.tsx

**Archivo:** `frontend/src/shared/components/ConfirmModal.tsx`
**Rol:** Modal de confirmación (reemplaza `window.confirm`).

---

Título, mensaje, botones confirmar/cancelar; variante peligrosa (`.btn--danger`, rojo oscuro con texto blanco) para borrar. Es un `alertdialog` con título y mensaje enlazados por `aria-labelledby` / `aria-describedby`. Sobre `Dialog`: el foco arranca en **Cancelar**, Esc o el clic fuera cancelan y al cerrarse el foco vuelve al elemento que lo abrió.
