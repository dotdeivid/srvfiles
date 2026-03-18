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
 * Styled to match the dark theme.
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
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} id="confirm-modal">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3 className="modal__title">{title}</h3>
        </div>
        <div className="modal__body">
          <p className="modal__message">{message}</p>
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onCancel} id="confirm-cancel-btn">
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
