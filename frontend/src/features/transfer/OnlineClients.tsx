import { useRef } from 'react';
import type { TransferClient } from './transfer.api';
import type { ActiveTransfer } from './useTransfer';
import { formatBytes } from '../../shared/utils/format';
import { hostOf, serverUrlFor } from '../../shared/utils/serverUrl';
import { formatSas } from '../../lib/e2e';
import { FolderOpen, ArrowUp, ShieldCheck } from 'lucide-react';

interface OnlineClientsProps {
  clients: TransferClient[];
  myClientId: string | null;
  activeTransfer: ActiveTransfer | null;
  onSendFile: (toClientId: string, file: File, peerName: string) => void;
  onCancelTransfer: () => void;
  onViewServer?: (serverUrl: string) => void;
  currentServerUrl?: string;
  /** false si esta página no puede cifrar (abierta por HTTP). */
  e2eAvailable?: boolean;
}

/** Renders the list of other connected devices. */
export function OnlineClients({
  clients,
  myClientId,
  activeTransfer,
  onSendFile,
  onCancelTransfer,
  onViewServer,
  currentServerUrl,
  e2eAvailable = true,
}: OnlineClientsProps) {
  const others = clients.filter((c) => c.clientId !== myClientId);

  if (others.length === 0) {
    return (
      <p className="online-clients__empty">
        No hay otros dispositivos conectados al servidor.
      </p>
    );
  }

  const currentServerIp = currentServerUrl ? hostOf(currentServerUrl) : undefined;

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
          e2eAvailable={e2eAvailable}
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
  e2eAvailable: boolean;
}

function DirectClientRow({ client, activeTransfer, onSendFile, onCancel, onViewServer, isCurrentServer, e2eAvailable }: DirectClientRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isThisRow = activeTransfer?.peerId === client.clientId;
  const isOtherRow = !!activeTransfer && !isThisRow;
  // Cifrado de extremo a extremo obligatorio: ambos lados tienen que soportarlo.
  const sendBlockedReason = !e2eAvailable
    ? 'Abrí SrvFiles por HTTPS para enviar archivos'
    : !client.e2e
      ? `${client.appName} necesita actualizar SrvFiles`
      : isOtherRow ? 'Hay una transferencia en curso' : null;

  // Determine device icon: server (Tauri) → 🖥️, mobile → 📱, browser → 🌐
  const deviceIcon =
    client.deviceType === 'mobile' ? '📱' :
    client.isServer ? '🖥️' : '🌐';

  // El puerto lo anuncia el propio servidor al registrarse.
  const serverUrl = serverUrlFor(client.ip, client.serverPort);

  return (
    <div className={`direct-row ${isThisRow ? 'direct-row--active' : ''}`}>
      <span className="direct-row__dot" />

      <div className="direct-row__info">
        <span className="direct-row__name">
          <span className="direct-row__device-icon" aria-hidden="true">{deviceIcon}</span>
          {client.appName}
          {client.isServer && (
            <span className="direct-row__server-badge" title="Servidor SrvFiles">
              servidor
            </span>
          )}
        </span>
        <span className="direct-row__ip">{client.ip}</span>
      </div>

      {isThisRow && activeTransfer ? (
        <div className="direct-row__progress-area">
          {activeTransfer.waiting ? (
            <span className="direct-row__waiting">
              {activeTransfer.sas ? `Esperando que ${client.appName} confirme…` : 'Esperando respuesta…'}
            </span>
          ) : (
            <>
              <div className="direct-row__bar-wrap">
                <div className="direct-row__bar" style={{ width: `${activeTransfer.progress}%` }} />
              </div>
              <span className="direct-row__pct">{activeTransfer.progress}%</span>
              <span className="direct-row__size">{formatBytes(activeTransfer.fileSize)}</span>
            </>
          )}
          <button
            className="direct-row__cancel"
            onClick={onCancel}
            title="Cancelar transferencia"
            aria-label="Cancelar transferencia"
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
            disabled={sendBlockedReason !== null}
            title={sendBlockedReason ?? `Enviar a ${client.appName}`}
          >
            <ArrowUp size={14} strokeWidth={2.5} />
            Enviar
          </button>
        </div>
      )}

      {/* Mientras el receptor decide, el código va en grande: es lo que hay que comparar. */}
      {isThisRow && activeTransfer?.waiting && activeTransfer.sas && (
        <div className="sas-panel sas-panel--inline" aria-live="polite">
          <span className="sas-panel__label">
            <ShieldCheck size={15} aria-hidden="true" />
            Código de verificación
          </span>
          <strong className="sas-panel__code">{formatSas(activeTransfer.sas)}</strong>
          <p className="sas-panel__hint">
            {client.appName} tiene que ver este mismo código antes de aceptar.
          </p>
        </div>
      )}
    </div>
  );
}
