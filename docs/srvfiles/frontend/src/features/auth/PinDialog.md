# PinDialog.tsx

**File:** `src/features/auth/PinDialog.tsx`
**Purpose:** Modal component that prompts the user to enter the 6-digit server PIN. Shown automatically when connecting to a remote server or when auto-authentication fails.

---

## Exports

### `PinDialog`

**Props:**

```ts
interface PinDialogProps {
  isOpen: boolean;
  serverUrl: string;      // Used to display the server host (protocol stripped)
  error?: string | null;  // Error message shown below the input
  onSubmit: (pin: string) => void;
}
```

---

## Key behaviors

- **Guard:** Returns `null` when `isOpen` is `false` — the modal is not present in the DOM while closed.
- **Focus on open:** A `useEffect` with a 50 ms timeout focuses the PIN input whenever `isOpen` becomes `true`, and clears the current value, so the field is always empty when re-opened.
- **Input validation:** The `onChange` handler strips non-digit characters and enforces a maximum length of 6. The submit button is disabled until exactly 6 digits are present.
- **Submit:** `handleSubmit` calls `onSubmit(pin)` only if `pin.length === 6`, preventing submission of incomplete PINs via Enter key.
- **Host display:** Uses `stripProtocol(serverUrl)` to show only the host portion (e.g. `192.168.1.5:3001`) in the subtitle.
- **CSS classes:** Uses `modal-overlay`, `pin-modal`, `pin-modal__title`, `pin-modal__subtitle`, `pin-modal__host`, `pin-modal__row`, `pin-modal__input`, `pin-modal__error`.
