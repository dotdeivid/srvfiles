import path from 'path';
import fs from 'fs';

/**
 * Absolute path to the uploads directory.
 * When running as Tauri sidecar, UPLOADS_DIR is set via env var.
 * In dev mode, falls back to project-relative uploads/.
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');

// Ensure uploads directory exists at startup
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
