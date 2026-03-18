import { useState, useEffect } from 'react';

const STORAGE_KEY = 'srvfiles-device-name';

const ADJECTIVES = ['Rápido', 'Azul', 'Verde', 'Veloz', 'Brillante', 'Tranquilo', 'Creativo', 'Curioso'];
const ANIMALS    = ['Zorro', 'Puma', 'Delfín', 'Águila', 'Jaguar', 'Lobo', 'Oso', 'Cóndor'];

/**
 * Generates a random display name by combining a random adjective with a random animal,
 * both in Spanish (e.g. `"Rápido Zorro"`, `"Azul Puma"`).
 *
 * @returns A two-word random name string.
 */
function randomName(): string {
  const adj    = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

/**
 * Manages the device display name used to identify this client in the transfer peer list.
 *
 * - On mount, reads the saved name from `localStorage`. If none exists, generates a
 *   random name and sets `showNameModal` to `true` so the user can confirm or change it.
 * - `saveName` persists the chosen name, updates state, and hides the modal.
 *
 * @returns An object with:
 *   - `deviceName` — the current display name (random or user-defined).
 *   - `showNameModal` — whether the first-launch name modal should be shown.
 *   - `saveName(name)` — persists the name; falls back to the current random name if empty.
 */
export function useDeviceName() {
  const [deviceName, setDeviceName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || randomName();
  });
  const [showNameModal, setShowNameModal] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // First launch — show modal so user can set a meaningful name
      setShowNameModal(true);
    }
  }, []);

  /**
   * Persists the device name to `localStorage` and hides the name modal.
   * If `name` is empty or whitespace-only, keeps the current random fallback.
   *
   * @param name - The display name chosen by the user. Pass an empty string to keep the random name.
   */
  const saveName = (name: string) => {
    const trimmed = name.trim() || deviceName; // keep the random fallback if empty
    localStorage.setItem(STORAGE_KEY, trimmed);
    setDeviceName(trimmed);
    setShowNameModal(false);
  };

  return { deviceName, showNameModal, saveName };
}
