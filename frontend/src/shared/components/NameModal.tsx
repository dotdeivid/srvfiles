import { useState, useEffect, useRef } from 'react';
import { Dialog } from './Dialog';

interface NameModalProps {
  isOpen: boolean;
  defaultName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

/**
 * Cambia el nombre con el que este dispositivo aparece para los demás.
 * Pre-filled with the current name, selected so it can be replaced by typing.
 */
export function NameModal({ isOpen, defaultName, onSave, onCancel }: NameModalProps) {
  const [value, setValue] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset input whenever the modal opens with a new default
  useEffect(() => {
    if (!isOpen) return;
    setValue(defaultName);
    const id = setTimeout(() => inputRef.current?.select(), 50);
    return () => clearTimeout(id);
  }, [isOpen, defaultName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(value);
  };

  return (
    <Dialog open={isOpen} onClose={onCancel} closeOnBackdrop={false} labelledBy="name-modal-title" initialFocusRef={inputRef}>
      <div className="modal name-modal">
        <div className="modal__header">
          <h3 className="modal__title" id="name-modal-title">Nombre de este dispositivo</h3>
        </div>
        <div className="modal__body">
          <form id="name-form" onSubmit={handleSubmit}>
            <label className="name-modal__label" htmlFor="name-modal-input">
              Así te ven los demás dispositivos cuando les enviás un archivo.
            </label>
            <input
              ref={inputRef}
              id="name-modal-input"
              className="name-modal__input"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nombre del dispositivo"
              maxLength={32}
            />
          </form>
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn--primary" type="submit" form="name-form">
            Guardar
          </button>
        </div>
      </div>
    </Dialog>
  );
}
