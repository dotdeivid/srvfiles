import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface DropZoneProps {
  onUpload: (files: File[]) => Promise<boolean>;
  uploading: boolean;
  uploadProgress: number;
}

/**
 * Drag & drop zone for file uploads.
 * Shows preview of selected files before upload with a submit button.
 */
export function DropZone({ onUpload, uploading, uploadProgress }: DropZoneProps) {
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setStagedFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: uploading,
  });

  const handleUpload = async () => {
    if (stagedFiles.length === 0) return;
    const success = await onUpload(stagedFiles);
    if (success) setStagedFiles([]);
  };

  const removeStaged = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => setStagedFiles([]);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="dropzone-container">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'dropzone--active' : ''} ${uploading ? 'dropzone--disabled' : ''}`}
        id="file-dropzone"
      >
        <input {...getInputProps()} />
        <div className="dropzone__icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        {isDragActive ? (
          <p className="dropzone__text">Soltá los archivos aquí...</p>
        ) : (
          <>
            <p className="dropzone__text">
              Arrastrá archivos aquí o <span className="dropzone__link">buscá en tu dispositivo</span>
            </p>
            <p className="dropzone__hint">Máximo 2GB por archivo</p>
          </>
        )}
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <div className="upload-progress" id="upload-progress">
          <div className="upload-progress__bar">
            <div
              className="upload-progress__fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <span className="upload-progress__text">{uploadProgress}%</span>
        </div>
      )}

      {/* Staged files preview */}
      {stagedFiles.length > 0 && !uploading && (
        <div className="staged-files">
          <div className="staged-files__header">
            <span className="staged-files__count">
              {stagedFiles.length} archivo{stagedFiles.length > 1 ? 's' : ''} seleccionado{stagedFiles.length > 1 ? 's' : ''}
            </span>
            <button onClick={clearAll} className="staged-files__clear" id="clear-staged-btn">
              Limpiar
            </button>
          </div>
          <ul className="staged-files__list">
            {stagedFiles.map((file, idx) => (
              <li key={`${file.name}-${idx}`} className="staged-files__item">
                <span className="staged-files__name">{file.name}</span>
                <span className="staged-files__size">{formatSize(file.size)}</span>
                <button
                  onClick={() => removeStaged(idx)}
                  className="staged-files__remove"
                  aria-label={`Remove ${file.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button onClick={handleUpload} className="btn btn--primary" id="upload-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Subir {stagedFiles.length > 1 ? `${stagedFiles.length} archivos` : 'archivo'}
          </button>
        </div>
      )}
    </div>
  );
}
