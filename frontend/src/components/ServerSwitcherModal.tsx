import { useState, useEffect, useRef } from 'react';
import type { TransferClient } from '../api/transfer.api';
import type { DiscoveredServer } from '../api/discovery.api';
import { isTauriApp } from '../hooks/useDownloadDir';
import { authenticate } from '../lib/auth';

interface ServerSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentServerUrl: string;
  copyUrl: string | null;                    // URL web frontend
  serverClients: TransferClient[];           // peers con isServer=true del relay
  localLanIp: string | null;                 // IP LAN del equipo local (Tauri)
  onConnect: (url: string) => void;          // cambia servidor activo
  onRescan: () => Promise<DiscoveredServer[]>; // escanea la red
}

// ─── Inline copy button ──────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button className="server-switcher__copy-btn" onClick={handleCopy} title="Copiar">
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
  );
}

// ─── Constants ───────────────────────────────────────────────────────

const LOCALHOST_URL = 'http://localhost:3001';

// ─── Component ───────────────────────────────────────────────────────

export function ServerSwitcherModal({
  isOpen,
  onClose,
  currentServerUrl,
  copyUrl,
  serverClients,
  localLanIp,
  onConnect,
  onRescan,
}: ServerSwitcherModalProps) {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<DiscoveredServer[]>([]);
  const [sameServerMsg, setSameServerMsg] = useState(false);
  const ipInputRef = useRef<HTMLInputElement>(null);

  // ─── Pre-auth state (Tauri: ask PIN before switching) ────────────
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [connectPin, setConnectPin] = useState('');
  const [connectPinError, setConnectPinError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Escanear al abrir
  useEffect(() => {
    if (!isOpen) return;
    setScanned([]);
    setScanning(true);
    setSameServerMsg(false);
    setPendingUrl(null);
    setConnectPin('');
    setConnectPinError(null);
    onRescan().then((results) => {
      setScanned(results);
      setScanning(false);
    });
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus PIN input
  useEffect(() => {
    if (pendingUrl) setTimeout(() => pinInputRef.current?.focus(), 50);
  }, [pendingUrl]);

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

  // Tauri: si estamos conectados a un servidor remoto, agregar el servidor local
  // como opción para poder volver (el scan del backend lo excluye a sí mismo)
  const isOnOwnServer = localLanIp && currentServerUrl.includes(localLanIp);
  if (isTauriApp() && localLanIp && !isOnOwnServer) {
    const alreadyListed = otherServers.some((s) => s.ip === localLanIp);
    if (!alreadyListed) {
      otherServers.unshift({
        ip: localLanIp,
        url: `http://${localLanIp}:3001`,
        appName: 'Este equipo',
      });
    }
  }

  // IPs para la sección "Conectado"
  const backendDisplay = currentServerUrl.replace(/^https?:\/\//, '');
  const webDisplay = copyUrl ? copyUrl.replace(/^https?:\/\//, '') : backendDisplay;

  function handleConnect(url: string) {
    const inputIp = url.replace(/^https?:\/\//, '');
    const currentIpPort = currentServerUrl.replace(/^https?:\/\//, '');
    if (inputIp === currentIpPort) return;

    if (!isTauriApp()) {
      window.open(url, '_blank');
      return;
    }

    // Tauri conectando a servidor propio o localhost: no necesita PIN (auto-auth)
    const isLocal = url === LOCALHOST_URL || url.includes('localhost') || url.includes('127.0.0.1')
      || (localLanIp !== null && url.includes(localLanIp));
    if (isLocal) {
      onConnect(url);
      onClose();
      return;
    }

    // Tauri → servidor remoto: pedir PIN antes de cambiar contexto
    setPendingUrl(url);
    setConnectPin('');
    setConnectPinError(null);
  }

  async function handleConnectWithPin() {
    if (!pendingUrl || !connectPin.trim()) return;
    setConnecting(true);
    setConnectPinError(null);

    const ok = await authenticate(pendingUrl, connectPin.trim());
    setConnecting(false);

    if (ok) {
      onConnect(pendingUrl);
      onClose();
    } else {
      setConnectPinError('PIN incorrecto. Intentá de nuevo.');
    }
  }

  function handleCancelPending() {
    setPendingUrl(null);
    setConnectPin('');
    setConnectPinError(null);
  }

  function handleManualConnect() {
    const raw = ipInputRef.current?.value.trim() ?? '';
    if (!raw) return;
    let url = raw;
    if (!url.startsWith('http')) url = `http://${url}`;
    if (!/:\d+$/.test(url)) url = `${url}:3001`;
    const inputIp = url.replace(/^https?:\/\//, '');
    const currentIpPort = currentServerUrl.replace(/^https?:\/\//, '');
    if (inputIp === currentIpPort) {
      setSameServerMsg(true);
      return;
    }
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

  // ─── PIN prompt ────────────────────────────────────────────────
  if (pendingUrl) {
    const pendingDisplay = pendingUrl.replace(/^https?:\/\//, '');
    return (
      <div className="modal-overlay" onClick={handleCancelPending}>
        <div className="pin-modal" onClick={(e) => e.stopPropagation()}>
          <button className="pin-modal__close" onClick={handleCancelPending} aria-label="Cerrar">✕</button>
          <h3 className="pin-modal__title">Conectarse a servidor</h3>
          <p className="pin-modal__subtitle">
            Ingrese el pin del servidor <span className="pin-modal__host">{pendingDisplay}</span> para conectarse
          </p>
          <form className="pin-modal__row" onSubmit={(e) => { e.preventDefault(); handleConnectWithPin(); }}>
            <input
              ref={pinInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              className="pin-modal__input"
              autoComplete="off"
              value={connectPin}
              onChange={(e) => {
                setConnectPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                if (connectPinError) setConnectPinError(null);
              }}
            />
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={connecting || connectPin.length !== 6}
            >
              {connecting ? 'Conectando...' : 'Conectar'}
            </button>
          </form>
          {connectPinError && <p className="pin-modal__error">{connectPinError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal server-switcher" onClick={(e) => e.stopPropagation()}>
        <div className="server-switcher__header">
          <h3 className="server-switcher__title">Servidores</h3>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Servidor actual — muestra ambas URLs siempre */}
        <div className="server-switcher__section-label">Conectado</div>
        <div className="server-switcher__row server-switcher__row--current">
          <div className="server-switcher__row-info" style={{ flex: 1, gap: '6px' }}>
            {/* Servidor (backend) */}
            <div className="server-switcher__url-row">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, flexShrink: 0 }}>
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              <span className="server-switcher__url-label">Servidor</span>
              <span className="server-switcher__url-value">{backendDisplay}</span>
              <CopyBtn text={backendDisplay} />
            </div>
            {/* Web (frontend) */}
            <div className="server-switcher__url-row">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span className="server-switcher__url-label">Web</span>
              <span className="server-switcher__url-value">{webDisplay}</span>
              <CopyBtn text={webDisplay} />
            </div>
          </div>
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
            <span className="server-switcher__row-icon">{s.appName === 'Este equipo' ? '💻' : '🖥️'}</span>
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
            onChange={() => sameServerMsg && setSameServerMsg(false)}
          />
          <button className="btn btn--primary btn--sm" onClick={handleManualConnect}>
            Conectar
          </button>
        </div>
        {sameServerMsg && (
          <p className="server-switcher__same-server">Ya estás conectado a este servidor</p>
        )}

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
