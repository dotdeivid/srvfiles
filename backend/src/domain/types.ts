import type { WebSocket } from 'ws';
import type { SessionCipher } from '../features/transfer/session';

// ─── Files ──────────────────────────────────────────────────────────

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

// ─── Config ─────────────────────────────────────────────────────────

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

// ─── Transfer ───────────────────────────────────────────────────────

export interface ConnectedClient {
  ws: WebSocket;
  clientId: string;
  appName: string;
  receiving: boolean;
  ip: string;
  deviceType: 'mobile' | 'desktop';
  isServer: boolean;
  cipher: SessionCipher | null;
}

export interface TransferSession {
  transferId: string;
  senderClientId: string;
  receiverClientId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

// ─── Discovery ──────────────────────────────────────────────────────

export interface DiscoveredServer {
  ip: string;
  url: string;
  appName: string;
}
