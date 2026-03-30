# useDeviceName.ts

**File:** `src/shared/hooks/useDeviceName.ts`
**Purpose:** React hook that manages the device display name used to identify this client in the transfer peer list. Persists the name in `localStorage` and auto-generates a random name on first use.

---

## Exports

### `useDeviceName(): { deviceName: string; showNameModal: boolean; saveName: (name: string) => void }`

---

## Key behaviors

- **Storage key:** `VITE_STORAGE_KEY` env var, defaulting to `"srvfiles-device-name"`.
- **First launch:** If no name is saved in `localStorage`, a random `"Adjective Animal"` name (in Spanish, e.g. "Rápido Zorro") is generated via `randomName()`, immediately stored in `localStorage`, and used as the initial `deviceName`. `showNameModal` starts as `false` — the name is auto-assigned without requiring user input.
- **`saveName(name)`:** Trims `name`. If it is empty or whitespace-only, keeps the current `deviceName` as the fallback. Otherwise stores the trimmed value. Sets `showNameModal = false`.
- **`showNameModal`:** Can be set to `true` externally (e.g. by `App.tsx` opening the rename modal via `renameOpen` state). The modal renders when `showNameModal || renameOpen` is true.
- **Name vocabulary:** 8 adjectives × 8 animals = 64 possible random names, all in Spanish.
