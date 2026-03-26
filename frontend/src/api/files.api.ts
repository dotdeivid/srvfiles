import axios from 'axios';
import { getToken, clearToken } from '../lib/auth';

// ─── Base API URL detection ────────────────────────────────────────

/**
 * Resolves the base URL of the backend API at runtime.
 *
 * Priority order:
 * 1. `VITE_API_URL` environment variable (explicit override).
 * 2. `http://localhost:3001` when the hostname is `tauri.localhost`
 *    (Tauri 2 webview on macOS/Linux uses this pseudo-hostname).
 * 3. Current `window.location` protocol + hostname + `VITE_BACKEND_PORT` (default `3001`).
 *
 * @returns The backend base URL without a trailing slash.
 */
export function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  // Tauri 2 on macOS/Linux serves the WebView from tauri.localhost (no real port).
  if (typeof window !== 'undefined' && window.location.hostname === 'tauri.localhost') {
    return 'http://localhost:3001';
  }

  // Auto-detect: use current hostname with backend port (web mode + LAN access).
  const backendPort = import.meta.env.VITE_BACKEND_PORT || '3001';
  return `${window.location.protocol}//${window.location.hostname}:${backendPort}`;
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

export interface AppConfig {
  appName: string;
  lanIp: string;
  port: number;
  frontendPort: number;
  maxFileSizeMb: number;
  lanUrl: string;
}

// ─── Factory ──────────────────────────────────────────────────────

/**
 * Creates a set of API functions bound to a specific backend base URL.
 * Used by `useFiles(serverUrl)` to communicate with a chosen server instance
 * (local or remote on the LAN).
 *
 * @param baseUrl - The backend base URL (e.g. `"http://192.168.1.10:3001"`).
 * @returns An object containing all API methods scoped to `baseUrl`.
 */
/** Thrown by the axios interceptor when the server returns 401. */
export class AuthError extends Error {
  constructor() { super('Unauthorized'); this.name = 'AuthError'; }
}

export function createFilesApi(baseUrl: string) {
  const instance = axios.create({ baseURL: `${baseUrl}/api/files` });

  // Attach session token to every request
  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers['X-SrvFiles-Token'] = token;
    return config;
  });

  // On 401: clear stale token and throw AuthError so callers can show PinDialog
  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        clearToken();
        return Promise.reject(new AuthError());
      }
      return Promise.reject(err);
    }
  );

  return {
    /**
     * Fetches the list of all uploaded files.
     *
     * @returns A promise resolving to `{ files, count }`.
     */
    getFiles: (): Promise<{ files: FileInfo[]; count: number }> =>
      instance.get('/').then((r) => r.data),

    /**
     * Uploads one or more files using `multipart/form-data`.
     * Optionally reports upload progress as a percentage (0–100).
     *
     * @param files - Array of `File` objects to upload.
     * @param onProgress - Optional callback invoked with the current progress percentage.
     * @returns A promise resolving to `{ message, files }` with the uploaded file metadata.
     */
    uploadFiles: (
      files: File[],
      onProgress?: (progress: number) => void
    ): Promise<{ message: string; files: UploadedFile[] }> => {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      return instance
        .post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (event) => {
            if (event.total && onProgress) {
              onProgress(Math.round((event.loaded * 100) / event.total));
            }
          },
        })
        .then((r) => r.data);
    },

    /**
     * Permanently deletes a file by name.
     *
     * @param filename - The exact filename to delete (will be URL-encoded internally).
     * @returns A promise resolving to `{ message }` on success.
     */
    deleteFile: (filename: string): Promise<{ message: string }> =>
      instance.delete(`/${encodeURIComponent(filename)}`).then((r) => r.data),

    /**
     * Fetches disk space statistics for the server's upload volume.
     *
     * @returns A promise resolving to `{ total, used, free }` in bytes.
     */
    getStats: (): Promise<DiskStats> =>
      instance.get('/stats').then((r) => r.data),

    /**
     * Fetches the server's runtime configuration (app name, LAN IP, ports, etc.).
     *
     * @returns A promise resolving to {@link AppConfig}.
     */
    getConfig: (): Promise<AppConfig> => {
      const token = getToken();
      return axios.get(`${baseUrl}/api/config`, {
        headers: token ? { 'X-SrvFiles-Token': token } : {},
      }).then((r) => r.data);
    },

    /**
     * Constructs the direct download URL for a given filename.
     * This is a synchronous helper — no network request is made.
     *
     * @param filename - The exact filename as returned by the server.
     * @returns The absolute download URL string.
     */
    getDownloadUrl: (filename: string): string => {
      const token = getToken();
      const url = `${baseUrl}/api/files/download/${encodeURIComponent(filename)}`;
      return token ? `${url}?token=${encodeURIComponent(token)}` : url;
    },
  };
}

// ─── Default instance (uses auto-detected local URL) ──────────────
// Kept for backward compatibility with any direct imports.
const _default = createFilesApi(getApiUrl());
export const getFiles = _default.getFiles;
export const uploadFiles = _default.uploadFiles;
export const deleteFile = _default.deleteFile;
export const getStats = _default.getStats;
export const getConfig = _default.getConfig;
export const getDownloadUrl = _default.getDownloadUrl;
