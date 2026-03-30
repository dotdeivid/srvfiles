# ConfirmModal.tsx

**File:** `src/shared/components/ConfirmModal.tsx`
**Purpose:** Generic in-app confirmation modal that replaces `window.confirm()`. Used before destructive actions such as file deletion.

---

## Exports

### `ConfirmModal`

**Props:**

```ts
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;          // default "Eliminar"
  confirmVariant?: 'danger' | 'primary';  // default "danger"
}
```

---

## Key behaviors

- **Guard:** Returns `null` when `isOpen` is `false`.
- **Backdrop dismiss:** Clicking the `.modal-overlay` calls `onCancel`.
- **Stop propagation:** Clicks inside the `.modal` panel do not bubble to the overlay.
- **Button variant:** The confirm button uses `btn--{confirmVariant}` CSS class (`btn--danger` for destructive actions, `btn--primary` for neutral ones).
- **IDs:** Root overlay: `id="confirm-modal"`. Cancel button: `id="confirm-cancel-btn"`. Confirm button: `id="confirm-action-btn"`.
