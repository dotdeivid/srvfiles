import { useEffect, useId, useRef } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
}

/**
 * In-app confirmation modal — replaces window.confirm().
 * Styled to match the dark theme. Focus starts on Cancelar (so a stray Enter
 * doesn't confirm a destructive action), Esc cancels, and focus goes back to
 * whatever opened the modal when it closes.
 */
export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Eliminar',
  confirmVariant = 'danger',
}: ConfirmModalProps) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // onCancel suele ser una función inline: guardarla en un ref evita que el
  // efecto se reinicie (y mueva el foco) en cada render del padre.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} id="confirm-modal">
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h3 className="modal__title" id={titleId}>{title}</h3>
        </div>
        <div className="modal__body">
          <p className="modal__message" id={messageId}>{message}</p>
        </div>
        <div className="modal__footer">
          <button ref={cancelRef} className="btn btn--secondary" onClick={onCancel} id="confirm-cancel-btn">
            Cancelar
          </button>
          <button
            className={`btn btn--${confirmVariant}`}
            onClick={onConfirm}
            id="confirm-action-btn"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
