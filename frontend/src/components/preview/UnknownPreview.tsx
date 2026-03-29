import { toast } from 'sonner';
import { isTauriApp, saveReceivedFile } from '../../hooks/useDownloadDir';

interface Props {
  downloadUrl: string;
  fileName: string;
}

export function UnknownPreview({ downloadUrl, fileName }: Props) {
  const handleDownloadAndOpen = async () => {
    const toastId = toast.loading(`Descargando ${fileName}…`);
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await saveReceivedFile(fileName, blob);
      toast.success(`${fileName} guardado en Descargas/SrvFiles`, { id: toastId });
    } catch {
      toast.error(`Error al descargar ${fileName}`, { id: toastId });
    }
  };

  return (
    <div className="preview-unknown">
      <span className="preview-unknown__icon">📁</span>
      <p className="preview-unknown__text">
        Este tipo de archivo no se puede previsualizar.
      </p>
      {isTauriApp() ? (
        <button className="btn btn--primary" onClick={handleDownloadAndOpen}>
          Descargar y abrir
        </button>
      ) : (
        <a href={downloadUrl} download={fileName} className="btn btn--primary">
          Descargar
        </a>
      )}
    </div>
  );
}
