import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';
import type { AppConfig } from '../../features/files/files.api';
import { formatSas } from '../../lib/e2e';
import { Dialog } from './Dialog';
import { CopyButton } from './CopyButton';

interface ConnectDialogProps {
  open: boolean;
  onClose: () => void;
  config: AppConfig | null;
  /** PIN del servidor (solo lo conoce el propio equipo servidor). */
  pin: string | null;
}

/** URL HTTPS del servidor en la LAN, o null si todavía no se conoce la IP. */
export function lanHttpsUrl(config: AppConfig | null): string | null {
  return config?.lanIp && config.lanIp !== 'localhost' && config.httpsPort
    ? `https://${config.lanIp}:${config.httpsPort}`
    : null;
}

/**
 * Todo lo que hace falta para sumar un celular u otra computadora, en un solo
 * lugar: QR, dirección, PIN y el paso del certificado.
 *
 * El QR lleva la URL HTTPS (contexto seguro en el celular: cifrado del
 * WebSocket y portapapeles disponibles). Módulos oscuros sobre fondo blanco
 * con margen: muchos lectores no reconocen los QR invertidos.
 */
export function ConnectDialog({ open, onClose, config, pin }: ConnectDialogProps) {
  const url = lanHttpsUrl(config);

  return (
    <Dialog open={open} onClose={onClose} labelledBy="connect-dialog-title">
      <div className="modal connect-dialog">
        <div className="connect-dialog__header">
          <h3 className="modal__title" id="connect-dialog-title">Conectar un dispositivo</h3>
          <button className="btn-icon dialog__close" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {url ? (
          <ol className="connect-dialog__steps">
            <li>
              <span className="connect-dialog__step-text">Escaneá el código con la cámara del celular.</span>
              <div className="connect-dialog__qr">
                <QRCodeSVG
                  value={url}
                  size={168}
                  bgColor="#ffffff"
                  fgColor="#0a0a0f"
                  level="M"
                  marginSize={2}
                  title={`Código QR: ${url}`}
                />
              </div>
              <span className="connect-dialog__step-text">o abrí esta dirección en el navegador:</span>
              <div className="connect-dialog__url">
                <strong>{url}</strong>
                <CopyButton text={url} />
              </div>
            </li>
            <li>
              <span className="connect-dialog__step-text">
                La primera vez el navegador avisa que la conexión no es privada: tocá
                {' '}<em>Avanzado → Continuar a {config?.lanIp}</em>. El certificado es de
                este equipo y la red es la tuya.
              </span>
            </li>
            {pin && (
              <li>
                <span className="connect-dialog__step-text">Cuando lo pida, ingresá este PIN:</span>
                <strong className="connect-dialog__pin" aria-label={`PIN ${pin.split('').join(' ')}`}>
                  {formatSas(pin)}
                </strong>
              </li>
            )}
          </ol>
        ) : (
          <p className="modal__message">Buscando la dirección de este equipo en la red…</p>
        )}
      </div>
    </Dialog>
  );
}
