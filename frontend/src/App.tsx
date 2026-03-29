import { useState, useCallback, useEffect, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { useFiles } from './features/files/useFiles';
import { useMode } from './features/server/useMode';
import { useTransfer } from './features/transfer/useTransfer';
import { useDeviceName } from './shared/hooks/useDeviceName';
import { useAuth } from './features/auth/useAuth';
import { saveReceivedFile, isTauriApp } from './lib/tauri';
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
import { log } from './lib/logger';
import { Server, Lock, ChevronDown, User } from 'lucide-react';

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
  onRescan: () => Promise<import('./features/server/discovery.api').DiscoveredServer[]>;
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
