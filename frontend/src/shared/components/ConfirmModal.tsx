import { useId, useRef } from 'react';
import { Dialog } from './Dialog';

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
 * Focus starts on Cancelar (so a stray Enter doesn't confirm a destructive
 * action); Esc, clicking outside and focus return come from Dialog.
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

  return (
    <Dialog
      open={isOpen}
      onClose={onCancel}
      role="alertdialog"
      labelledBy={titleId}
      describedBy={messageId}
      initialFocusRef={cancelRef}
    >
      <div className="modal" id="confirm-modal">
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
    </Dialog>
  );
}
