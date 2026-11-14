import { useState, useCallback, useEffect, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { useFiles } from './features/files/useFiles';
import { useMode } from './features/server/useMode';
import { useTransfer } from './features/transfer/useTransfer';
import { useDeviceName } from './shared/hooks/useDeviceName';
import { useAuth } from './features/auth/useAuth';
import { getToken } from './features/auth/auth.service';
import { isTauriApp, onBackendRestarted } from './lib/tauri';
import { checkForUpdates } from './lib/updater';
import { DropZone } from './features/files/DropZone';
import { FileList } from './features/files/FileList';
import { DiskStats } from './features/files/DiskStats';
import { AppFooter } from './shared/components/AppFooter';
import { ConnectDialog } from './shared/components/ConnectDialog';
import { ConfirmModal } from './shared/components/ConfirmModal';
import { OnlineClients } from './features/transfer/OnlineClients';
import { IncomingTransferModal } from './features/transfer/IncomingTransferModal';
import { NameModal } from './shared/components/NameModal';
import { ServerSwitcherModal } from './features/server/ServerSwitcherModal';
import { PinDialog } from './features/auth/PinDialog';
import { isLocalOrigin } from './shared/utils/serverUrl';
import { log } from './lib/logger';
import { Server, Lock, LockOpen, ChevronDown, User, WifiOff, QrCode, AlertTriangle, PowerOff } from 'lucide-react';
import type { DiscoveredServer } from './features/server/discovery.api';

// ─── Root: resolves the server + splash ───────────────────────────
function App() {
  const { serverUrl, localUrl, connecting, connect, goBack, canGoBack, rescan } = useMode();

  useEffect(() => { void checkForUpdates(); }, []);

  if (connecting || !serverUrl) {
    return <ConnectingScreen />;
  }

  return (
    <FileApp
      serverUrl={serverUrl}
      localUrl={localUrl}
      onConnect={connect}
      onGoBack={canGoBack ? goBack : undefined}
      onRescan={rescan}
    />
  );
}

function ConnectingScreen() {
  return (
    <div className="connecting-screen">
      <div className="connecting-screen__spinner" />
      <p className="connecting-screen__text">Conectando con el servidor...</p>
    </div>
  );
}

/**
 * El servidor avisó que se apagó (por ejemplo, el celular dejó de compartir).
 * Una pestaña abierta por el usuario no se puede cerrar desde la página, así
 * que se reemplaza todo por este aviso en lugar de dejar la lista vieja.
 */
function ServerStoppedScreen({ onGoBack }: { onGoBack?: () => boolean }) {
  return (
    <main className="connecting-screen server-stopped" role="alert">
      <PowerOff className="server-stopped__icon" size={36} aria-hidden="true" />
      <h1 className="server-stopped__title">El servidor se detuvo</h1>
      <p className="server-stopped__text">
        El dispositivo que compartía la carpeta dejó de hacerlo. Ya podés cerrar esta
        pestaña, o reintentar cuando vuelva a estar activo.
      </p>
      <div className="server-stopped__actions">
        {onGoBack && (
          <button className="btn btn--primary" onClick={() => { onGoBack(); }}>
            Volver al servidor anterior
          </button>
        )}
        <button
          className={`btn ${onGoBack ? 'btn--secondary' : 'btn--primary'}`}
          onClick={() => window.location.reload()}
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}

// ─── Main file UI ──────────────────────────────────────────────────
interface FileAppProps {
  serverUrl: string;
  localUrl: string | null;
  onConnect: (url: string) => void;
  onGoBack?: () => boolean;
  onRescan: () => Promise<DiscoveredServer[]>;
}

function FileApp({ serverUrl, localUrl, onConnect, onGoBack, onRescan }: FileAppProps) {
  const prevServerUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevServerUrlRef.current !== serverUrl) {
      void log.info('[App] connected to server', { from: prevServerUrlRef.current, to: serverUrl });
      prevServerUrlRef.current = serverUrl;
    }
  }, [serverUrl]);

  const { authenticated, pinDialogOpen, pinError, submitting, serverPin, submitPin } = useAuth(serverUrl);

  const {
    files, stats, config, loading, uploading, uploadProgress, error,
    refresh, upload, cancelUpload, remove, getLinkedUrl, getPlainDownloadUrl,
  } = useFiles(authenticated ? serverUrl : null);

  const appName = config?.appName || import.meta.env.VITE_APP_NAME || 'SrvFiles';

  // ─── Device name (identifies this client in transfers) ────────
  const { deviceName, showNameModal, saveName } = useDeviceName();

  // La app de escritorio reinició su servidor interno: recargar.
  useEffect(() => {
    if (!isTauriApp()) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void onBackendRestarted(() => {
      toast.info('El servidor interno se reinició');
      void refresh();
    }).then((stop) => { if (disposed) stop(); else unlisten = stop; });
    return () => { disposed = true; unlisten?.(); };
  }, [refresh]);

  // ─── Direct transfer ──────────────────────────────────────────
  const isOwnServer = isTauriApp() && localUrl !== null && serverUrl === localUrl;
  const {
    connected, serverStopped, encrypted, e2eAvailable, myClientId, onlineClients, incomingRequest, pendingRequests, activeTransfer,
    sendFileTo, acceptTransfer, rejectTransfer, cancelTransfer, rename,
  } = useTransfer({
    serverUrl,
    appName: deviceName,
    authenticated,
    isServer: isOwnServer,
    serverPort: isOwnServer ? config?.port : undefined,
    onFilesChanged: refresh,
    onReconnected: refresh,
  });

  // ─── Rename modal ─────────────────────────────────────────────
  const [renameOpen, setRenameOpen] = useState(false);
  const handleSaveName = useCallback((name: string) => {
    saveName(name);
    const trimmed = name.trim();
    if (trimmed) rename(trimmed);
    setRenameOpen(false);
  }, [saveName, rename]);

  const otherClients = onlineClients.filter((c) => c.clientId !== myClientId);

  // ─── Connect a device ─────────────────────────────────────────
  // Solo el propio equipo servidor conoce su PIN (se lee desde localhost):
  // es quien tiene que mostrar el QR. En el celular no tiene sentido.
  const isHost = serverPin !== null;
  const [connectOpen, setConnectOpen] = useState(false);

  // ─── Server switcher modal ────────────────────────────────────
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const serverClients = onlineClients.filter((c) => c.isServer && c.clientId !== myClientId);

  // ─── Confirm delete modal ─────────────────────────────────────
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);

  const handleConfirmDelete = useCallback(async () => {
    const names = pendingDelete;
    if (!names || names.length === 0) return;
    setPendingDelete(null);
    // Uno tras otro: el servidor avisa files-changed por cada uno igual.
    const failed: string[] = [];
    for (const name of names) {
      if (!(await remove(name))) failed.push(name);
    }
    if (failed.length === 0) {
      toast.success(names.length === 1 ? `"${names[0]}" eliminado` : `${names.length} archivos eliminados`);
    } else if (failed.length === 1) {
      toast.error(`No se pudo eliminar "${failed[0]}"`);
    } else {
      toast.error(`No se pudieron eliminar ${failed.length} de ${names.length} archivos`);
    }
  }, [pendingDelete, remove]);

  // ─── URLs ─────────────────────────────────────────────────────
  // HTTPS URL — shown to the user and used in the QR / copy action.
  const webUrl = config?.lanIp && config.httpsPort ? `https://${config.lanIp}:${config.httpsPort}` : null;
  // Backend URL with the real LAN IP (avoid showing "localhost").
  const backendLanUrl = config?.lanIp ? `http://${config.lanIp}:${config.port}` : serverUrl;

  // IP LAN propia — se conserva al pasar a un servidor remoto.
  const [localLanIp, setLocalLanIp] = useState<string | null>(null);
  useEffect(() => {
    if (isLocalOrigin(serverUrl) && config?.lanIp) setLocalLanIp(config.lanIp);
  }, [serverUrl, config?.lanIp]);

  if (serverStopped) return <ServerStoppedScreen onGoBack={onGoBack} />;

  return (
    <>
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        toastOptions={{
          style: {
            background: 'rgba(15, 15, 26, 0.9)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            backdropFilter: 'blur(12px)',
          },
        }}
      />

      <PinDialog
        isOpen={pinDialogOpen}
        serverUrl={backendLanUrl}
        error={pinError}
        submitting={submitting}
        onSubmit={submitPin}
        onCancel={onGoBack ? () => { onGoBack(); } : undefined}
      />

      <NameModal
        isOpen={showNameModal || renameOpen}
        defaultName={deviceName}
        onSave={handleSaveName}
        onCancel={() => handleSaveName('')}
      />

      <ConnectDialog
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        config={config}
        pin={serverPin}
      />

      <IncomingTransferModal
        request={incomingRequest}
        sender={onlineClients.find((c) => c.clientId === incomingRequest?.from)}
        pending={pendingRequests}
        onAccept={acceptTransfer}
        onReject={rejectTransfer}
      />

      <ServerSwitcherModal
        isOpen={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        currentServerUrl={backendLanUrl}
        copyUrl={webUrl}
        serverClients={serverClients}
        localUrl={localUrl}
        localLanIp={localLanIp}
        onConnect={onConnect}
        onRescan={onRescan}
      />

      <ConfirmModal
        isOpen={pendingDelete !== null}
        title={pendingDelete && pendingDelete.length > 1 ? `Eliminar ${pendingDelete.length} archivos` : 'Eliminar archivo'}
        message={
          pendingDelete && pendingDelete.length > 1
            ? `Los ${pendingDelete.length} archivos se eliminarán de la carpeta compartida para todos los dispositivos. No se puede deshacer.`
            : `"${pendingDelete?.[0]}" se eliminará de la carpeta compartida para todos los dispositivos. No se puede deshacer.`
        }
        confirmLabel={pendingDelete && pendingDelete.length > 1 ? `Eliminar ${pendingDelete.length}` : 'Eliminar'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <header className="header" id="app-header">
        <div className="header__left">
          <div className="header__text">
            <h1 className="header__title">{appName}</h1>
          </div>
        </div>

        <div className="header__center">
          <button
            className="server-switcher-chip"
            onClick={() => setSwitcherOpen(true)}
            title="Ver y cambiar servidor SrvFiles"
          >
            <Server size={13} aria-hidden="true" />
            <span>Servidor</span>
            <ChevronDown size={11} strokeWidth={2.5} aria-hidden="true" />
          </button>

          <button
            className="device-name-chip"
            onClick={() => setRenameOpen(true)}
            title="Cambiar nombre del dispositivo"
          >
            <User size={12} aria-hidden="true" />
            <span>{deviceName}</span>
          </button>

          {authenticated && (
            connected ? (
              <span
                className="status-chip"
                title={encrypted ? 'Conexión de transferencias cifrada (dispositivo ↔ servidor)' : 'Conexión de transferencias sin cifrar'}
              >
                {encrypted ? <Lock size={12} aria-hidden="true" /> : <LockOpen size={12} aria-hidden="true" />}
                <span>{encrypted ? 'Cifrado' : 'Sin cifrar'}</span>
              </span>
            ) : (
              <span className="status-chip status-chip--warning" role="status">
                <WifiOff size={12} aria-hidden="true" />
                <span>Reconectando…</span>
              </span>
            )
          )}
        </div>

        <div className="header__right">
          {isHost && (
            <button className="btn btn--secondary btn--sm header__connect" onClick={() => setConnectOpen(true)}>
              <QrCode size={15} aria-hidden="true" />
              Conectar un dispositivo
            </button>
          )}
          <DiskStats stats={stats} />
        </div>
      </header>

      <div className={`app ${isTauriApp() ? 'app--tauri' : ''}`}>
        <main className="main">
          {error && (
            <div className="error-banner" id="error-banner" role="alert">
              <span className="error-banner__text"><AlertTriangle size={16} aria-hidden="true" /> {error}</span>
              <button className="btn btn--ghost btn--sm" onClick={() => void refresh()}>Reintentar</button>
            </div>
          )}

          {/* Primero la gente de la red: es a quién se le manda. En el servidor,
              sin nadie conectado, invita a sumar un dispositivo. */}
          {(otherClients.length > 0 || isHost) && (
            <section className="section" aria-labelledby="devices-title">
              <div className="section__head">
                <h2 className="section__title" id="devices-title">En tu red</h2>
                {otherClients.length > 0 && <span className="section__count">{otherClients.length}</span>}
              </div>
              {otherClients.length > 0 ? (
                <OnlineClients
                  clients={onlineClients}
                  myClientId={myClientId}
                  activeTransfer={activeTransfer}
                  onSendFile={sendFileTo}
                  onCancelTransfer={cancelTransfer}
                  onViewServer={onConnect}
                  currentServerUrl={backendLanUrl}
                  e2eAvailable={e2eAvailable}
                />
              ) : (
                <div className="invite-card">
                  <p className="invite-card__text">
                    Todavía no hay otros dispositivos. Sumá un celular o una computadora para
                    compartir archivos y enviárselos directo.
                  </p>
                  <button className="btn btn--primary btn--sm" onClick={() => setConnectOpen(true)}>
                    <QrCode size={15} aria-hidden="true" />
                    Conectar un dispositivo
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="section" aria-labelledby="files-title">
            <div className="section__head">
              <h2 className="section__title" id="files-title">Carpeta compartida</h2>
              {!loading && <span className="section__count">{files.length}</span>}
            </div>

            <DropZone
              onUpload={upload}
              onCancel={cancelUpload}
              uploading={uploading}
              uploadProgress={uploadProgress}
              maxFileSizeMb={config?.maxFileSizeMb}
              compact={files.length > 0}
            />

            <FileList
              files={files}
              loading={loading}
              onRequestDelete={setPendingDelete}
              getLinkedUrl={getLinkedUrl}
              getPlainDownloadUrl={getPlainDownloadUrl}
              token={getToken(serverUrl)}
              canDelete={true}
              previewMaxMb={config?.previewMaxFileSizeMb}
              isLocal={isOwnServer}
            />
          </section>
        </main>

        <AppFooter />
      </div>
    </>
  );
}

export default App;
