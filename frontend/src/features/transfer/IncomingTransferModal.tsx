import { useEffect, useState } from 'react';
import { formatBytes } from '../../shared/utils/format';
import { formatSas } from '../../lib/e2e';
import type { PendingRequest } from './useTransfer';
import { Monitor, File as FileIcon, ShieldCheck } from 'lucide-react';

interface IncomingTransferModalProps {
  request: PendingRequest | null;
  /** Solicitudes en cola, incluida la visible. */
  pending?: number;
  onAccept: () => void;
  onReject: () => void;
}

/**
 * Solicitud de transferencia entrante.
 *
 * El receptor tiene que confirmar que el código de verificación coincide con
 * el que ve el emisor: así se detecta un intermediario que haya cambiado las
 * claves. Hacer clic fuera del diálogo no rechaza.
 */
export function IncomingTransferModal({ request, pending = 1, onAccept, onReject }: IncomingTransferModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => setConfirmed(false), [request?.transferId]);

  if (!request) return null;

  return (
    <div className="modal-overlay">
      <div className="modal transfer-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-modal-title">
        <div className="modal__header">
          <h3 className="modal__title" id="transfer-modal-title">Archivo entrante</h3>
        </div>
        <div className="modal__body">
          <div className="transfer-modal__sender">
            <Monitor size={18} />
            <span>{request.fromName}</span>
          </div>
          <div className="transfer-modal__file">
            <FileIcon size={32} strokeWidth={1.5} />
            <div className="transfer-modal__file-info">
              <span className="transfer-modal__filename">{request.fileName}</span>
              <span className="transfer-modal__filesize">{formatBytes(request.fileSize)}</span>
            </div>
          </div>

          <div className="transfer-modal__sas" aria-live="polite">
            <ShieldCheck size={18} />
            <span>Código de verificación</span>
            <strong className="transfer-modal__sas-code">{formatSas(request.sas)}</strong>
          </div>
          <label className="transfer-modal__sas-confirm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            {' '}El código coincide con el que se ve en {request.fromName}
          </label>

          <p className="transfer-modal__message">
            ¿Querés recibir este archivo?
            {pending > 1 && ` (hay ${pending - 1} más en espera)`}
          </p>
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onReject}>
            Rechazar
          </button>
          <button
            className="btn btn--primary"
            onClick={onAccept}
            disabled={!confirmed}
            title={confirmed ? undefined : 'Confirmá que el código coincide'}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
