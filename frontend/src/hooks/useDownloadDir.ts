/** Subfolder created inside the system Downloads directory. */
const SUBFOLDER = 'SrvFiles';

/** Detect Tauri 2 runtime context. */
export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Saves a received file:
 *  - Tauri: writes to ~/Downloads/SrvFiles/<filename> (creates the folder if needed)
 *  - Browser: triggers a standard browser download
 */
export async function saveReceivedFile(fileName: string, blob: Blob): Promise<string | null> {
  if (isTauriApp()) {
    try {
      const { downloadDir } = await import('@tauri-apps/api/path');
      const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs');

      const dir = `${await downloadDir()}/${SUBFOLDER}`;
      await mkdir(dir, { recursive: true });
      await writeFile(`${dir}/${fileName}`, new Uint8Array(await blob.arrayBuffer()));
      return `${dir}/${fileName}`;
    } catch (e) {
      console.error('[saveReceivedFile] Tauri write failed, falling back to browser download:', e);
      // fall through
    }
  }

  // Browser / fallback: standard download dialog
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return null;
}
