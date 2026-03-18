import { formatBytes } from '../utils/format';
import type { IncomingTransferRequest } from '../api/transfer.api';

interface IncomingTransferModalProps {
  request: IncomingTransferRequest | null;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingTransferModal({ request, onAccept, onReject }: IncomingTransferModalProps) {
  if (!request) return null;

  return (
    <div className="modal-overlay" onClick={onReject}>
      <div className="modal transfer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3 className="modal__title">Archivo entrante</h3>
        </div>
        <div className="modal__body">
          <div className="transfer-modal__sender">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>{request.fromName}</span>
          </div>
          <div className="transfer-modal__file">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            <div className="transfer-modal__file-info">
              <span className="transfer-modal__filename">{request.fileName}</span>
              <span className="transfer-modal__filesize">{formatBytes(request.fileSize)}</span>
            </div>
          </div>
          <p className="transfer-modal__message">
            ¿Querés recibir este archivo?
          </p>
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onReject}>
            Rechazar
          </button>
          <button className="btn btn--primary" onClick={onAccept}>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
