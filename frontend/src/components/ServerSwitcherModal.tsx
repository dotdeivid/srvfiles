import { useState, useEffect, useRef } from 'react';
import type { TransferClient } from '../api/transfer.api';
import type { DiscoveredServer } from '../api/discovery.api';
import { isTauriApp } from '../hooks/useDownloadDir';

interface ServerSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentServerUrl: string;
  copyUrl: string | null;                    // URL a copiar (web frontend URL)
  serverClients: TransferClient[];           // peers con isServer=true del relay
  onConnect: (url: string) => void;          // cambia servidor activo
  onRescan: () => Promise<DiscoveredServer[]>; // escanea la red
}

export function ServerSwitcherModal({
  isOpen,
  onClose,
  currentServerUrl,
  copyUrl,
  serverClients,
  onConnect,
  onRescan,
}: ServerSwitcherModalProps) {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<DiscoveredServer[]>([]);
  const [copied, setCopied] = useState(false);
  const ipInputRef = useRef<HTMLInputElement>(null);

  function handleCopy() {
    const url = copyUrl ?? currentServerUrl;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Escanear al abrir
  useEffect(() => {
    if (!isOpen) return;
    setScanned([]);
    setScanning(true);
    onRescan().then((results) => {
      setScanned(results);
      setScanning(false);
    });
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  // Merge peers del relay + scan, sin duplicar por IP ni mostrar el servidor actual
  const currentIp = currentServerUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
  const relayServers = serverClients
    .filter((c) => c.isServer && c.ip !== currentIp)
    .map((c) => ({ ip: c.ip, url: `http://${c.ip}:3001`, appName: c.appName }));

  const scannedFiltered = scanned.filter(
    (s) => s.ip !== currentIp && !relayServers.some((r) => r.ip === s.ip)
  );

  const otherServers: DiscoveredServer[] = [...relayServers, ...scannedFiltered];

  function handleConnect(url: string) {
    if (isTauriApp()) {
      onConnect(url);
      onClose();
    } else {
      window.open(url, '_blank');
    }
  }

  function handleManualConnect() {
    const raw = ipInputRef.current?.value.trim() ?? '';
    if (!raw) return;
    let url = raw;
    if (!url.startsWith('http')) url = `http://${url}`;
    if (!/:\d+$/.test(url)) url = `${url}:3001`;
    handleConnect(url);
  }

  function handleRescan() {
    setScanning(true);
    setScanned([]);
    onRescan().then((results) => {
      setScanned(results);
      setScanning(false);
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal server-switcher" onClick={(e) => e.stopPropagation()}>
        <div className="server-switcher__header">
          <h3 className="server-switcher__title">Servidores</h3>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Servidor actual */}
        <div className="server-switcher__section-label">Conectado</div>
        <div className="server-switcher__row server-switcher__row--current">
          <span className="server-switcher__row-icon">🖥️</span>
          <div className="server-switcher__row-info">
            <span className="server-switcher__row-name">
              {currentServerUrl.replace(/^https?:\/\//, '')}
            </span>
          </div>
          <button
            className="server-switcher__copy-btn"
            onClick={handleCopy}
            title="Copiar URL"
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>

        <div className="server-switcher__divider" />

        {/* Otros servidores */}
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
            onClick={() => handleConnect(s.url)}
          >
            <span className="server-switcher__row-icon">🖥️</span>
            <div className="server-switcher__row-info">
              <span className="server-switcher__row-name">{s.appName}</span>
              <span className="server-switcher__row-ip">{s.ip}</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}

        <div className="server-switcher__divider" />

        {/* IP manual */}
        <div className="server-switcher__manual">
          <input
            ref={ipInputRef}
            className="server-switcher__input"
            type="text"
            placeholder="192.168.1.x:3001"
            onKeyDown={(e) => e.key === 'Enter' && handleManualConnect()}
          />
          <button className="btn btn--primary btn--sm" onClick={handleManualConnect}>
            Conectar
          </button>
        </div>

        <button className="server-switcher__rescan" onClick={handleRescan} disabled={scanning}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Volver a escanear
        </button>
      </div>
    </div>
  );
}
