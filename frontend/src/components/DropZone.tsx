import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { isTauriApp } from '../hooks/useDownloadDir';
import { formatBytes } from '../utils/format';

interface DropZoneProps {
  onUpload: (files: File[]) => Promise<boolean>;
  uploading: boolean;
  uploadProgress: number;
}

/**
 * Drag & drop zone for file uploads.
 *
 * - In regular browsers: uses react-dropzone (HTML5 File API).
 * - In Tauri: react-dropzone handles click-to-browse; OS drag-drop
 *   is handled via Tauri's webview event API because Tauri intercepts
 *   native drop events before they reach the DOM.
 */
export function DropZone({ onUpload, uploading, uploadProgress }: DropZoneProps) {
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [tauriDragActive, setTauriDragActive] = useState(false);

  // ─── Tauri native drag-drop ───────────────────────────────────────
  useEffect(() => {
    if (!isTauriApp()) return;

    let unlisten: (() => void) | undefined;

    async function setup() {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const webview = getCurrentWebview();

        unlisten = await webview.onDragDropEvent(async (event) => {
          const type = event.payload.type;

          if (type === 'enter' || type === 'over') {
            setTauriDragActive(true);
            return;
          }

          if (type === 'leave') {
            setTauriDragActive(false);
            return;
          }

          if (type === 'drop') {
            setTauriDragActive(false);
            if (uploading) return;

            const paths: string[] = event.payload.paths ?? [];
            if (paths.length === 0) return;

            const { readFile } = await import('@tauri-apps/plugin-fs');
            const files: File[] = [];

            for (const filePath of paths) {
              try {
                const data = await readFile(filePath);
                // Extract filename from path (works for both / and \)
                const name = filePath.replace(/\\/g, '/').split('/').pop() || 'file';
                files.push(new File([data], name));
              } catch (e) {
                console.error('[Tauri drop] Could not read file:', filePath, e);
              }
            }

            if (files.length > 0) {
              setStagedFiles((prev) => {
                // Deduplicate by name+size to avoid Tauri double-fire
                const existing = new Set(prev.map((f) => `${f.name}:${f.size}`));
                const unique = files.filter((f) => !existing.has(`${f.name}:${f.size}`));
                return unique.length > 0 ? [...prev, ...unique] : prev;
              });
            }
          }
        });
      } catch (e) {
        console.warn('[Tauri drop] Could not set up drag-drop listener:', e);
      }
    }

    setup();
    return () => { unlisten?.(); };
  }, [uploading]);

  // ─── Standard react-dropzone (click + browser drag) ───────────────
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setStagedFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive: htmlDragActive } = useDropzone({
    onDrop,
    disabled: uploading,
    // In Tauri the OS drag-drop is handled by the webview event above.
    // Disable react-dropzone's own drop handler to avoid processing files twice.
    noDrag: isTauriApp(),
  });

  const isDragActive = htmlDragActive || tauriDragActive;

  // ─── Upload actions ───────────────────────────────────────────────
  const handleUpload = async () => {
    if (stagedFiles.length === 0) return;
    const success = await onUpload(stagedFiles);
    if (success) setStagedFiles([]);
  };

  const removeStaged = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => setStagedFiles([]);

  return (
    <div className="dropzone-container">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'dropzone--active' : ''} ${uploading ? 'dropzone--disabled' : ''}`}
        id="file-dropzone"
      >
        <input {...getInputProps()} />
        <div className="dropzone__icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
              Arrastrá archivos aquí o{' '}
              <span className="dropzone__link">buscá en tu dispositivo</span>
            </p>
            <p className="dropzone__hint">Máximo 10GB por archivo</p>
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
              {stagedFiles.length} archivo{stagedFiles.length > 1 ? 's' : ''} seleccionado
              {stagedFiles.length > 1 ? 's' : ''}
            </span>
            <button onClick={clearAll} className="staged-files__clear" id="clear-staged-btn">
              Limpiar
            </button>
          </div>
          <ul className="staged-files__list">
            {stagedFiles.map((file, idx) => (
              <li key={`${file.name}-${idx}`} className="staged-files__item">
                <span className="staged-files__name">{file.name}</span>
                <span className="staged-files__size">{formatBytes(file.size)}</span>
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
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
