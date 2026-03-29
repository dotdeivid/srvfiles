import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import type { FileInfo } from './files.api';
import { formatBytes } from '../../shared/utils/format';
import { getFileIcon } from '../../shared/utils/fileIcons';
import { isTauriApp, saveReceivedFile } from '../../lib/tauri';
import { canPreview } from '../../shared/utils/fileTypeHelper';
import { PreviewModal } from '../preview/PreviewModal';
import { Download, Trash2, Eye } from 'lucide-react';

interface FileItemProps {
  file: FileInfo;
  onRequestDelete: (filename: string) => void;
  viewMode: 'list' | 'grid';
  getDownloadUrl: (filename: string) => string;
  canDelete: boolean;
  /** Max file size in MB allowed for preview. Comes from server config. */
  previewMaxMb?: number;
}

export function FileItem({ file, onRequestDelete, viewMode, getDownloadUrl, canDelete, previewMaxMb = 50 }: FileItemProps) {
  const [previewing, setPreviewing] = useState(false);
  const downloadUrl = getDownloadUrl(file.name);

  const handleDelete = () => onRequestDelete(file.name);

  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isTauriApp()) return;
    e.preventDefault();
    const toastId = toast.loading(`Descargando ${file.name}…`);
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await saveReceivedFile(file.name, blob);
      toast.success(`${file.name} guardado en Descargas/SrvFiles`, { id: toastId });
    } catch {
      toast.error(`Error al descargar ${file.name}`, { id: toastId });
    }
  };

  const handlePreview = () => {
    const maxBytes = previewMaxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.warning(`El archivo es demasiado grande para previsualizar (máx. ${previewMaxMb} MB)`);
      return;
    }
    setPreviewing(true);
  };

  const showEye = canPreview(file.name);

  // ─── Eye button (shared between list and grid) ───────────────────
  const eyeButton = showEye ? (
    <button onClick={handlePreview} className="btn-icon btn-icon--preview" title="Vista previa">
      <Eye size={16} />
    </button>
  ) : null;

  if (viewMode === 'grid') {
    return (
      <>
        <div className="file-card" id={`file-${file.name}`}>
          <div className="file-card__icon">{getFileIcon(file.name)}</div>
          <div className="file-card__info">
            <span className="file-card__name" title={file.name}>{file.name}</span>
            <span className="file-card__meta">{formatBytes(file.size)}</span>
          </div>
          <div className="file-card__actions">
            {eyeButton}
            <a href={downloadUrl} className="btn-icon btn-icon--download" title="Descargar" download onClick={handleDownload}>
              <Download size={16} />
            </a>
            {canDelete && (
              <button onClick={handleDelete} className="btn-icon btn-icon--delete" title="Eliminar">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
        {previewing && createPortal(
          <PreviewModal file={file} downloadUrl={downloadUrl} onClose={() => setPreviewing(false)} />,
          document.body,
        )}
      </>
    );
  }

  // List view
  return (
    <>
      <tr className="file-row" id={`file-${file.name}`}>
        <td className="file-row__name">
          <span className="file-row__icon">{getFileIcon(file.name)}</span>
          <span title={file.name}>{file.name}</span>
        </td>
        <td className="file-row__size">{formatBytes(file.size)}</td>
        <td className="file-row__actions">
          {eyeButton}
          <a href={downloadUrl} className="btn-icon btn-icon--download" title="Descargar" download onClick={handleDownload}>
            <Download size={16} />
          </a>
          {canDelete && (
            <button onClick={handleDelete} className="btn-icon btn-icon--delete" title="Eliminar">
              <Trash2 size={16} />
            </button>
          )}
        </td>
      </tr>
      {previewing && createPortal(
        <PreviewModal file={file} downloadUrl={downloadUrl} onClose={() => setPreviewing(false)} />,
        document.body,
      )}
    </>
  );
}
