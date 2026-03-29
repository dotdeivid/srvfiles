import { QRCodeSVG } from 'qrcode.react';
import type { AppConfig } from '../../features/files/files.api';

interface QRFooterProps {
  config: AppConfig | null;
}

/**
 * Footer component displaying a QR code pointing to the HTTPS LAN URL.
 * Uses httpsPort from config so browsers get a secure context (crypto.subtle available).
 */
export function QRFooter({ config }: QRFooterProps) {
  // Always point external devices to the HTTPS URL so:
  // - Traffic is encrypted in transit on public WiFi
  // - crypto.subtle is available → E2E WebSocket encryption activates
  const getHttpsUrl = (): string => {
    if (config?.lanIp && config?.httpsPort) {
      return `https://${config.lanIp}:${config.httpsPort}`;
    }
    return window.location.origin;
  };

  const httpsUrl = getHttpsUrl();

  return (
    <footer className="qr-footer" id="qr-footer">
      <div className="qr-footer__content">
        <h3 className="qr-footer__title">Accedé desde tu celular</h3>
        <div className="qr-footer__code">
          <QRCodeSVG
            value={httpsUrl}
            size={140}
            bgColor="transparent"
            fgColor="#c4b5fd"
            level="M"
            includeMargin={false}
          />
        </div>
        <p className="qr-footer__hint">
          🔒 Primera vez: aceptá el certificado autofirmado en el navegador
          <br />
          <em>Avanzado → Continuar con {config?.lanIp ?? '…'} (no seguro)</em>
        </p>
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
