import path from 'path';
import fs from 'fs';
import multer, { StorageEngine } from 'multer';
import { MAX_FILE_SIZE_MB } from '../../config';
import { UPLOADS_DIR } from '../../infrastructure/storage';
import { sanitizeFilename } from '../../shared/utils/sanitize';

// ─── Filename conflict resolution ───────────────────────────────────

/**
 * Returns a non-colliding filename for the given destination path.
 * If a file already exists at `filepath`, appends a Unix timestamp before the extension.
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
