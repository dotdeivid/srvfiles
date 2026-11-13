import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import type { FileInfo } from './files.api';
import { formatBytes, formatDate } from '../../shared/utils/format';
import { getFileIcon } from '../../shared/utils/fileIcons';
import { showInFolder } from '../../lib/tauri';
import { canPreview } from '../../shared/utils/fileTypeHelper';
import { PreviewModal } from '../preview/PreviewModal';
import { downloadFile, type DownloadDeps } from './download';
import { Download, Trash2, Eye, FolderOpen } from 'lucide-react';

interface FileItemProps extends DownloadDeps {
  file: FileInfo;
  onRequestDelete: (filenames: string[]) => void;
  viewMode: 'list' | 'grid';
  canDelete: boolean;
  /** Max file size in MB allowed for preview. Comes from server config. */
  previewMaxMb?: number;
  /** El archivo está en este equipo (app de escritorio, servidor propio). */
  isLocal?: boolean;
  selected: boolean;
  onToggleSelected: (filename: string) => void;
}

export function FileItem({
  file, onRequestDelete, viewMode, getLinkedUrl, getPlainDownloadUrl, token, canDelete, previewMaxMb = 1024, isLocal = false,
  selected, onToggleSelected,
}: FileItemProps) {
  const [previewing, setPreviewing] = useState(false);

  const download = () => downloadFile(file.name, { getLinkedUrl, getPlainDownloadUrl, token });

  const handlePreview = () => {
    if (file.size > previewMaxMb * 1024 * 1024) {
      toast.warning(`El archivo es demasiado grande para previsualizar (máx. ${previewMaxMb} MB)`);
      return;
    }
    setPreviewing(true);
  };

  const checkbox = (
    <label className="file-select" title={selected ? 'Quitar de la selección' : 'Seleccionar'}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelected(file.name)}
        aria-label={`Seleccionar ${file.name}`}
      />
    </label>
  );

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
        <button onClick={() => onRequestDelete([file.name])} className="btn-icon btn-icon--delete" title="Eliminar" aria-label={`Eliminar ${file.name}`}>
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
        <div className={`file-card ${selected ? 'file-card--selected' : ''}`} id={`file-${file.name}`}>
          <div className="file-card__top">
            <div className="file-card__icon" aria-hidden="true">{getFileIcon(file.name)}</div>
            {checkbox}
          </div>
          <div className="file-card__info">
            <span className="file-card__name" title={file.name}>{file.name}</span>
            <span className="file-card__meta">{formatBytes(file.size)} · {formatDate(file.createdAt)}</span>
          </div>
          <div className="file-card__actions">{actions}</div>
        </div>
        {preview}
      </>
    );
  }

  // Cada celda envuelve su contenido en un div: un <td> con display:flex deja
  // de comportarse como celda y corta los bordes de la fila.
  return (
    <>
      <tr className={`file-row ${selected ? 'file-row--selected' : ''}`} id={`file-${file.name}`}>
        <td className="file-row__cell file-row__cell--select">{checkbox}</td>
        <td className="file-row__cell file-row__cell--name">
          <div className="file-row__name">
            <span className="file-row__icon" aria-hidden="true">{getFileIcon(file.name)}</span>
            <span title={file.name}>{file.name}</span>
          </div>
        </td>
        <td className="file-row__cell file-row__size">{formatBytes(file.size)}</td>
        <td className="file-row__cell file-row__date">
          <time dateTime={file.createdAt}>{formatDate(file.createdAt)}</time>
        </td>
        <td className="file-row__cell file-row__cell--actions">
          <div className="file-row__actions">{actions}</div>
        </td>
      </tr>
      {preview}
    </>
  );
}
