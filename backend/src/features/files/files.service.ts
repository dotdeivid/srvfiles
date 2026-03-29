import fs from 'fs';
import path from 'path';
import checkDiskSpace from 'check-disk-space';
import { UPLOADS_DIR } from '../../infrastructure/storage';
import { sanitizeFilename } from '../../shared/utils/sanitize';
import type { FileInfo, UploadedFileInfo, DiskStats } from '../../domain/types';
import { log } from '../../lib/logger';

/**
 * Service layer for file operations.
 * Contains all business logic — no HTTP concepts here.
 */

/**
 * Reads all files from the uploads directory and returns their metadata,
 * sorted from newest to oldest by creation date. Excludes `.gitkeep`.
 */
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

/**
 * Converts the array of Multer file objects produced by the upload middleware
 * into the public UploadedFileInfo shape expected by the API response.
 */
export function processUploadedFiles(files: Express.Multer.File[]): UploadedFileInfo[] {
  return files.map((file) => ({
    name: file.filename,
    originalName: file.originalname,
    size: file.size,
    downloadUrl: `/api/files/download/${encodeURIComponent(file.filename)}`,
  }));
}

/**
 * Sanitizes the given filename and resolves its absolute path inside the uploads directory.
 * Throws if the filename fails sanitization.
 */
export function resolveFilePath(filename: string): { filePath: string; exists: boolean } {
  sanitizeFilename(filename); // throws on invalid
  const filePath = path.join(UPLOADS_DIR, filename);
  return { filePath, exists: fs.existsSync(filePath) };
}

/**
 * Deletes a file from the uploads directory by name.
 * Returns `true` if the file was deleted, `false` if it did not exist.
 */
export function deleteFile(filename: string): boolean {
  const { filePath, exists } = resolveFilePath(filename);
  if (!exists) {
    log.warn('files.service.ts', 'Delete requested for non-existent file', { filename });
    return false;
  }

  fs.unlinkSync(filePath);
  log.info('files.service.ts', 'File deleted', { filename });
  return true;
}

/**
 * Queries disk space for the uploads volume.
 */
export async function getDiskStats(): Promise<DiskStats> {
  try {
    const diskSpace = await checkDiskSpace(UPLOADS_DIR);
    return {
      total: diskSpace.size,
      free: diskSpace.free,
      used: diskSpace.size - diskSpace.free,
    };
  } catch (err) {
    log.error('files.service.ts', 'Failed to get disk stats', { error: String(err) });
    throw err;
  }
}
