import { useState, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { useFiles } from './hooks/useFiles';
import { DropZone } from './components/DropZone';
import { FileList } from './components/FileList';
import { DiskStats } from './components/DiskStats';
import { QRFooter } from './components/QRFooter';
import { ConfirmModal } from './components/ConfirmModal';

/**
 * Main application component.
 * Layout: Header → DropZone → FileList → QRFooter
 */
function App() {
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
  } = useFiles();

  // ─── Confirm modal state ──────────────────────────────────────
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

  // ─── App name from config or env ──────────────────────────────
  const appName = config?.appName || import.meta.env.VITE_APP_NAME || 'SrvFiles';

  return (
    <div className="app">
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

      {/* Confirm Modal */}
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
                  <stop offset="0%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="22" fill="#0f0f1a"/>
              <path d="M30 25h40c2.8 0 5 2.2 5 5v40c0 2.8-2.2 5-5 5H30c-2.8 0-5-2.2-5-5V30c0-2.8 2.2-5 5-5z" stroke="url(#logo-gradient)" strokeWidth="3" fill="none"/>
              <path d="M35 45h30M35 55h20" stroke="url(#logo-gradient)" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="header__text">
            <h1 className="header__title">{appName}</h1>
          </div>
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

        <FileList
          files={files}
          loading={loading}
          onDelete={remove}
          onRequestDelete={handleRequestDelete}
        />
      </main>

      {/* Footer with QR */}
      <QRFooter config={config} />
    </div>
  );
}

export default App;
