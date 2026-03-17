import type { Request, Response } from 'express';
import * as filesService from '../services/files.service';

/**
 * Controller layer for file endpoints.
 * Handles HTTP request/response — delegates business logic to the service.
 */

/** POST /api/files/upload */
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
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload files' });
  }
}

/** GET /api/files */
export function listFiles(_req: Request, res: Response): void {
  try {
    const files = filesService.listFiles();
    res.status(200).json({ files, count: files.length });
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
}

/** GET /api/files/download/:filename */
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

/** DELETE /api/files/:filename */
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
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
}

/** GET /api/files/stats */
export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await filesService.getDiskStats();
    res.status(200).json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to get disk stats' });
  }
}
