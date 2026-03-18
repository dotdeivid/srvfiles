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
}

/** Renders the list of other connected devices inside any container (e.g. a modal). */
export function OnlineClients({
  clients,
  myClientId,
  activeTransfer,
  onSendFile,
  onCancelTransfer,
}: OnlineClientsProps) {
  const others = clients.filter((c) => c.clientId !== myClientId);

  if (others.length === 0) {
    return (
      <p className="online-clients__empty">
        No hay otros dispositivos conectados al servidor.
      </p>
    );
  }

  return (
    <div className="online-clients__list">
      {others.map((client) => (
        <DirectClientRow
          key={client.clientId}
          client={client}
          activeTransfer={activeTransfer}
          onSendFile={onSendFile}
          onCancel={onCancelTransfer}
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
}

function DirectClientRow({ client, activeTransfer, onSendFile, onCancel }: DirectClientRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isThisRow = activeTransfer?.peerId === client.clientId;
  const isOtherRow = !!activeTransfer && !isThisRow;

  return (
    <div className={`direct-row ${isThisRow ? 'direct-row--active' : ''}`}>
      <span className="direct-row__dot" />

      <div className="direct-row__info">
        <span className="direct-row__name">{client.appName}</span>
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
        <>
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
        </>
      )}
    </div>
  );
}
