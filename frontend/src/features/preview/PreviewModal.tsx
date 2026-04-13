import { lazy, Suspense, useEffect, useRef } from 'react';
import type { FileInfo } from '../files/files.api';
import { getFileCategory } from '../../shared/utils/fileTypeHelper';
import { X } from 'lucide-react';

// Each preview is loaded on demand — only when a file of that type is opened.
const ImagePreview   = lazy(() => import('./previews/ImagePreview').then(m => ({ default: m.ImagePreview })));
const VideoPreview   = lazy(() => import('./previews/VideoPreview').then(m => ({ default: m.VideoPreview })));
const AudioPreview   = lazy(() => import('./previews/AudioPreview').then(m => ({ default: m.AudioPreview })));
const PdfPreview     = lazy(() => import('./previews/PdfPreview').then(m => ({ default: m.PdfPreview })));
const TextPreview    = lazy(() => import('./previews/TextPreview').then(m => ({ default: m.TextPreview })));
const UnknownPreview = lazy(() => import('./previews/UnknownPreview').then(m => ({ default: m.UnknownPreview })));

interface Props {
  file: FileInfo;
  downloadUrl: string;
  onClose: () => void;
}

export function PreviewModal({ file, downloadUrl, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const category = getFileCategory(file.name);

  // URL inline (sin Content-Disposition: attachment) para embeber en iframe/video/audio
  const previewUrl = downloadUrl.replace('/api/files/download/', '/api/files/preview/');

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const renderContent = () => {
    switch (category) {
      case 'image':
      case 'svg':    return <ImagePreview src={previewUrl} fileName={file.name} />;
      case 'video':  return <VideoPreview src={previewUrl} />;
      case 'audio':  return <AudioPreview src={previewUrl} fileName={file.name} />;
      case 'pdf':    return <PdfPreview src={previewUrl} />;
      case 'text':   return <TextPreview src={previewUrl} />;
      default:       return <UnknownPreview downloadUrl={downloadUrl} fileName={file.name} />;
    }
  };

  return (
    <div className="preview-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="preview-modal">
        <div className="preview-modal__header">
          <span className="preview-modal__title" title={file.name}>{file.name}</span>
          <button className="preview-modal__close btn-icon" onClick={onClose} title="Cerrar (ESC)">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="preview-modal__body">
          <Suspense fallback={<span className="preview-state">Cargando...</span>}>
            {renderContent()}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
