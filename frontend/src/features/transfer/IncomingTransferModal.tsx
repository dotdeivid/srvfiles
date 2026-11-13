import { useEffect, useRef, useState } from 'react';
import { formatBytes } from '../../shared/utils/format';
import { formatSas } from '../../lib/e2e';
import { REQUEST_TIMEOUT_MS, type PendingRequest } from './useTransfer';
import type { TransferClient } from './transfer.api';
import { Dialog } from '../../shared/components/Dialog';
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
 * Ni Esc ni el clic fuera rechazan, y el foco arranca en Rechazar para que
 * un Enter apurado no acepte.
 */
export function IncomingTransferModal({ request, sender, pending = 1, onAccept, onReject }: IncomingTransferModalProps) {
  const rejectRef = useRef<HTMLButtonElement>(null);
  useEffect(() => rejectRef.current?.focus(), [request?.transferId]);

  if (!request) return null;

  const SenderIcon =
    sender?.deviceType === 'mobile' ? Smartphone :
    sender && !sender.isServer ? Globe : Monitor;

  // Sin onClose: ni Esc ni el clic fuera rechazan; hay que elegir un botón.
  return (
    <Dialog
      open
      labelledBy="transfer-modal-title"
      describedBy="transfer-modal-sas-hint"
      initialFocusRef={rejectRef}
    >
      <div className="modal transfer-modal">
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

          <RequestCountdown key={request.transferId} expiresAt={request.expiresAt} />

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
    </Dialog>
  );
}

/**
 * Tiempo que queda antes de que la solicitud se rechace sola (useTransfer).
 * Se actualiza cada segundo; role="timer" no se anuncia en cada tick.
 */
function RequestCountdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, expiresAt - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = Math.min(1, remainingMs / REQUEST_TIMEOUT_MS);

  return (
    <div className={`request-countdown ${seconds <= 10 ? 'request-countdown--ending' : ''}`}>
      <div className="request-countdown__track" aria-hidden="true">
        <div className="request-countdown__fill" style={{ transform: `scaleX(${fraction})` }} />
      </div>
      <span className="request-countdown__text" role="timer">
        Se rechaza sola en {seconds} s
      </span>
    </div>
  );
}
