import { QRCodeSVG } from 'qrcode.react';
import type { AppConfig } from '../api/files.api';

interface QRFooterProps {
  config: AppConfig | null;
}

/**
 * Footer component displaying a QR code pointing to the LAN URL.
 * Uses the backend's reported LAN IP so the QR works from any device.
 */
export function QRFooter({ config }: QRFooterProps) {
  // Build the LAN URL for the frontend using the server's private IP.
  // In production builds (Tauri or npm start), the frontend is served by Express
  // on the backend port (3001), so other devices should use that port.
  // In dev mode, the Vite dev server runs on a separate port (5173).
  const getLanUrl = (): string => {
    if (config?.lanIp) {
      const port = import.meta.env.PROD ? config.port : (config.frontendPort || 5173);
      return `http://${config.lanIp}:${port}`;
    }
    // Fallback: use current origin (works when already on the IP)
    return window.location.origin;
  };

  const lanUrl = getLanUrl();

  return (
    <footer className="qr-footer" id="qr-footer">
      <div className="qr-footer__content">
        <h3 className="qr-footer__title">Accedé desde tu celular</h3>
        <p className="qr-footer__subtitle">Escaneá el código QR para abrir la app</p>
        <div className="qr-footer__code">
          <QRCodeSVG
            value={lanUrl}
            size={140}
            bgColor="transparent"
            fgColor="#c4b5fd"
            level="M"
            includeMargin={false}
          />
        </div>
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
