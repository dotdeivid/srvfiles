import { useState, useRef, useEffect } from 'react';
import { stripProtocol } from '../utils/format';

interface PinDialogProps {
  isOpen: boolean;
  serverUrl: string;
  error?: string | null;
  onSubmit: (pin: string) => void;
}

/**
 * Modal that prompts the user to enter the 6-digit server PIN.
 * Shown automatically when the server responds with 401.
 */
export function PinDialog({ isOpen, serverUrl, error, onSubmit }: PinDialogProps) {
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPin('');
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  if (!isOpen) return null;

  const host = stripProtocol(serverUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 6) onSubmit(pin);
  };

  return (
    <div className="modal-overlay">
      <div className="pin-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="pin-modal__title">Conectarse a servidor</h3>
        <p className="pin-modal__subtitle">
          Ingrese el pin del servidor <span className="pin-modal__host">{host}</span> para conectarse
        </p>
        <form onSubmit={handleSubmit} className="pin-modal__row">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="pin-modal__input"
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn--primary btn--sm"
            disabled={pin.length !== 6}
          >
            Conectar
          </button>
        </form>
        {error && <p className="pin-modal__error">{error}</p>}
      </div>
    </div>
  );
}
