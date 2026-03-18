import { useState, useEffect, useRef } from 'react';

interface NameModalProps {
  isOpen: boolean;
  defaultName: string;
  onSave: (name: string) => void;
}

/**
 * First-launch modal that asks the user for a device display name.
 * Pre-filled with a randomly generated name — user can accept it or type their own.
 */
export function NameModal({ isOpen, defaultName, onSave }: NameModalProps) {
  const [value, setValue] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset input whenever the modal opens with a new default
  useEffect(() => {
    if (isOpen) {
      setValue(defaultName);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(value);
  };

  return (
    <div className="modal-overlay">
      <div className="modal name-modal">
        <div className="modal__header">
          <h3 className="modal__title">¿Cómo se llama este dispositivo?</h3>
        </div>
        <div className="modal__body">
          <p className="modal__message">
            Este nombre se muestra a otros dispositivos cuando usás el envío directo.
          </p>
          <form id="name-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              className="name-modal__input"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nombre del dispositivo"
              maxLength={32}
              autoFocus
            />
          </form>
        </div>
        <div className="modal__footer">
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={() => onSave('')}
          >
            Omitir
          </button>
          <button className="btn btn--primary" type="submit" form="name-form">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
