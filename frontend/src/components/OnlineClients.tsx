import { useRef } from 'react';
import type { TransferClient } from '../api/transfer.api';
import type { ActiveTransfer } from '../hooks/useTransfer';
import { formatBytes } from '../utils/format';

interface OnlineClientsProps {
  clients: TransferClient[];
  myClientId: string | null;
  activeTransfer: ActiveTransfer | null;
  onSendFile: (toClientId: string, file: File, peerName: string) => void;
  onCancelTransfer: () => void;
  onViewServer?: (serverUrl: string) => void;
  currentServerUrl?: string;
}

/** Renders the list of other connected devices inside any container (e.g. a modal). */
export function OnlineClients({
  clients,
  myClientId,
  activeTransfer,
  onSendFile,
  onCancelTransfer,
  onViewServer,
  currentServerUrl,
}: OnlineClientsProps) {
  const others = clients.filter((c) => c.clientId !== myClientId);

  if (others.length === 0) {
    return (
      <p className="online-clients__empty">
        No hay otros dispositivos conectados al servidor.
      </p>
    );
  }

  // Extract current server IP for comparison
  const currentServerIp = currentServerUrl?.replace(/^https?:\/\//, '').replace(/:\d+$/, '');

  return (
    <div className="online-clients__list">
      {others.map((client) => (
        <DirectClientRow
          key={client.clientId}
          client={client}
          activeTransfer={activeTransfer}
          onSendFile={onSendFile}
          onCancel={onCancelTransfer}
          onViewServer={onViewServer}
          isCurrentServer={client.isServer && client.ip === currentServerIp}
        />
      ))}
    </div>
  );
}

// ─── Single device row ────────────────────────────────────────────────

interface DirectClientRowProps {
  client: TransferClient;
  activeTransfer: ActiveTransfer | null;
  onSendFile: (toClientId: string, file: File, peerName: string) => void;
  onCancel: () => void;
  onViewServer?: (serverUrl: string) => void;
  isCurrentServer?: boolean;
}

function DirectClientRow({ client, activeTransfer, onSendFile, onCancel, onViewServer, isCurrentServer }: DirectClientRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isThisRow = activeTransfer?.peerId === client.clientId;
  const isOtherRow = !!activeTransfer && !isThisRow;

  // Determine device icon: server (Tauri) → 🖥️, mobile → 📱, browser → 🌐
  const deviceIcon =
    client.deviceType === 'mobile' ? '📱' :
    client.isServer ? '🖥️' : '🌐';

  const serverUrl = `http://${client.ip}:3001`;

  return (
    <div className={`direct-row ${isThisRow ? 'direct-row--active' : ''}`}>
      <span className="direct-row__dot" />

      <div className="direct-row__info">
        <span className="direct-row__name">
          <span className="direct-row__device-icon">{deviceIcon}</span>
          {client.appName}
          {client.isServer && (
            <span className="direct-row__server-badge" title="Servidor SrvFiles (Tauri)">
              servidor
            </span>
          )}
        </span>
        <span className="direct-row__ip">{client.ip}</span>
      </div>

      {isThisRow && activeTransfer ? (
        <div className="direct-row__progress-area">
          {activeTransfer.waiting ? (
            <span className="direct-row__waiting">Esperando respuesta...</span>
          ) : (
            <>
              <div className="direct-row__bar-wrap">
                <div
                  className="direct-row__bar"
                  style={{ width: `${activeTransfer.progress}%` }}
                />
              </div>
              <span className="direct-row__pct">{activeTransfer.progress}%</span>
              <span className="direct-row__size">{formatBytes(activeTransfer.fileSize)}</span>
            </>
          )}
          <button
            className="direct-row__cancel"
            onClick={onCancel}
            title="Cancelar transferencia"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="direct-row__actions">
          {client.isServer && onViewServer && !isCurrentServer && (
            <button
              className="btn btn--ghost btn--sm direct-row__view"
              onClick={() => onViewServer(serverUrl)}
              disabled={isOtherRow}
              title={`Ver archivos de ${client.appName}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Ver
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSendFile(client.clientId, file, client.appName);
              e.target.value = '';
            }}
          />
          <button
            className="btn btn--primary btn--sm direct-row__send"
            onClick={() => inputRef.current?.click()}
            disabled={isOtherRow}
            title={isOtherRow ? 'Hay una transferencia en curso' : `Enviar a ${client.appName}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
            Enviar
          </button>
        </div>
      )}
    </div>
  );
}
