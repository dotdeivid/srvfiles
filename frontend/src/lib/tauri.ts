/**
 * Puente con la app de escritorio (Tauri). Las operaciones con archivos se
 * hacen con comandos nativos (src-tauri/src/files.rs) en streaming: el
 * webview no tiene permisos de sistema de archivos y nada pasa entero por IPC.
 */

/**
 * Detects whether the app is running inside a Tauri webview by checking
 * for the presence of the `__TAURI_INTERNALS__` global injected by Tauri.
 */
export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown> | Uint8Array, headers?: Record<string, string>): Promise<T> {
  const core = await import('@tauri-apps/api/core');
  return core.invoke<T>(cmd, args, headers ? { headers } : undefined);
}

export interface NativeProgress {
  id: string;
  loaded: number;
  total: number;
}

/** Escucha un evento de progreso de un comando nativo. Devuelve la función para dejar de escuchar. */
export async function onNativeProgress(
  event: 'upload-progress' | 'download-progress',
  id: string,
  cb: (p: NativeProgress) => void,
): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event');
  return listen<NativeProgress>(event, (e) => {
    if (e.payload.id === id) cb(e.payload);
  });
}

/** Avisa cuando la app reinició el servidor interno tras una caída. */
export async function onBackendRestarted(cb: () => void): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event');
  return listen('backend-restarted', () => cb());
}

/** Puerto HTTP del backend local (normalmente 3001). */
export async function getBackendPort(): Promise<number> {
  try {
    return await invoke<number>('backend_port');
  } catch {
    return 3001;
  }
}

export interface DroppedFile {
  path: string;
  name: string;
  size: number;
}

/** Nombre y tamaño de rutas arrastradas a la ventana (omite carpetas). */
export function pathInfo(paths: string[]): Promise<DroppedFile[]> {
  return invoke<DroppedFile[]>('path_info', { paths });
}

/** Sube archivos del disco al servidor. Devuelve la respuesta JSON del servidor. */
export function nativeUpload<T>(url: string, token: string | null, paths: string[], id: string): Promise<T> {
  return invoke<T>('upload_files', { url, token, paths, id });
}

/** Descarga a Descargas/SrvFiles sin sobrescribir. Devuelve la ruta final. */
export function nativeDownload(url: string, token: string | null, fileName: string, id: string): Promise<string> {
  return invoke<string>('download_file', { url, token, fileName, id });
}

/** Muestra un archivo de la carpeta compartida (Descargas/SrvFiles) en el explorador. */
export function showInFolder(fileName: string): Promise<void> {
  return invoke<void>('show_in_folder', { fileName });
}

export function cancelNativeTransfer(id: string): Promise<void> {
  return invoke<void>('cancel_transfer', { id });
}

// ─── P2P receive ─────────────────────────────────────────────────────

export function beginReceive(id: string, fileName: string): Promise<string> {
  return invoke<string>('begin_receive', { id, fileName });
}

/** Agrega un chunk como cuerpo binario crudo (sin serializar a JSON). */
export function appendReceive(id: string, data: Uint8Array): Promise<void> {
  return invoke<void>('append_receive', data, { 'x-receive-id': id });
}

export function finishReceive(id: string): Promise<string> {
  return invoke<string>('finish_receive', { id });
}

export function abortReceive(id: string): Promise<void> {
  return invoke<void>('abort_receive', { id });
}
