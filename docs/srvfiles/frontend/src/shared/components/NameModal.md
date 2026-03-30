# NameModal.tsx

**File:** `src/shared/components/NameModal.tsx`
**Purpose:** Modal that asks the user to choose a device display name. Shown on first launch (or when the user manually renames their device). Pre-filled with a randomly generated name.

---

## Exports

### `NameModal`

**Props:**

```ts
interface NameModalProps {
  isOpen: boolean;
  defaultName: string;   // Pre-filled value (random name or current name)
  onSave: (name: string) => void;
}
```

---

## Key behaviors

- **Guard:** Returns `null` when `isOpen` is `false`.
- **Reset on open:** A `useEffect` resets `value` to `defaultName` and calls `inputRef.current?.select()` (with a 50 ms timeout) whenever the modal opens with a new default name. This auto-selects the text so the user can overwrite it immediately.
- **Submit:** `handleSubmit` calls `onSave(value)` with the current input value. The caller (`App.tsx`'s `handleSaveName`) falls back to the existing random name if an empty string is passed.
- **Skip button:** An "Omitir" button calls `onSave('')`, keeping the current random name without user modification.
- **Max length:** `maxLength={32}` on the input.
- **Form ID:** `id="name-form"` on the `<form>` so the submit button can reference it via `form="name-form"` even though it lives outside the form element.
