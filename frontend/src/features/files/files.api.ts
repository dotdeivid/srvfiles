import { apiFetch, uploadWithProgress } from '../../lib/http';
import { DEFAULT_BACKEND_PORT } from '../../shared/utils/serverUrl';

// ─── Base API URL detection ────────────────────────────────────────

/**
 * Resolves the base URL of the backend API in a browser.
 *
 * 1. `VITE_API_URL` (explicit override).
 * 2. Dev server (Vite): same host, backend on `VITE_BACKEND_PORT` (default 3001).
 * 3. Production: the frontend is served by the backend itself, so the API is
 *    the current origin (HTTP or HTTPS, whatever port it runs on).
 *
 * In Tauri the port comes from the app (see useMode / getBackendPort).
 */
export function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  if (import.meta.env.DEV) {
    const port = import.meta.env.VITE_BACKEND_PORT || String(DEFAULT_BACKEND_PORT);
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  return window.location.origin;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface FileInfo {
  name: string;
  size: number;
  createdAt: string;
  downloadUrl: string;
}

export interface DiskStats {
  total: number;
  used: number;
  free: number;
}

export interface UploadedFile {
  name: string;
  originalName: string;
  size: number;
  downloadUrl: string;
}

export interface FailedFile {
  name: string;
  reason: string;
}

export interface UploadResult {
  message?: string;
  files?: UploadedFile[];
  failed?: FailedFile[];
}

export interface AppConfig {
  appName: string;
  lanIp: string;
  port: number;
  httpsPort: number;
  frontendPort: number;
  maxFileSizeMb: number;
  maxUploadCount?: number;
  previewMaxFileSizeMb: number;
  lanUrl: string;
}

// ─── Factory ──────────────────────────────────────────────────────

/** API functions bound to a backend base URL (local or remote on the LAN). */
export function createFilesApi(baseUrl: string) {
  return {
    baseUrl,

    getFiles: (signal?: AbortSignal) =>
      apiFetch<{ files: FileInfo[]; count: number }>(baseUrl, '/api/files', { signal, action: 'obtener la lista de archivos' }),

    /** Sube archivos (multipart) con progreso 0–1 y cancelación. */
    uploadFiles: (files: File[], onProgress?: (fraction: number) => void, signal?: AbortSignal) => {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      return uploadWithProgress<UploadResult>(baseUrl, '/api/files/upload', form, onProgress, signal);
    },

    deleteFile: (filename: string) =>
      apiFetch<{ message: string }>(baseUrl, `/api/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        action: 'eliminar el archivo',
      }),

    getStats: (signal?: AbortSignal) =>
      apiFetch<DiskStats>(baseUrl, '/api/files/stats', { signal, action: 'leer el espacio en disco' }),

    getConfig: (signal?: AbortSignal) =>
      apiFetch<AppConfig>(baseUrl, '/api/config', { signal, action: 'leer la configuración' }),

    /**
     * URL para enlaces del navegador (<a>, <img>, <video>), que no pueden
     * mandar cabeceras. Pide al servidor un token de enlace válido solo para
     * ese archivo y por unos minutos; el token de sesión nunca va en la URL.
     */
    getLinkedUrl: async (filename: string, kind: 'download' | 'preview'): Promise<string> => {
      const { token } = await apiFetch<{ token: string }>(baseUrl, '/api/files/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: filename }),
        action: 'preparar el enlace del archivo',
      });
      return `${baseUrl}/api/files/${kind}/${encodeURIComponent(filename)}?dl=${encodeURIComponent(token)}`;
    },

    /** URL de descarga sin token (para la descarga nativa, que manda la cabecera). */
    getPlainDownloadUrl: (filename: string): string =>
      `${baseUrl}/api/files/download/${encodeURIComponent(filename)}`,
  };
}

export type FilesApi = ReturnType<typeof createFilesApi>;
