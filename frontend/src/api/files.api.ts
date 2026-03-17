import axios from 'axios';

// ─── Base API configuration ────────────────────────────────────────
// Use the same hostname + backend port to support LAN access.
// When accessed from mobile via IP, the API calls will also use that IP.
function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  // Auto-detect: use current hostname with backend port
  const backendPort = import.meta.env.VITE_BACKEND_PORT || '3001';
  return `${window.location.protocol}//${window.location.hostname}:${backendPort}`;
}

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: `${API_URL}/api/files`,
});

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

// ─── API Functions ──────────────────────────────────────────────────

/**
 * Fetches the list of all uploaded files.
 */
export async function getFiles(): Promise<{ files: FileInfo[]; count: number }> {
  const { data } = await api.get('/');
  return data;
}

/**
 * Uploads one or multiple files with progress tracking.
 */
export async function uploadFiles(
  files: File[],
  onProgress?: (progress: number) => void
): Promise<{ message: string; files: UploadedFile[] }> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        const percent = Math.round((event.loaded * 100) / event.total);
        onProgress(percent);
      }
    },
  });
  return data;
}

/**
 * Deletes a file by filename.
 */
export async function deleteFile(filename: string): Promise<{ message: string }> {
  const { data } = await api.delete(`/${encodeURIComponent(filename)}`);
  return data;
}

/**
 * Fetches disk space statistics.
 */
export async function getStats(): Promise<DiskStats> {
  const { data } = await api.get('/stats');
  return data;
}

/**
 * Fetches app configuration from backend (LAN IP, app name, etc.)
 */
export async function getConfig(): Promise<AppConfig> {
  const { data } = await axios.get(`${API_URL}/api/config`);
  return data;
}

/**
 * Constructs the full download URL for a file.
 */
export function getDownloadUrl(filename: string): string {
  return `${API_URL}/api/files/download/${encodeURIComponent(filename)}`;
}
