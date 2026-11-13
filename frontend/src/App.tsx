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
import { QRFooter } from './shared/components/QRFooter';
import { ConfirmModal } from './shared/components/ConfirmModal';
import { OnlineClients } from './features/transfer/OnlineClients';
import { IncomingTransferModal } from './features/transfer/IncomingTransferModal';
import { NameModal } from './shared/components/NameModal';
import { ServerSwitcherModal } from './features/server/ServerSwitcherModal';
import { PinDialog } from './features/auth/PinDialog';
import { isLocalOrigin } from './shared/utils/serverUrl';
import { log } from './lib/logger';
import { Server, Lock, LockOpen, ChevronDown, User, WifiOff } from 'lucide-react';
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
    connected, encrypted, e2eAvailable, myClientId, onlineClients, incomingRequest, pendingRequests, activeTransfer,
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

  // ─── Server switcher modal ────────────────────────────────────
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const serverClients = onlineClients.filter((c) => c.isServer && c.clientId !== myClientId);

  // ─── Confirm delete modal ─────────────────────────────────────
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const handleConfirmDelete = useCallback(async () => {
    const name = pendingDelete;
    if (!name) return;
    setPendingDelete(null);
    const success = await remove(name);
    if (success) toast.success(`"${name}" eliminado`);
    else toast.error(`No se pudo eliminar "${name}"`);
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
        title="Eliminar archivo"
        message={`"${pendingDelete}" se eliminará de la carpeta compartida para todos los dispositivos. No se puede deshacer.`}
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
            <Server size={13} />
            <span>Servidor</span>
            {serverPin && (
              <>
                <Lock size={12} style={{ opacity: 0.6 }} />
                <span>{serverPin}</span>
              </>
            )}
            <ChevronDown size={11} strokeWidth={2.5} />
          </button>

          <button
            className="device-name-chip"
            onClick={() => setRenameOpen(true)}
            title="Cambiar nombre del dispositivo"
          >
            <User size={12} />
            <span>{deviceName}</span>
          </button>

          {authenticated && (
            connected ? (
              <span
                className="device-name-chip"
                title={encrypted ? 'Conexión de transferencias cifrada (dispositivo ↔ servidor)' : 'Conexión de transferencias sin cifrar'}
              >
                {encrypted ? <Lock size={12} /> : <LockOpen size={12} />}
              </span>
            ) : (
              <span className="device-name-chip" title="Sin conexión con el servidor — reconectando…" role="status">
                <WifiOff size={12} />
                <span>Reconectando…</span>
              </span>
            )
          )}
        </div>

        <div className="header__right">
          <DiskStats stats={stats} />
        </div>
      </header>

      <div className={`app ${isTauriApp() ? 'app--tauri' : ''}`}>
        <main className="main">
          {error && (
            <div className="error-banner" id="error-banner" role="alert">
              <span>⚠️ {error}</span>
              <button className="btn btn--ghost btn--sm" onClick={() => void refresh()}>Reintentar</button>
            </div>
          )}

          <DropZone
            onUpload={upload}
            onCancel={cancelUpload}
            uploading={uploading}
            uploadProgress={uploadProgress}
            maxFileSizeMb={config?.maxFileSizeMb}
          />

          <div className={`clients-wrap ${otherClients.length > 0 ? 'clients-wrap--open' : ''}`}>
            <div className="clients-wrap__inner">
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
            </div>
          </div>

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
        </main>

        <QRFooter config={config} />
      </div>
    </>
  );
}

export default App;
