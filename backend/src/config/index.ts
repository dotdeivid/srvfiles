import path from 'path';

// ─── Server ─────────────────────────────────────────────────────────
export const PORT = parseInt(process.env.PORT || '3001', 10);
export const HOST = '0.0.0.0';

// HTTPS — same Express app, second listener for external browsers.
export const HTTPS_PORT = PORT + 1;
export const CERTS_DIR = process.env.CERTS_DIR
  ?? path.resolve(process.cwd(), 'certs');

// ─── App ────────────────────────────────────────────────────────────
export const APP_NAME = process.env.APP_NAME || 'SrvFiles';
export const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '5173', 10);

// ─── Files ──────────────────────────────────────────────────────────
export const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10240', 10);
export const MAX_UPLOAD_COUNT = parseInt(process.env.MAX_UPLOAD_COUNT || '50', 10);
export const PREVIEW_MAX_FILE_SIZE_MB = parseInt(process.env.PREVIEW_MAX_FILE_SIZE_MB || '1024', 10);
