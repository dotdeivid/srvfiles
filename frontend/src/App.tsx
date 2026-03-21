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

// ─── Root: handles auto-connect + splash ──────────────────────────
function App() {
  const { serverUrl, connecting, availableServers, connect } = useMode();

  if (connecting) {
    return <ConnectingScreen />;
  }

  return (
    <FileApp
      serverUrl={serverUrl!}
      availableServers={availableServers}
      onConnect={connect}
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
  availableServers: unknown[];
  onConnect: (url: string) => void;
}

function FileApp({ serverUrl }: FileAppProps) {
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

        {/* Center: server IP chip — centered on desktop, stacked on mobile */}
        <div className="header__center">
          {webUrl && (
            <button
              className="web-url-chip"
              onClick={copyWebUrl}
              title="Copiar URL para acceder desde el navegador"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{webUrl.replace('http://', '')}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          )}
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
