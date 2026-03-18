import type { FileInfo } from '../api/files.api';
import { formatBytes } from '../utils/format';
import { getFileIcon } from '../utils/fileIcons';

interface FileItemProps {
  file: FileInfo;
  onDelete: (filename: string) => Promise<boolean>;
  onRequestDelete: (filename: string) => void;
  viewMode: 'list' | 'grid';
  getDownloadUrl: (filename: string) => string;
  canDelete: boolean;
}

/**
 * Individual file entry — renders as either a table row (list view) or a card (grid view).
 * Pure presentation component — no business logic.
 */
export function FileItem({ file, onDelete: _onDelete, onRequestDelete, viewMode, getDownloadUrl, canDelete }: FileItemProps) {
  const downloadUrl = getDownloadUrl(file.name);

  const handleDelete = () => onRequestDelete(file.name);

  if (viewMode === 'grid') {
    return (
      <div className="file-card" id={`file-${file.name}`}>
        <div className="file-card__icon">{getFileIcon(file.name)}</div>
        <div className="file-card__info">
          <span className="file-card__name" title={file.name}>{file.name}</span>
          <span className="file-card__meta">{formatBytes(file.size)}</span>
        </div>
        <div className="file-card__actions">
          <a href={downloadUrl} className="btn-icon btn-icon--download" title="Descargar" download>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </a>
          {canDelete && (
            <button onClick={handleDelete} className="btn-icon btn-icon--delete" title="Eliminar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // List view (table row)
  return (
    <tr className="file-row" id={`file-${file.name}`}>
      <td className="file-row__name">
        <span className="file-row__icon">{getFileIcon(file.name)}</span>
        <span title={file.name}>{file.name}</span>
      </td>
      <td className="file-row__size">{formatBytes(file.size)}</td>
      <td className="file-row__actions">
        <a href={downloadUrl} className="btn-icon btn-icon--download" title="Descargar" download>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </a>
        {canDelete && (
          <button onClick={handleDelete} className="btn-icon btn-icon--delete" title="Eliminar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </td>
    </tr>
  );
}
