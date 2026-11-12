import { isTauriApp, beginReceive, appendReceive, finishReceive, abortReceive } from './tauri';
import { log } from './logger';

/**
 * Destino de un archivo recibido por P2P. Se escribe chunk a chunk:
 * - Tauri: archivo en Descargas/SrvFiles (comandos nativos).
 * - Navegadores con File System Access API: el archivo que elige el usuario.
 * - Resto: en memoria y al final se descarga (única opción disponible).
 */
export interface ReceiveSink {
  write(chunk: Uint8Array): Promise<void>;
  /** Cierra y devuelve una descripción de dónde quedó, o null si se descargó por el navegador. */
  finish(): Promise<string | null>;
  abort(): Promise<void>;
}

interface SaveFilePickerWindow {
  showSaveFilePicker?: (opts: { suggestedName?: string }) => Promise<{
    createWritable: () => Promise<{ write: (d: BufferSource) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> }>;
  }>;
}

/**
 * Crea el destino. En navegadores con File System Access API abre el diálogo
 * de "Guardar como", por eso debe llamarse directamente desde el clic en
 * "Aceptar" (requiere gesto del usuario). Si el usuario cancela, lanza.
 */
export async function createReceiveSink(transferId: string, fileName: string, mimeType: string): Promise<ReceiveSink> {
  if (isTauriApp()) {
    await beginReceive(transferId, fileName);
    // Encadenar escrituras: el orden de los chunks importa.
    let queue: Promise<void> = Promise.resolve();
    return {
      write: (chunk) => (queue = queue.then(() => appendReceive(transferId, chunk))),
      finish: async () => {
        await queue;
        return finishReceive(transferId);
      },
      abort: async () => {
        await queue.catch(() => undefined);
        await abortReceive(transferId);
      },
    };
  }

  const picker = (window as unknown as SaveFilePickerWindow).showSaveFilePicker;
  if (picker) {
    const handle = await picker({ suggestedName: fileName });
    const writable = await handle.createWritable();
    let queue: Promise<void> = Promise.resolve();
    return {
      write: (chunk) => (queue = queue.then(() => writable.write(chunk as BufferSource))),
      finish: async () => {
        await queue;
        await writable.close();
        return fileName;
      },
      abort: async () => {
        await queue.catch(() => undefined);
        await writable.abort().catch(() => undefined);
      },
    };
  }

  const chunks: BlobPart[] = [];
  return {
    write: async (chunk) => { chunks.push(chunk as BlobPart); },
    finish: async () => {
      triggerBrowserDownload(new Blob(chunks, { type: mimeType || 'application/octet-stream' }), fileName);
      return null;
    },
    abort: async () => { chunks.length = 0; },
  };
}

/** Descarga un Blob con el diálogo del navegador. */
export function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  void log.debug('[receive] browser download triggered', { fileName });
}
