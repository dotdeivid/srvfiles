import { toast } from 'sonner';
import { isTauriApp, nativeDownload, onNativeProgress, cancelNativeTransfer } from '../../lib/tauri';
import { errorMessage } from '../../lib/http';
import { log } from '../../lib/logger';

/** Lo que hace falta para descargar un archivo del servidor actual. */
export interface DownloadDeps {
  /** Pide un enlace temporal (token de un solo archivo) para ver o descargar. */
  getLinkedUrl: (filename: string, kind: 'download' | 'preview') => Promise<string>;
  getPlainDownloadUrl: (filename: string) => string;
  token: string | null;
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
      void log.error('[download] native download failed', { fileName, error: msg });
      toast.error(`No se pudo descargar ${fileName}`, { id: toastId });
    }
  } finally {
    unlisten();
  }
}

/** Descarga en el navegador con un enlace temporal (token de un solo archivo). */
async function downloadInBrowser(getLinkedUrl: DownloadDeps['getLinkedUrl'], fileName: string): Promise<void> {
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

/** Descarga un archivo con el método de la plataforma (nativo en Tauri, enlace en el navegador). */
export function downloadFile(fileName: string, deps: DownloadDeps): Promise<void> {
  return isTauriApp()
    ? downloadWithTauri(deps.getPlainDownloadUrl(fileName), deps.token, fileName)
    : downloadInBrowser(deps.getLinkedUrl, fileName);
}

/**
 * Descarga varios archivos uno tras otro. En el navegador se deja una pausa
 * entre clics: varios `<a download>` seguidos hacen que el navegador descarte
 * algunos (y pregunta una vez si se permiten descargas múltiples).
 */
export async function downloadFiles(fileNames: string[], deps: DownloadDeps): Promise<void> {
  for (const [i, name] of fileNames.entries()) {
    if (i > 0 && !isTauriApp()) await new Promise((r) => setTimeout(r, 400));
    await downloadFile(name, deps);
  }
}
