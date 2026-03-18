import axios from 'axios';

// ─── Base API URL detection ────────────────────────────────────────
// Exported so other modules (discovery.api, etc.) can use the local URL.
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
// Creates a set of API functions bound to a specific base URL.
// Used by useFiles(serverUrl) to talk to a specific server.
export function createFilesApi(baseUrl: string) {
  const instance = axios.create({ baseURL: `${baseUrl}/api/files` });

  return {
    getFiles: (): Promise<{ files: FileInfo[]; count: number }> =>
      instance.get('/').then((r) => r.data),

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

    deleteFile: (filename: string): Promise<{ message: string }> =>
      instance.delete(`/${encodeURIComponent(filename)}`).then((r) => r.data),

    getStats: (): Promise<DiskStats> =>
      instance.get('/stats').then((r) => r.data),

    getConfig: (): Promise<AppConfig> =>
      axios.get(`${baseUrl}/api/config`).then((r) => r.data),

    getDownloadUrl: (filename: string): string =>
      `${baseUrl}/api/files/download/${encodeURIComponent(filename)}`,
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
