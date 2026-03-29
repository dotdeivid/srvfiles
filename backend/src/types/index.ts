// ─── Shared types used across the backend ───────────────────────────

/** Metadata for a single uploaded file */
export interface FileInfo {
  name: string;
  size: number;
  createdAt: string;
  downloadUrl: string;
}

/** Response for a successfully uploaded file */
export interface UploadedFileInfo {
  name: string;
  originalName: string;
  size: number;
  downloadUrl: string;
}

/** Disk usage statistics */
export interface DiskStats {
  total: number;
  used: number;
  free: number;
}

/** App configuration exposed to the frontend */
export interface AppConfig {
  appName: string;
  lanIp: string;
  port: number;
  httpsPort: number;
  frontendPort: number;
  maxFileSizeMb: number;
  previewMaxFileSizeMb: number;
  lanUrl: string;
}
