import { useState, useEffect, useRef, useCallback } from 'react';
import type { TransferClient } from '../transfer/transfer.api';
import type { DiscoveredServer } from './discovery.api';
import { isTauriApp } from '../../lib/tauri';
import { authenticate } from '../auth/auth.service';
import { PinDialog } from '../auth/PinDialog';
import { stripProtocol } from '../../shared/utils/format';
import { hostOf, isLocalOrigin, normalizeServerUrl, sameHost, serverUrlFor } from '../../shared/utils/serverUrl';
import { Dialog } from '../../shared/components/Dialog';
import { CopyButton } from '../../shared/components/CopyButton';
import { Server, Globe, ChevronRight, RefreshCw, X } from 'lucide-react';

interface ServerSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentServerUrl: string;
  copyUrl: string | null;                    // URL web (HTTPS) del servidor actual
  serverClients: TransferClient[];           // peers con isServer=true del relay
  localUrl: string | null;                   // backend de esta máquina
  localLanIp: string | null;                 // IP LAN de esta máquina (Tauri)
  onConnect: (url: string) => void;          // cambia servidor activo
  onRescan: () => Promise<DiscoveredServer[]>; // escanea la red
}

interface ServerOption {
  ip: string;
  url: string;
  appName: string;
  httpsPort?: number;
  isThisMachine?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────

export function ServerSwitcherModal({
  isOpen,
  onClose,
  currentServerUrl,
  copyUrl,
  serverClients,
  localUrl,
  localLanIp,
  onConnect,
  onRescan,
}: ServerSwitcherModalProps) {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<DiscoveredServer[]>([]);
  const [manualError, setManualError] = useState<string | null>(null);
  const ipInputRef = useRef<HTMLInputElement>(null);

  // Tauri: pedir el PIN antes de cambiar a un servidor remoto.
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rescan = useCallback(() => {
    setScanning(true);
    setScanned([]);
    onRescan().then((results) => {
      setScanned(results);
      setScanning(false);
    });
  }, [onRescan]);

  useEffect(() => {
    if (!isOpen) return;
    setManualError(null);
    setPendingUrl(null);
    setPinError(null);
    rescan();
  }, [isOpen, rescan]);

  if (!isOpen) return null;

  // Servidores del relay + escaneo, sin duplicar por IP ni mostrar el actual.
  const currentIp = hostOf(currentServerUrl);
  const relayServers: ServerOption[] = serverClients
    .filter((c) => c.isServer && c.ip !== currentIp)
    .map((c) => ({
      ip: c.ip,
      url: serverUrlFor(c.ip, c.serverPort),
      appName: c.appName,
      httpsPort: c.serverPort ? c.serverPort + 1 : undefined,
    }));
  const scannedFiltered: ServerOption[] = scanned.filter(
    (s) => s.ip !== currentIp && !relayServers.some((r) => r.ip === s.ip),
  );
  const otherServers: ServerOption[] = [...relayServers, ...scannedFiltered];

  // Tauri conectado a un servidor remoto: ofrecer volver al propio.
  if (isTauriApp() && localUrl && !sameHost(currentServerUrl, localUrl) && !(localLanIp && currentIp === localLanIp)) {
    otherServers.unshift({ ip: localLanIp ?? 'localhost', url: localUrl, appName: 'Este equipo', isThisMachine: true });
  }

  const backendDisplay = stripProtocol(currentServerUrl);
  const webDisplay = copyUrl ? stripProtocol(copyUrl) : backendDisplay;

  function handleConnect(option: { url: string; httpsPort?: number; isThisMachine?: boolean }) {
    if (stripProtocol(option.url) === stripProtocol(currentServerUrl)) return;

    if (!isTauriApp()) {
      // En el navegador se abre la web del otro servidor por HTTPS (contexto
      // seguro: cifrado y portapapeles disponibles). Sin puerto HTTPS, HTTP.
      const host = hostOf(option.url);
      const target = option.httpsPort ? `https://${host}:${option.httpsPort}` : option.url;
      window.open(target, '_blank', 'noopener');
      return;
    }

    if (option.isThisMachine || isLocalOrigin(option.url) || (localLanIp !== null && hostOf(option.url) === localLanIp)) {
      onConnect(option.url);
      onClose();
      return;
    }
    setPendingUrl(option.url);
    setPinError(null);
  }

  async function handleSubmitPin(pin: string) {
    if (!pendingUrl) return;
    setSubmitting(true);
    const result = await authenticate(pendingUrl, pin);
    setSubmitting(false);
    if (result.ok) {
      onConnect(pendingUrl);
      onClose();
    } else {
      setPinError(result.message);
    }
  }

  function handleManualConnect() {
    const url = normalizeServerUrl(ipInputRef.current?.value ?? '');
    if (!url) {
      setManualError('Dirección inválida. Ejemplo: 192.168.1.20:3001');
      return;
    }
    if (stripProtocol(url) === stripProtocol(currentServerUrl)) {
      setManualError('Ya estás conectado a este servidor');
      return;
    }
    handleConnect({ url });
  }

  if (pendingUrl) {
    return (
      <PinDialog
        isOpen
        serverUrl={pendingUrl}
        error={pinError}
        submitting={submitting}
        onSubmit={handleSubmitPin}
        onCancel={() => setPendingUrl(null)}
      />
    );
  }

  return (
    <Dialog open onClose={onClose} labelledBy="server-switcher-title">
      <div className="modal server-switcher">
        <div className="server-switcher__header">
          <h3 className="server-switcher__title" id="server-switcher-title">Servidores</h3>
          <button className="btn-icon dialog__close" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="server-switcher__section-label">Conectado</div>
        <div className="server-switcher__row server-switcher__row--current">
          <div className="server-switcher__row-info" style={{ flex: 1, gap: '6px' }}>
            <div className="server-switcher__url-row">
              <Server size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
              <span className="server-switcher__url-label">Servidor</span>
              <span className="server-switcher__url-value">{backendDisplay}</span>
              <CopyButton text={backendDisplay} />
            </div>
            <div className="server-switcher__url-row">
              <Globe size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
              <span className="server-switcher__url-label">Web</span>
              <span className="server-switcher__url-value">{webDisplay}</span>
              <CopyButton text={copyUrl ?? webDisplay} />
            </div>
          </div>
        </div>

        <div className="server-switcher__divider" />

        <div className="server-switcher__section-label">
          {scanning ? (
            <span className="server-switcher__scanning">
              <span className="server-switcher__spinner" />
              Buscando servidores...
            </span>
          ) : (
            'Otros servidores'
          )}
        </div>

        {!scanning && otherServers.length === 0 && (
          <p className="server-switcher__empty">No se encontraron otros servidores en la red.</p>
        )}

        {otherServers.map((s) => (
          <button
            key={s.url}
            className="server-switcher__row server-switcher__row--clickable"
            onClick={() => handleConnect(s)}
          >
            <span className="server-switcher__row-icon" aria-hidden="true">{s.isThisMachine ? '💻' : '🖥️'}</span>
            <div className="server-switcher__row-info">
              <span className="server-switcher__row-name">{s.appName}</span>
              <span className="server-switcher__row-ip">{s.ip}</span>
            </div>
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        ))}

        <div className="server-switcher__divider" />

        <div className="server-switcher__manual">
          <input
            ref={ipInputRef}
            className="server-switcher__input"
            type="text"
            placeholder="192.168.1.x:3001"
            aria-label="Dirección del servidor"
            onKeyDown={(e) => e.key === 'Enter' && handleManualConnect()}
            onChange={() => manualError && setManualError(null)}
          />
          <button className="btn btn--primary btn--sm" onClick={handleManualConnect}>
            Conectar
          </button>
        </div>
        {manualError && <p className="server-switcher__same-server" role="alert">{manualError}</p>}

        <button className="server-switcher__rescan" onClick={rescan} disabled={scanning}>
          <RefreshCw size={13} strokeWidth={2.5} />
          Volver a escanear
        </button>
      </div>
    </Dialog>
  );
}
