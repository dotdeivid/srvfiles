import { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { isTauriApp, pathInfo } from '../../lib/tauri';
import { formatBytes } from '../../shared/utils/format';
import { log } from '../../lib/logger';
import type { UploadItem, UploadOutcome } from './useFiles';
import { Upload, X } from 'lucide-react';

interface DropZoneProps {
  onUpload: (items: UploadItem[]) => Promise<UploadOutcome>;
  onCancel: () => void;
  uploading: boolean;
  /** 0–100 */
  uploadProgress: number;
  /** Límite por archivo en MB (0 o ausente = sin límite). */
  maxFileSizeMb?: number;
  /** Ya hay archivos: se muestra como una barra en lugar del área grande. */
  compact?: boolean;
}

// En pantallas táctiles no se arrastra: se toca para elegir.
const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

const keyOf = (i: UploadItem) => (i.kind === 'path' ? `p:${i.path}` : `f:${i.name}:${i.size}:${i.file.lastModified}`);

/**
 * Drag & drop zone for file uploads.
 *
 * - En el navegador: react-dropzone (File API); el navegador lee los
 *   archivos en streaming al subir.
 * - En Tauri: el drag del sistema llega como rutas (el webview intercepta el
 *   drop) y se suben con un comando nativo, sin cargar el archivo en memoria.
 * - Toda la ventana acepta archivos: no hace falta apuntar al área.
 */
export function DropZone({ onUpload, onCancel, uploading, uploadProgress, maxFileSizeMb, compact = false }: DropZoneProps) {
  const [staged, setStaged] = useState<UploadItem[]>([]);
  const [tauriDragActive, setTauriDragActive] = useState(false);
  const [windowDragActive, setWindowDragActive] = useState(false);
  const uploadingRef = useRef(uploading);
  uploadingRef.current = uploading;

  const maxBytes = maxFileSizeMb && maxFileSizeMb > 0 ? maxFileSizeMb * 1024 * 1024 : null;

  const addItems = useCallback((items: UploadItem[]) => {
    setStaged((prev) => {
      const existing = new Set(prev.map(keyOf));
      const fresh = items.filter((i) => !existing.has(keyOf(i)));
      return fresh.length > 0 ? [...prev, ...fresh] : prev;
    });
  }, []);

  // ─── Tauri native drag-drop ───────────────────────────────────────
  useEffect(() => {
    if (!isTauriApp()) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;

    (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const stop = await getCurrentWebview().onDragDropEvent(async (event) => {
          const { type } = event.payload;
          if (type === 'enter' || type === 'over') { setTauriDragActive(true); return; }
          if (type === 'leave') { setTauriDragActive(false); return; }
          if (type === 'drop') {
            setTauriDragActive(false);
            if (uploadingRef.current) return;
            const infos = await pathInfo(event.payload.paths ?? []);
            addItems(infos.map((f) => ({ kind: 'path' as const, path: f.path, name: f.name, size: f.size })));
          }
        });
        // Si el efecto ya se limpió mientras se registraba, soltar enseguida
        // (antes quedaban listeners duplicados y cada drop llegaba dos veces).
        if (disposed) stop();
        else unlisten = stop;
      } catch (e) {
        void log.warn('[DropZone] could not set up Tauri drag-drop listener', { error: String(e) });
      }
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [addItems]);

  // ─── Standard react-dropzone (click + browser drag) ───────────────
  const onDrop = useCallback((accepted: File[]) => {
    addItems(accepted.map((file) => ({ kind: 'file' as const, file, name: file.name, size: file.size })));
  }, [addItems]);

  const { getRootProps, getInputProps, rootRef, isDragActive: htmlDragActive } = useDropzone({
    onDrop,
    disabled: uploading,
    // En Tauri el drag del sistema lo maneja el listener de arriba.
    noDrag: isTauriApp(),
  });

  // ─── Browser: soltar en cualquier parte de la ventana ─────────────
  // (En Tauri el evento nativo ya cubre toda la ventana.) Los drops sobre el
  // área los maneja react-dropzone; acá solo los de afuera.
  useEffect(() => {
    if (isTauriApp()) return;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setWindowDragActive(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setWindowDragActive(false);
    };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onWindowDrop = (e: DragEvent) => {
      depth = 0;
      setWindowDragActive(false);
      if (!hasFiles(e) || rootRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      if (uploadingRef.current) return;
      onDrop(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onWindowDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onWindowDrop);
    };
  }, [onDrop, rootRef]);

  const isDragActive = htmlDragActive || tauriDragActive || windowDragActive;
  const oversized = maxBytes ? staged.filter((i) => i.size > maxBytes) : [];
  const totalSize = staged.reduce((s, i) => s + i.size, 0);

  const handleUpload = async () => {
    if (staged.length === 0 || oversized.length > 0) return;
    const outcome = await onUpload(staged);
    if (outcome.cancelled) {
      toast.info('Subida cancelada');
      return;
    }
    if (outcome.failed.length > 0) {
      const failedNames = new Set(outcome.failed.map((f) => f.name));
      toast.error(
        `No se pudieron subir ${outcome.failed.length} archivo(s): ` +
        outcome.failed.map((f) => `${f.name || 'archivo'} (${f.reason})`).join(', '),
      );
      setStaged((prev) => prev.filter((i) => failedNames.has(i.name)));
      return;
    }
    if (outcome.ok) {
      toast.success(staged.length > 1 ? `${staged.length} archivos subidos` : 'Archivo subido');
      setStaged([]);
    }
  };

  return (
    <div className="dropzone-container">
      <div
        {...getRootProps()}
        className={`dropzone ${compact ? 'dropzone--compact' : ''} ${isDragActive ? 'dropzone--active' : ''} ${uploading ? 'dropzone--disabled' : ''}`}
        id="file-dropzone"
      >
        <input {...getInputProps()} />
        <div className="dropzone__icon" aria-hidden="true">
          <Upload size={compact ? 20 : 48} strokeWidth={compact ? 2 : 1.5} />
        </div>
        {isDragActive ? (
          <p className="dropzone__text">Soltá los archivos para subirlos</p>
        ) : (
          <>
            <p className="dropzone__text">
              {isTouch ? (
                <span className="dropzone__link">Tocá para elegir archivos</span>
              ) : (
                <>
                  Arrastrá archivos a la ventana o{' '}
                  <span className="dropzone__link">buscá en tu dispositivo</span>
                </>
              )}
            </p>
            {maxFileSizeMb ? (
              <p className="dropzone__hint">Máximo {formatBytes(maxFileSizeMb * 1024 * 1024)} por archivo</p>
            ) : null}
          </>
        )}
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <div className="upload-progress" id="upload-progress">
          <div
            className="upload-progress__bar"
            role="progressbar"
            aria-label="Subiendo archivos"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={uploadProgress}
          >
            <div className="upload-progress__fill" style={{ width: `${uploadProgress}%` }} />
          </div>
          <span className="upload-progress__text">{uploadProgress}%</span>
          <button className="btn btn--ghost btn--sm" onClick={onCancel} id="cancel-upload-btn">
            Cancelar
          </button>
        </div>
      )}

      {/* Staged files preview */}
      {staged.length > 0 && !uploading && (
        <div className="staged-files">
          <div className="staged-files__header">
            <span className="staged-files__count">
              {staged.length} archivo{staged.length > 1 ? 's' : ''} seleccionado{staged.length > 1 ? 's' : ''}
              {' '}({formatBytes(totalSize)})
            </span>
            <button onClick={() => setStaged([])} className="staged-files__clear" id="clear-staged-btn">
              Limpiar
            </button>
          </div>
          <ul className="staged-files__list">
            {staged.map((item, idx) => {
              const tooBig = maxBytes !== null && item.size > maxBytes;
              return (
                <li key={keyOf(item)} className="staged-files__item">
                  <span className={`staged-files__name ${tooBig ? 'staged-files__name--too-big' : ''}`}>
                    {item.name}
                  </span>
                  <span className="staged-files__size">
                    {formatBytes(item.size)}{tooBig ? ' — excede el límite' : ''}
                  </span>
                  <button
                    onClick={() => setStaged((prev) => prev.filter((_, i) => i !== idx))}
                    className="btn-icon staged-files__remove"
                    aria-label={`Quitar ${item.name}`}
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            onClick={handleUpload}
            className="btn btn--primary"
            id="upload-btn"
            disabled={oversized.length > 0}
            aria-describedby={oversized.length > 0 ? 'staged-files-blocked' : undefined}
          >
            <Upload size={16} />
            Subir {staged.length > 1 ? `${staged.length} archivos` : 'archivo'}
          </button>
          {oversized.length > 0 && (
            <p className="staged-files__blocked" id="staged-files-blocked">
              Quitá los archivos que exceden el límite para poder subir.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
