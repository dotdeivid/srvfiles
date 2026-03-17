import fs from 'fs';
import path from 'path';
import checkDiskSpace from 'check-disk-space';
import { UPLOADS_DIR } from '../middleware/upload';
import { sanitizeFilename } from '../utils/sanitize';
import type { FileInfo, UploadedFileInfo, DiskStats } from '../types';

/**
 * Service layer for file operations.
 * Contains all business logic — no HTTP concepts here.
 */

/** Lists all files in the uploads directory, sorted newest first. */
export function listFiles(): FileInfo[] {
  const fileNames = fs.readdirSync(UPLOADS_DIR);

  return fileNames
    .filter((name) => name !== '.gitkeep')
    .map((name) => {
      const filePath = path.join(UPLOADS_DIR, name);
      const stats = fs.statSync(filePath);
      return {
        name,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        downloadUrl: `/api/files/download/${encodeURIComponent(name)}`,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Maps Multer file objects to our UploadedFileInfo type. */
export function processUploadedFiles(files: Express.Multer.File[]): UploadedFileInfo[] {
  return files.map((file) => ({
    name: file.filename,
    originalName: file.originalname,
    size: file.size,
    downloadUrl: `/api/files/download/${encodeURIComponent(file.filename)}`,
  }));
}

/**
 * Resolves the full path for a filename after sanitization.
 * Throws if the filename is invalid.
 * Returns null if the file doesn't exist.
 */
export function resolveFilePath(filename: string): { filePath: string; exists: boolean } {
  sanitizeFilename(filename); // throws on invalid
  const filePath = path.join(UPLOADS_DIR, filename);
  return { filePath, exists: fs.existsSync(filePath) };
}

/** Deletes a file by name. Returns true if deleted. Throws on invalid filename. */
export function deleteFile(filename: string): boolean {
  const { filePath, exists } = resolveFilePath(filename);
  if (!exists) return false;

  fs.unlinkSync(filePath);
  return true;
}

/** Returns disk space statistics for the uploads volume. */
export async function getDiskStats(): Promise<DiskStats> {
  const diskSpace = await checkDiskSpace(UPLOADS_DIR);
  return {
    total: diskSpace.size,
    free: diskSpace.free,
    used: diskSpace.size - diskSpace.free,
  };
}
