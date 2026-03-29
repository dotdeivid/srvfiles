import { useRef } from 'react';
import type { TransferClient } from './transfer.api';
import type { ActiveTransfer } from './useTransfer';
import { formatBytes, extractIp } from '../../shared/utils/format';
import { FolderOpen, ArrowUp } from 'lucide-react';

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
  const currentServerIp = currentServerUrl ? extractIp(currentServerUrl) : undefined;

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
              <FolderOpen size={13} strokeWidth={2.5} />
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
            <ArrowUp size={14} strokeWidth={2.5} />
            Enviar
          </button>
        </div>
      )}
    </div>
  );
}
