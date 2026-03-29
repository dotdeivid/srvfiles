import { useEffect, useRef } from 'react';
import type { FileInfo } from '../api/files.api';
import { getFileCategory } from '../utils/fileTypeHelper';
import { ImagePreview } from './preview/ImagePreview';
import { VideoPreview } from './preview/VideoPreview';
import { AudioPreview } from './preview/AudioPreview';
import { PdfPreview } from './preview/PdfPreview';
import { TextPreview } from './preview/TextPreview';
import { UnknownPreview } from './preview/UnknownPreview';

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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="preview-modal__body">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
