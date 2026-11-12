import { QRCodeSVG } from 'qrcode.react';
import type { AppConfig } from '../../features/files/files.api';

interface QRFooterProps {
  config: AppConfig | null;
}

/**
 * QR con la URL HTTPS del servidor en la LAN (contexto seguro en el celular:
 * cifrado del WebSocket y portapapeles disponibles).
 *
 * Módulos oscuros sobre fondo blanco con margen: muchos lectores no reconocen
 * los QR invertidos (claro sobre oscuro).
 */
export function QRFooter({ config }: QRFooterProps) {
  const httpsUrl = config?.lanIp && config.lanIp !== 'localhost' && config.httpsPort
    ? `https://${config.lanIp}:${config.httpsPort}`
    : null;

  return (
    <footer className="qr-footer" id="qr-footer">
      <div className="qr-footer__content">
        {httpsUrl && (
          <>
            <h3 className="qr-footer__title">Accedé desde tu celular</h3>
            <div className="qr-footer__code">
              <QRCodeSVG
                value={httpsUrl}
                size={148}
                bgColor="#ffffff"
                fgColor="#0a0a0f"
                level="M"
                marginSize={2}
                title={`Código QR: ${httpsUrl}`}
              />
            </div>
            <p className="qr-footer__hint">{httpsUrl}</p>
            <p className="qr-footer__hint">
              🔒 Primera vez: aceptá el certificado autofirmado en el navegador
              <br />
              <em>Avanzado → Continuar con {config?.lanIp} (no seguro)</em>
            </p>
          </>
        )}
        <p className="qr-footer__copyright">
          © 2026 Carlos David Sandoval ·{' '}
          <a href="https://github.com/dotdeivid" target="_blank" rel="noopener noreferrer">
            github.com/dotdeivid
          </a>
        </p>
      </div>
    </footer>
  );
}
