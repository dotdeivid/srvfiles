import { lazy, Suspense, useEffect, useState } from 'react';
import type { FileInfo } from '../files/files.api';
import { getFileCategory } from '../../shared/utils/fileTypeHelper';
import { errorMessage } from '../../lib/http';
import { X } from 'lucide-react';
import { Dialog } from '../../shared/components/Dialog';

// Each preview is loaded on demand — only when a file of that type is opened.
const ImagePreview   = lazy(() => import('./previews/ImagePreview').then(m => ({ default: m.ImagePreview })));
const VideoPreview   = lazy(() => import('./previews/VideoPreview').then(m => ({ default: m.VideoPreview })));
const AudioPreview   = lazy(() => import('./previews/AudioPreview').then(m => ({ default: m.AudioPreview })));
const PdfPreview     = lazy(() => import('./previews/PdfPreview').then(m => ({ default: m.PdfPreview })));
const TextPreview    = lazy(() => import('./previews/TextPreview').then(m => ({ default: m.TextPreview })));
const UnknownPreview = lazy(() => import('./previews/UnknownPreview').then(m => ({ default: m.UnknownPreview })));

interface Props {
  file: FileInfo;
  /** Pide un enlace temporal (token de un solo archivo) para ver o descargar. */
  getLinkedUrl: (filename: string, kind: 'download' | 'preview') => Promise<string>;
  onDownload: () => void;
  onClose: () => void;
}

export function PreviewModal({ file, getLinkedUrl, onDownload, onClose }: Props) {
  const category = getFileCategory(file.name);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // El enlace inline (sin Content-Disposition: attachment) vale unos minutos
  // y solo para este archivo; alcanza para que el video pida rangos.
  useEffect(() => {
    if (category === 'unknown') return;
    let cancelled = false;
    getLinkedUrl(file.name, 'preview')
      .then((url) => { if (!cancelled) setPreviewUrl(url); })
      .catch((err) => { if (!cancelled) setLinkError(errorMessage(err, 'abrir la vista previa')); });
    return () => { cancelled = true; };
  }, [file.name, category, getLinkedUrl]);

  // Esc, clic fuera, foco y bloqueo del scroll de la página: Dialog.
  const renderContent = () => {
    if (category === 'unknown') return <UnknownPreview onDownload={onDownload} />;
    if (linkError) return <div className="preview-state">{linkError}</div>;
    if (!previewUrl) return <span className="preview-state">Cargando...</span>;
    switch (category) {
      case 'image':
      case 'svg':   return <ImagePreview src={previewUrl} fileName={file.name} />;
      case 'video': return <VideoPreview src={previewUrl} />;
      case 'audio': return <AudioPreview src={previewUrl} fileName={file.name} />;
      case 'pdf':   return <PdfPreview src={previewUrl} />;
      case 'text':  return <TextPreview src={previewUrl} onDownload={onDownload} />;
    }
  };

  return (
    <Dialog open onClose={onClose} label={`Vista previa de ${file.name}`} className="dialog--preview">
      <div className="preview-modal">
        <div className="preview-modal__header">
          <span className="preview-modal__title" title={file.name}>{file.name}</span>
          <button className="preview-modal__close btn-icon" onClick={onClose} title="Cerrar (ESC)" aria-label="Cerrar">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="preview-modal__body">
          <Suspense fallback={<span className="preview-state">Cargando...</span>}>
            {renderContent()}
          </Suspense>
        </div>
      </div>
    </Dialog>
  );
}
