import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { stripProtocol } from '../../shared/utils/format';
import { Dialog } from '../../shared/components/Dialog';

interface PinDialogProps {
  isOpen: boolean;
  serverUrl: string;
  error?: string | null;
  submitting?: boolean;
  onSubmit: (pin: string) => void;
  /** Si se pasa, muestra "Cancelar" (volver al servidor anterior) y Esc cancela. */
  onCancel?: () => void;
}

/**
 * Modal que pide el PIN de 6 dígitos de un servidor. Se usa al abrir un
 * servidor protegido y al cambiar de servidor desde el selector.
 *
 * Se envía solo al completar los 6 dígitos (también al pegarlos o al
 * autocompletarlos con `one-time-code`). El clic fuera no cancela, para no
 * perder lo escrito.
 */
export function PinDialog({ isOpen, serverUrl, error, submitting = false, onSubmit, onCancel }: PinDialogProps) {
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) setPin('');
  }, [isOpen, serverUrl]);

  const host = stripProtocol(serverUrl);

  const handleChange = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, 6);
    setPin(next);
    if (next.length === 6 && next !== pin && !submitting) onSubmit(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 6 && !submitting) onSubmit(pin);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onCancel}
      closeOnBackdrop={false}
      labelledBy="pin-modal-title"
      describedBy="pin-modal-subtitle"
      initialFocusRef={inputRef}
    >
      <div className="pin-modal">
        {onCancel && (
          <button className="btn-icon dialog__close" onClick={onCancel} aria-label="Cancelar">
            <X size={18} strokeWidth={2.5} />
          </button>
        )}
        <h3 className="pin-modal__title" id="pin-modal-title">Conectarse al servidor</h3>
        <p className="pin-modal__subtitle" id="pin-modal-subtitle">
          Ingresá el PIN de 6 dígitos que muestra la pantalla del equipo servidor.
          <span className="pin-modal__host">{host}</span>
        </p>
        <form onSubmit={handleSubmit} className="pin-modal__row">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => handleChange(e.target.value)}
            className="pin-modal__input"
            autoComplete="one-time-code"
            aria-label="PIN de 6 dígitos"
            aria-invalid={!!error}
            aria-describedby={error ? 'pin-modal-error' : undefined}
          />
          <button
            type="submit"
            className="btn btn--primary btn--sm"
            disabled={pin.length !== 6 || submitting}
          >
            {submitting ? 'Conectando…' : 'Conectar'}
          </button>
        </form>
        {error && <p className="pin-modal__error" id="pin-modal-error" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}
