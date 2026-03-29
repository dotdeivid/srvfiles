import { log } from './logger';

/** Subfolder created inside the system Downloads directory. */
const SUBFOLDER = import.meta.env.VITE_SUBFOLDER ?? 'SrvFiles';

/**
 * Detects whether the app is running inside a Tauri webview by checking
 * for the presence of the `__TAURI_INTERNALS__` global injected by Tauri.
 *
 * @returns `true` if running inside Tauri, `false` in a regular browser.
 */
export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Saves a received file to disk.
 *
 * - **Tauri**: creates `~/Downloads/SrvFiles/` if it does not exist and writes
 *   the file there using `@tauri-apps/plugin-fs`. Falls back to the browser
 *   download dialog if the Tauri write fails.
 * - **Browser**: creates a temporary object URL and triggers a native download dialog.
 *
 * @param fileName - The filename to use when saving (e.g. `"report.pdf"`).
 * @param blob - The assembled file data as a `Blob`.
 * @returns A promise resolving to the absolute save path (Tauri only),
 *          or `null` when the browser download dialog is used instead.
 */
export async function saveReceivedFile(fileName: string, blob: Blob): Promise<string | null> {
  if (isTauriApp()) {
    try {
      const { downloadDir } = await import('@tauri-apps/api/path');
      const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs');

      const dir = `${await downloadDir()}/${SUBFOLDER}`;
      await mkdir(dir, { recursive: true });
      await writeFile(`${dir}/${fileName}`, new Uint8Array(await blob.arrayBuffer()));
      void log.info('[saveReceivedFile] file saved to Tauri downloads', { path: `${dir}/${fileName}` });
      return `${dir}/${fileName}`;
    } catch (e) {
      void log.error('[saveReceivedFile] Tauri write failed, falling back to browser download', { fileName, error: String(e) });
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
