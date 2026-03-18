import path from 'path';
import fs from 'fs';
import multer, { StorageEngine } from 'multer';
import { MAX_FILE_SIZE_MB } from '../config';
import { sanitizeFilename } from '../utils/sanitize';

// ─── Uploads directory ──────────────────────────────────────────────
// When running as Tauri sidecar, UPLOADS_DIR is passed via env var (set in lib.rs).
// In dev mode, fall back to project-relative uploads/.
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── Filename conflict resolution ───────────────────────────────────

/**
 * Resolves filename conflicts by appending a timestamp suffix.
 * Example: "photo.jpg" → "photo_1710640000000.jpg"
 */
function resolveConflict(filepath: string, filename: string): string {
  if (!fs.existsSync(filepath)) return filename;

  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return `${base}_${Date.now()}${ext}`;
}

// ─── Multer storage config ──────────────────────────────────────────
const storage: StorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    try {
      let sanitized = sanitizeFilename(file.originalname);
      const targetPath = path.join(UPLOADS_DIR, sanitized);
      sanitized = resolveConflict(targetPath, sanitized);
      cb(null, sanitized);
    } catch (err) {
      cb(err as Error, '');
    }
  },
});

// ─── Multer instance ────────────────────────────────────────────────
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});

export default upload;
