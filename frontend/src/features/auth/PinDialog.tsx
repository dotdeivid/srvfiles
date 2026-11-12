import { useState, useRef, useEffect } from 'react';
import { stripProtocol } from '../../shared/utils/format';

interface PinDialogProps {
  isOpen: boolean;
  serverUrl: string;
  error?: string | null;
  submitting?: boolean;
  onSubmit: (pin: string) => void;
  /** Si se pasa, muestra "Cancelar" (volver al servidor anterior). */
  onCancel?: () => void;
}

/**
 * Modal que pide el PIN de 6 dígitos de un servidor. Se usa al abrir un
 * servidor protegido y al cambiar de servidor desde el selector.
 */
export function PinDialog({ isOpen, serverUrl, error, submitting = false, onSubmit, onCancel }: PinDialogProps) {
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPin('');
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen, serverUrl]);

  useEffect(() => {
    if (!isOpen || !onCancel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const host = stripProtocol(serverUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 6 && !submitting) onSubmit(pin);
  };

  return (
    <div className="modal-overlay">
      <div className="pin-modal" role="dialog" aria-modal="true" aria-labelledby="pin-modal-title">
        {onCancel && (
          <button className="pin-modal__close" onClick={onCancel} aria-label="Cancelar">✕</button>
        )}
        <h3 className="pin-modal__title" id="pin-modal-title">Conectarse a servidor</h3>
        <p className="pin-modal__subtitle">
          Ingresá el PIN del servidor <span className="pin-modal__host">{host}</span> para conectarte
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
            aria-label="PIN de 6 dígitos"
            aria-invalid={!!error}
          />
          <button
            type="submit"
            className="btn btn--primary btn--sm"
            disabled={pin.length !== 6 || submitting}
          >
            {submitting ? 'Conectando…' : 'Conectar'}
          </button>
        </form>
        {error && <p className="pin-modal__error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
