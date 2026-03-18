import { useState, useEffect } from 'react';

const STORAGE_KEY = 'srvfiles-device-name';

const ADJECTIVES = ['Rápido', 'Azul', 'Verde', 'Veloz', 'Brillante', 'Tranquilo', 'Creativo', 'Curioso'];
const ANIMALS    = ['Zorro', 'Puma', 'Delfín', 'Águila', 'Jaguar', 'Lobo', 'Oso', 'Cóndor'];

function randomName(): string {
  const adj    = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

/**
 * Manages the device display name used to identify this client in the transfer list.
 *
 * - Reads from localStorage on mount.
 * - If no name is saved, generates a random one and shows the name modal.
 * - `saveName(name)` persists the name and hides the modal.
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

  const saveName = (name: string) => {
    const trimmed = name.trim() || deviceName; // keep the random fallback if empty
    localStorage.setItem(STORAGE_KEY, trimmed);
    setDeviceName(trimmed);
    setShowNameModal(false);
  };

  return { deviceName, showNameModal, saveName };
}
