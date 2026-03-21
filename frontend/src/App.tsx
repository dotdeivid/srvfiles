import { useState, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { useFiles } from './hooks/useFiles';
import { useMode } from './hooks/useMode';
import { useTransfer } from './hooks/useTransfer';
import { useDeviceName } from './hooks/useDeviceName';
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
      <div className="connecting-screen__logo">
        <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="logo-gradient-splash" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" rx="22" fill="#0f0f1a" />
          <path
            d="M30 25h40c2.8 0 5 2.2 5 5v40c0 2.8-2.2 5-5 5H30c-2.8 0-5-2.2-5-5V30c0-2.8 2.2-5 5-5z"
            stroke="url(#logo-gradient-splash)"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M35 45h30M35 55h20"
            stroke="url(#logo-gradient-splash)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
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
  } = useFiles(serverUrl);

  const appName = config?.appName || import.meta.env.VITE_APP_NAME || 'SrvFiles';

  // ─── Device name (identifies this client in transfers) ────────
  const { deviceName, showNameModal, saveName } = useDeviceName();

  // ─── Direct transfer ──────────────────────────────────────────
  const handleFileReceived = useCallback(
    async (fileName: string, _mimeType: string, blob: Blob) => {
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
  });

  const handleSaveName = useCallback(
    (name: string) => {
      saveName(name);
      const trimmed = name.trim();
      if (trimmed) rename(trimmed);
    },
    [saveName, rename]
  );

  const handleRejectTransfer = useCallback(() => {
    rejectTransfer();
    toast.error('Transferencia rechazada');
  }, [rejectTransfer]);

  const otherClients = onlineClients.filter((c) => c.clientId !== myClientId);

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
    const success = await remove(pendingDelete);
    if (success) {
      toast.success(`"${pendingDelete}" eliminado`);
    } else {
      toast.error(`Error al eliminar "${pendingDelete}"`);
    }
    setPendingDelete(null);
  }, [pendingDelete, remove]);

  const handleCancelDelete = useCallback(() => {
    setConfirmOpen(false);
    setPendingDelete(null);
  }, []);

  // ─── Web URL chip ─────────────────────────────────────────────
  const webUrl = config?.lanIp ? `http://${config.lanIp}:${config.frontendPort}` : null;
  // URL del backend con IP LAN real (para mostrar en el modal, evita "localhost")
  const backendLanUrl = config?.lanIp ? `http://${config.lanIp}:${config.port}` : serverUrl;

  const copyWebUrl = () => {
    if (!webUrl) return;
    navigator.clipboard
      .writeText(webUrl)
      .then(() => toast.success('URL copiada al portapapeles'))
      .catch(() => toast.error('No se pudo copiar'));
  };

  return (
    <div className={`app ${isTauriApp() ? 'app--tauri' : ''}`}>
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

      {/* First-launch: ask user for a device name */}
      <NameModal
        isOpen={showNameModal}
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

      {/* Header */}
      <header className="header" id="app-header">
        <div className="header__left">
          <div className="header__logo">
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
              <defs>
                <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="22" fill="#0f0f1a" />
              <path
                d="M30 25h40c2.8 0 5 2.2 5 5v40c0 2.8-2.2 5-5 5H30c-2.8 0-5-2.2-5-5V30c0-2.8 2.2-5 5-5z"
                stroke="url(#logo-gradient)"
                strokeWidth="3"
                fill="none"
              />
              <path
                d="M35 45h30M35 55h20"
                stroke="url(#logo-gradient)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="header__text">
            <h1 className="header__title">{appName}</h1>
          </div>
        </div>

        {/* Center: IP chip — abre el server switcher */}
        <div className="header__center">
          <button
            className="server-switcher-chip"
            onClick={() => setSwitcherOpen(true)}
            title="Ver y cambiar servidor SrvFiles"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>{(webUrl ?? serverUrl).replace('http://', '')}</span>
            {serverClients.length > 0 && (
              <span className="server-switcher-chip__count">{serverClients.length}</span>
            )}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <div className="header__right">
          <DiskStats stats={stats} />
        </div>
      </header>

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
            />
          </div>
        </div>

        <FileList
          files={files}
          loading={loading}
          onDelete={remove}
          onRequestDelete={handleRequestDelete}
          getDownloadUrl={getDownloadUrl}
          canDelete={true}
        />
      </main>

      <QRFooter config={config} />
    </div>
  );
}

export default App;
