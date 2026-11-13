import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import type { FileInfo } from './files.api';
import { formatBytes } from '../../shared/utils/format';
import { getFileIcon } from '../../shared/utils/fileIcons';
import { isTauriApp, nativeDownload, onNativeProgress, cancelNativeTransfer, showInFolder } from '../../lib/tauri';
import { errorMessage } from '../../lib/http';
import { log } from '../../lib/logger';
import { canPreview } from '../../shared/utils/fileTypeHelper';
import { PreviewModal } from '../preview/PreviewModal';
import { Download, Trash2, Eye, FolderOpen } from 'lucide-react';

interface FileItemProps {
  file: FileInfo;
  onRequestDelete: (filename: string) => void;
  viewMode: 'list' | 'grid';
  getLinkedUrl: (filename: string, kind: 'download' | 'preview') => Promise<string>;
  getPlainDownloadUrl: (filename: string) => string;
  token: string | null;
  canDelete: boolean;
  /** Max file size in MB allowed for preview. Comes from server config. */
  previewMaxMb?: number;
  /** El archivo está en este equipo (app de escritorio, servidor propio). */
  isLocal?: boolean;
}

/**
 * Descarga nativa (Tauri): en streaming a Descargas/SrvFiles, con progreso y
 * cancelación en el aviso. Manda el token en la cabecera.
 */
export async function downloadWithTauri(url: string, token: string | null, fileName: string): Promise<void> {
  const id = crypto.randomUUID();
  const toastId = toast.loading(`Descargando ${fileName}…`, {
    action: { label: 'Cancelar', onClick: () => void cancelNativeTransfer(id) },
  });
  const unlisten = await onNativeProgress('download-progress', id, (p) => {
    if (p.total > 0) {
      toast.loading(`Descargando ${fileName}… ${Math.round((p.loaded / p.total) * 100)}%`, {
        id: toastId,
        action: { label: 'Cancelar', onClick: () => void cancelNativeTransfer(id) },
      });
    }
  });
  try {
    const path = await nativeDownload(url, token, fileName, id);
    toast.success(`Guardado en ${path}`, { id: toastId });
  } catch (err) {
    const msg = String(err);
    if (msg.includes('cancelled')) toast.info('Descarga cancelada', { id: toastId });
    else {
      void log.error('[FileItem] native download failed', { fileName, error: msg });
      toast.error(`No se pudo descargar ${fileName}`, { id: toastId });
    }
  } finally {
    unlisten();
  }
}

/** Descarga en el navegador con un enlace temporal (token de un solo archivo). */
async function downloadInBrowser(getLinkedUrl: FileItemProps['getLinkedUrl'], fileName: string): Promise<void> {
  try {
    const url = await getLinkedUrl(fileName, 'download');
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    toast.error(errorMessage(err, `descargar "${fileName}"`));
  }
}

export function FileItem({
  file, onRequestDelete, viewMode, getLinkedUrl, getPlainDownloadUrl, token, canDelete, previewMaxMb = 1024, isLocal = false,
}: FileItemProps) {
  const [previewing, setPreviewing] = useState(false);

  const download = () => (isTauriApp()
    ? downloadWithTauri(getPlainDownloadUrl(file.name), token, file.name)
    : downloadInBrowser(getLinkedUrl, file.name));

  const handlePreview = () => {
    if (file.size > previewMaxMb * 1024 * 1024) {
      toast.warning(`El archivo es demasiado grande para previsualizar (máx. ${previewMaxMb} MB)`);
      return;
    }
    setPreviewing(true);
  };

  const actions = (
    <>
      {canPreview(file.name) && (
        <button onClick={handlePreview} className="btn-icon btn-icon--preview" title="Vista previa" aria-label={`Vista previa de ${file.name}`}>
          <Eye size={16} />
        </button>
      )}
      {isLocal ? (
        // Ya está en Descargas/SrvFiles: descargarlo crearía una copia.
        <button
          onClick={() => void showInFolder(file.name).catch((err) => toast.error(String(err)))}
          className="btn-icon btn-icon--download"
          title="Mostrar en la carpeta"
          aria-label={`Mostrar ${file.name} en la carpeta`}
        >
          <FolderOpen size={16} />
        </button>
      ) : (
        <button
          onClick={() => void download()}
          className="btn-icon btn-icon--download"
          title="Descargar"
          aria-label={`Descargar ${file.name}`}
        >
          <Download size={16} />
        </button>
      )}
      {canDelete && (
        <button onClick={() => onRequestDelete(file.name)} className="btn-icon btn-icon--delete" title="Eliminar" aria-label={`Eliminar ${file.name}`}>
          <Trash2 size={16} />
        </button>
      )}
    </>
  );

  const preview = previewing && createPortal(
    <PreviewModal
      file={file}
      getLinkedUrl={getLinkedUrl}
      onDownload={() => void download()}
      onClose={() => setPreviewing(false)}
    />,
    document.body,
  );

  if (viewMode === 'grid') {
    return (
      <>
        <div className="file-card" id={`file-${file.name}`}>
          <div className="file-card__icon" aria-hidden="true">{getFileIcon(file.name)}</div>
          <div className="file-card__info">
            <span className="file-card__name" title={file.name}>{file.name}</span>
            <span className="file-card__meta">{formatBytes(file.size)}</span>
          </div>
          <div className="file-card__actions">{actions}</div>
        </div>
        {preview}
      </>
    );
  }

  return (
    <>
      <tr className="file-row" id={`file-${file.name}`}>
        <td className="file-row__name">
          <span className="file-row__icon" aria-hidden="true">{getFileIcon(file.name)}</span>
          <span title={file.name}>{file.name}</span>
        </td>
        <td className="file-row__size">{formatBytes(file.size)}</td>
        <td className="file-row__actions">{actions}</td>
      </tr>
      {preview}
    </>
  );
}
