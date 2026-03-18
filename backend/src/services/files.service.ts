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

/**
 * Reads all files from the uploads directory and returns their metadata,
 * sorted from newest to oldest by creation date. Excludes `.gitkeep`.
 *
 * @returns Array of {@link FileInfo} objects, newest first.
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
 * into the public {@link UploadedFileInfo} shape expected by the API response.
 *
 * @param files - Raw Multer file objects from `req.files`.
 * @returns Array of {@link UploadedFileInfo} with public download URLs.
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
 * Throws if the filename fails sanitization (e.g. contains path traversal characters).
 *
 * @param filename - The raw filename from the request (URL param or body).
 * @returns An object with `filePath` (absolute path) and `exists` (whether the file is present on disk).
 * @throws {Error} If `filename` contains forbidden characters (delegated to `sanitizeFilename`).
 */
export function resolveFilePath(filename: string): { filePath: string; exists: boolean } {
  sanitizeFilename(filename); // throws on invalid
  const filePath = path.join(UPLOADS_DIR, filename);
  return { filePath, exists: fs.existsSync(filePath) };
}

/**
 * Deletes a file from the uploads directory by name.
 *
 * @param filename - The name of the file to delete.
 * @returns `true` if the file was deleted, `false` if it did not exist.
 * @throws {Error} If `filename` contains forbidden characters.
 */
export function deleteFile(filename: string): boolean {
  const { filePath, exists } = resolveFilePath(filename);
  if (!exists) return false;

  fs.unlinkSync(filePath);
  return true;
}

/**
 * Queries disk space for the uploads volume using `check-disk-space`.
 *
 * @returns A promise resolving to {@link DiskStats} with `total`, `used`, and `free` in bytes.
 */
export async function getDiskStats(): Promise<DiskStats> {
  const diskSpace = await checkDiskSpace(UPLOADS_DIR);
  return {
    total: diskSpace.size,
    free: diskSpace.free,
    used: diskSpace.size - diskSpace.free,
  };
}
