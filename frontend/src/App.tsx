import { useState, useCallback, useEffect, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { useFiles } from './hooks/useFiles';
import { useMode } from './hooks/useMode';
import { useTransfer } from './hooks/useTransfer';
import { useDeviceName } from './hooks/useDeviceName';
import { useAuth } from './hooks/useAuth';
import { saveReceivedFile, isTauriApp } from './hooks/useDownloadDir';
import { DropZone } from './components/DropZone';
import { FileList } from './components/FileList';
import { DiskStats } from './components/DiskStats';
import { QRFooter } from './components/QRFooter';
import { ConfirmModal } from './components/ConfirmModal';
import { OnlineClients } from './components/OnlineClients';
import { IncomingTransferModal } from './components/IncomingTransferModal';
import { NameModal } from './components/NameModal';
import { ServerSwitcherModal } from './components/ServerSwitcherModal';
import { PinDialog } from './components/PinDialog';
import { log } from './lib/logger';

// ─── Root: handles auto-connect + splash ──────────────────────────
function App() {
  const { serverUrl, connecting, connect, rescan } = useMode();

  if (connecting) {
    return <ConnectingScreen />;
  }

  return (
    <FileApp
      serverUrl={serverUrl!}
      onConnect={connect}
      onRescan={rescan}
    />
  );
}

// ─── Connecting / splash screen ────────────────────────────────────
function ConnectingScreen() {
  return (
    <div className="connecting-screen">
      <div className="connecting-screen__spinner" />
      <p className="connecting-screen__text">Buscando servidor...</p>
    </div>
  );
}

// ─── Main file UI ──────────────────────────────────────────────────
interface FileAppProps {
  serverUrl: string;
  onConnect: (url: string) => void;
  onRescan: () => Promise<import('./api/discovery.api').DiscoveredServer[]>;
}

function FileApp({ serverUrl, onConnect, onRescan }: FileAppProps) {
  const prevServerUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevServerUrlRef.current !== serverUrl) {
      if (prevServerUrlRef.current !== null) {
        void log.info('[App] server URL changed', { from: prevServerUrlRef.current, to: serverUrl });
      } else {
        void log.info('[App] connected to server', { serverUrl });
      }
      prevServerUrlRef.current = serverUrl;
    }
  }, [serverUrl]);

  const { authenticated, pinDialogOpen, pinError, serverPin, submitPin } = useAuth(serverUrl);

  const {
    files,
    stats,
    config,
    loading,
    uploading,
    uploadProgress,
    error,
    upload,
    remove,
    getDownloadUrl,
    fetchFiles,
    fetchStats,
  } = useFiles(authenticated && !pinDialogOpen ? serverUrl : null);

  const appName = config?.appName || import.meta.env.VITE_APP_NAME || 'SrvFiles';

  // ─── Device name (identifies this client in transfers) ────────
  const { deviceName, showNameModal, saveName } = useDeviceName();

  // ─── Direct transfer ──────────────────────────────────────────
  const handleFilesChanged = useCallback(() => {
    fetchFiles();
    fetchStats();
  }, [fetchFiles, fetchStats]);

  const handleFileReceived = useCallback(
    async (fileName: string, _mimeType: string, blob: Blob) => {
      void log.info('[App] file received via transfer', { fileName, size: blob.size });
      const savedPath = await saveReceivedFile(fileName, blob);
      toast.success(
        savedPath
          ? `"${fileName}" guardado en Descargas/SrvFiles`
          : `"${fileName}" recibido`
      );
    },
    []
  );

  const {
    myClientId,
    onlineClients,
    incomingRequest,
    activeTransfer,
    sendFileTo,
    acceptTransfer,
    rejectTransfer,
    cancelTransfer,
    rename,
  } = useTransfer(serverUrl, deviceName, handleFileReceived, () => {
    toast.error('El destinatario rechazó el envío');
  }, authenticated, handleFilesChanged);

  const handleSaveName = useCallback(
    (name: string) => {
      saveName(name);
      const trimmed = name.trim();
      if (trimmed) rename(trimmed);
      setRenameOpen(false);
    },
    [saveName, rename]
  );

  const handleRejectTransfer = useCallback(() => {
    rejectTransfer();
    toast.error('Transferencia rechazada');
  }, [rejectTransfer]);

  const otherClients = onlineClients.filter((c) => c.clientId !== myClientId);

  // ─── Rename modal ─────────────────────────────────────────────
  const [renameOpen, setRenameOpen] = useState(false);

  // ─── Server switcher modal ────────────────────────────────────
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const serverClients = onlineClients.filter((c) => c.isServer && c.clientId !== myClientId);

  // ─── Confirm delete modal ─────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const handleRequestDelete = useCallback((filename: string) => {
    setPendingDelete(filename);
    setConfirmOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setConfirmOpen(false);
    void log.info('[App] confirming delete', { filename: pendingDelete });
    const success = await remove(pendingDelete);
    if (success) {
      toast.success(`"${pendingDelete}" eliminado`);
    } else {
      void log.error('[App] delete failed for file', { filename: pendingDelete });
      toast.error(`Error al eliminar "${pendingDelete}"`);
    }
    setPendingDelete(null);
  }, [pendingDelete, remove]);

  const handleCancelDelete = useCallback(() => {
    setConfirmOpen(false);
    setPendingDelete(null);
  }, []);

  // ─── Web URL chip ─────────────────────────────────────────────
  // HTTPS URL — shown to the user and used in the QR / copy action.
  // External browsers need the HTTPS port to get a secure context.
  const webUrl = config?.lanIp && config?.httpsPort
    ? `https://${config.lanIp}:${config.httpsPort}`
    : null;
  // URL del backend con IP LAN real (para mostrar en el modal, evita "localhost")
  const backendLanUrl = config?.lanIp ? `http://${config.lanIp}:${config.port}` : serverUrl;

  // Track local LAN IP — persists even after switching to a remote server
  const [localLanIp, setLocalLanIp] = useState<string | null>(null);
  useEffect(() => {
    if ((serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1')) && config?.lanIp) {
      setLocalLanIp(config.lanIp);
    }
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

      {/* PIN authentication dialog — shown for remote servers or if auto-auth fails */}
      <PinDialog
        isOpen={pinDialogOpen}
        serverUrl={backendLanUrl}
        error={pinError}
        onSubmit={submitPin}
      />

      {/* First-launch or manual rename */}
      <NameModal
        isOpen={showNameModal || renameOpen}
        defaultName={deviceName}
        onSave={handleSaveName}
      />

      {/* Incoming direct transfer request */}
      <IncomingTransferModal
        request={incomingRequest}
        onAccept={acceptTransfer}
        onReject={handleRejectTransfer}
      />

      {/* Server switcher */}
      <ServerSwitcherModal
        isOpen={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        currentServerUrl={backendLanUrl}
        copyUrl={webUrl ?? serverUrl}
        serverClients={serverClients}
        localLanIp={localLanIp}
        onConnect={onConnect}
        onRescan={onRescan}
      />

      {/* Confirm delete modal */}
      <ConfirmModal
        isOpen={confirmOpen}
        title="Eliminar archivo"
        message={`¿Estás seguro de que querés eliminar "${pendingDelete}"? Esta acción no se puede deshacer.`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Header — fuera del contenedor max-width para ocupar 100% natural */}
      <header className="header" id="app-header">
        <div className="header__left">
          <div className="header__text">
            <h1 className="header__title">{appName}</h1>
          </div>
        </div>

        {/* Center: IP chip + device name — abre el server switcher / rename */}
        <div className="header__center">
          <button
            className="server-switcher-chip"
            onClick={() => setSwitcherOpen(true)}
            title="Ver y cambiar servidor SrvFiles"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
            <span>Servidor</span>
            {serverPin && (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>{serverPin}</span>
              </>
            )}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <button
            className="device-name-chip"
            onClick={() => setRenameOpen(true)}
            title="Cambiar nombre del dispositivo"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            <span>{deviceName}</span>
          </button>
        </div>

        <div className="header__right">
          <DiskStats stats={stats} />
        </div>
      </header>

      <div className={`app ${isTauriApp() ? 'app--tauri' : ''}`}>
        {/* Main content */}
        <main className="main">
          {error && (
            <div className="error-banner" id="error-banner">
              <span>⚠️ {error}</span>
            </div>
          )}

          <DropZone
            onUpload={upload}
            uploading={uploading}
            uploadProgress={uploadProgress}
          />

          {/* Direct transfer — animates open when other devices are connected */}
          <div className={`clients-wrap ${otherClients.length > 0 ? 'clients-wrap--open' : ''}`}>
            <div className="clients-wrap__inner">
              <OnlineClients
                clients={onlineClients}
                myClientId={myClientId}
                activeTransfer={activeTransfer}
                onSendFile={sendFileTo}
                onCancelTransfer={cancelTransfer}
                onViewServer={(url) => { onConnect(url); }}
                currentServerUrl={backendLanUrl}
              />
            </div>
          </div>

          <FileList
            files={files}
            loading={loading}
            onRequestDelete={handleRequestDelete}
            getDownloadUrl={getDownloadUrl}
            canDelete={true}
            previewMaxMb={config?.previewMaxFileSizeMb}
          />
        </main>

        <QRFooter config={config} />
      </div>
    </>
  );
}

export default App;
