# IncomingTransferModal.tsx

**File:** `src/features/transfer/IncomingTransferModal.tsx`
**Purpose:** Modal that appears when another device requests to send a file to this client. Displays sender name, file name, and file size, and lets the user accept or reject.

---

## Exports

### `IncomingTransferModal`

**Props:**

```ts
interface IncomingTransferModalProps {
  request: IncomingTransferRequest | null;
  onAccept: () => void;
  onReject: () => void;
}
```

---

## Key behaviors

- **Null guard:** Returns `null` when `request` is `null` — the modal is not present in the DOM while inactive.
- **Overlay dismiss:** Clicking the `modal-overlay` backdrop calls `onReject`, treating a backdrop click as a rejection.
- **Stop propagation:** Clicks inside the modal `<div>` are stopped from bubbling to the overlay, preventing accidental rejection.
- **File size display:** Uses `formatBytes` from `shared/utils/format`.
- **Inline SVG icons:** The sender and file icons are inline SVGs (no external icon library dependency), ensuring they render even if Lucide is not yet loaded.
- **CSS classes:** Uses `modal-overlay`, `modal`, `transfer-modal`, `modal__header`, `modal__body`, `modal__footer`, `transfer-modal__sender`, `transfer-modal__file`, `transfer-modal__filename`, `transfer-modal__filesize`, `transfer-modal__message`.
