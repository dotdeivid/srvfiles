import type { Request, Response } from 'express';
import * as filesService from '../services/files.service';
import { broadcastFilesChanged } from '../services/transfer.service';

/**
 * Controller layer for file endpoints.
 * Handles HTTP request/response — delegates business logic to the service layer.
 */

/**
 * Handles `POST /api/files/upload`.
 * Expects Multer to have already processed `req.files` before this handler runs.
 * Responds with the list of uploaded files and their public download URLs.
 *
 * @param req - Express request. `req.files` must be an array of Multer file objects.
 * @param res - Express response. Sends `200` with file metadata, `400` if no files
 *              were provided, or `500` on an unexpected error.
 */
export function uploadFiles(req: Request, res: Response): void {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }

    const uploaded = filesService.processUploadedFiles(files);

    res.status(200).json({
      message: `${files.length} file(s) uploaded successfully`,
      files: uploaded,
    });
    broadcastFilesChanged();
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload files' });
  }
}

/**
 * Handles `GET /api/files`.
 * Returns all files currently stored on the server, sorted newest first.
 *
 * @param _req - Express request (unused).
 * @param res - Express response. Sends `200` with `{ files, count }`, or `500` on error.
 */
export function listFiles(_req: Request, res: Response): void {
  try {
    const files = filesService.listFiles();
    res.status(200).json({ files, count: files.length });
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
}

/**
 * Handles `GET /api/files/download/:filename`.
 * Streams the requested file to the client as an attachment.
 *
 * @param req - Express request. `req.params.filename` is the URL-decoded filename.
 * @param res - Express response. Sends the file stream on success, `400` for an invalid
 *              filename, `404` if not found, or `500` on a streaming error.
 */
export function downloadFile(req: Request, res: Response): void {
  try {
    const filename = req.params.filename as string;

    let resolved;
    try {
      resolved = filesService.resolveFilePath(filename);
    } catch {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    if (!resolved.exists) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.download(resolved.filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download file' });
        }
      }
    });
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to download file' });
  }
}

/**
 * Handles `DELETE /api/files/:filename`.
 * Permanently removes a file from the uploads directory.
 *
 * @param req - Express request. `req.params.filename` is the URL-decoded filename.
 * @param res - Express response. Sends `200` on success, `400` for an invalid filename,
 *              `404` if the file does not exist, or `500` on an unexpected error.
 */
export function deleteFile(req: Request, res: Response): void {
  try {
    const filename = req.params.filename as string;

    let deleted: boolean;
    try {
      deleted = filesService.deleteFile(filename);
    } catch {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    if (!deleted) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.status(200).json({ message: `File "${filename}" deleted successfully` });
    broadcastFilesChanged();
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
}

/**
 * Handles `GET /api/files/stats`.
 * Returns disk usage statistics for the volume where uploads are stored.
 *
 * @param _req - Express request (unused).
 * @param res - Express response. Sends `200` with `{ total, used, free }` in bytes,
 *              or `500` on error.
 */
export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await filesService.getDiskStats();
    res.status(200).json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to get disk stats' });
  }
}
