import { useEffect, useRef } from 'react';
import { formatBytes } from '../../shared/utils/format';
import { formatSas } from '../../lib/e2e';
import type { PendingRequest } from './useTransfer';
import type { TransferClient } from './transfer.api';
import { Monitor, Smartphone, Globe, File as FileIcon, ShieldCheck } from 'lucide-react';

interface IncomingTransferModalProps {
  request: PendingRequest | null;
  /** Dispositivo que envía, si sigue en la lista de conectados (para el ícono). */
  sender?: TransferClient;
  /** Solicitudes en cola, incluida la visible. */
  pending?: number;
  onAccept: () => void;
  onReject: () => void;
}

/**
 * Solicitud de transferencia entrante.
 *
 * El receptor tiene que comparar el código de verificación con el que ve el
 * emisor: así se detecta un intermediario que haya cambiado las claves. Por
 * eso el código es lo principal del diálogo y aceptar es decir "coincide".
 * Hacer clic fuera del diálogo no rechaza, y el foco arranca en Rechazar para
 * que un Enter apurado no acepte.
 */
export function IncomingTransferModal({ request, sender, pending = 1, onAccept, onReject }: IncomingTransferModalProps) {
  const rejectRef = useRef<HTMLButtonElement>(null);
  useEffect(() => rejectRef.current?.focus(), [request?.transferId]);

  if (!request) return null;

  const SenderIcon =
    sender?.deviceType === 'mobile' ? Smartphone :
    sender && !sender.isServer ? Globe : Monitor;

  return (
    <div className="modal-overlay">
      <div
        className="modal transfer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-modal-title"
        aria-describedby="transfer-modal-sas-hint"
      >
        <div className="modal__header">
          <h3 className="modal__title" id="transfer-modal-title">Archivo entrante</h3>
        </div>
        <div className="modal__body">
          <div className="transfer-modal__sender">
            <SenderIcon size={18} aria-hidden="true" />
            <span>{request.fromName} quiere enviarte</span>
          </div>
          <div className="transfer-modal__file">
            <FileIcon size={32} strokeWidth={1.5} aria-hidden="true" />
            <div className="transfer-modal__file-info">
              <span className="transfer-modal__filename">{request.fileName}</span>
              <span className="transfer-modal__filesize">{formatBytes(request.fileSize)}</span>
            </div>
          </div>

          <div className="sas-panel" aria-live="polite">
            <span className="sas-panel__label">
              <ShieldCheck size={15} aria-hidden="true" />
              Código de verificación
            </span>
            <strong className="sas-panel__code">{formatSas(request.sas)}</strong>
            <p className="sas-panel__hint" id="transfer-modal-sas-hint">
              Comprobá que {request.fromName} ve este mismo código. Si no coincide, rechazá.
            </p>
          </div>

          {pending > 1 && (
            <p className="transfer-modal__message">Hay {pending - 1} más en espera.</p>
          )}
        </div>
        <div className="modal__footer">
          <button ref={rejectRef} className="btn btn--secondary" onClick={onReject}>
            Rechazar
          </button>
          <button className="btn btn--primary" onClick={onAccept}>
            Coincide, recibir
          </button>
        </div>
      </div>
    </div>
  );
}
