import type { Request, Response } from 'express';
import * as filesService from './files.service';
import { broadcastFilesChanged } from '../transfer/client-registry';
import { log } from '../../lib/logger';

/**
 * Controller layer for file endpoints.
 * Handles HTTP request/response — delegates business logic to the service layer.
 */

/** Handles POST /api/files/upload. */
export function uploadFiles(req: Request, res: Response): void {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }

    const uploaded = filesService.processUploadedFiles(files);

    log.info('files.controller.ts', 'Files uploaded', { count: files.length, names: files.map((f) => f.originalname) });
    res.status(200).json({
      message: `${files.length} file(s) uploaded successfully`,
      files: uploaded,
    });
    broadcastFilesChanged();
  } catch (err) {
    log.error('files.controller.ts', 'Error al subir archivos', { error: String(err) });
    res.status(500).json({ error: 'Failed to upload files' });
  }
}

/** Handles GET /api/files. */
export function listFiles(_req: Request, res: Response): void {
  try {
    const files = filesService.listFiles();
    res.status(200).json({ files, count: files.length });
  } catch (err) {
    log.error('files.controller.ts', 'Error al listar archivos', { error: String(err) });
    res.status(500).json({ error: 'Failed to list files' });
  }
}

/** Handles GET /api/files/download/:filename. */
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
      if (!err) return;
      const code = (err as NodeJS.ErrnoException).code ?? '';
      const msg = err.message ?? '';
      if (code === 'EPIPE' || code === 'ECONNRESET' || msg.includes('aborted') || msg.includes('abort')) {
        log.debug('files.controller.ts', 'Download interrupted by client', { filename });
        return;
      }
      log.error('files.controller.ts', 'Error al descargar archivo', { filename, error: String(err) });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  } catch (err) {
    log.error('files.controller.ts', 'Error al descargar archivo', { filename: req.params.filename, error: String(err) });
    res.status(500).json({ error: 'Failed to download file' });
  }
}

/** Handles GET /api/files/preview/:filename. */
export function previewFile(req: Request, res: Response): void {
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

    res.sendFile(resolved.filePath, (err) => {
      if (!err) return;
      const code = (err as NodeJS.ErrnoException).code ?? '';
      const msg = err.message ?? '';
      if (code === 'EPIPE' || code === 'ECONNRESET' || msg.includes('aborted') || msg.includes('abort')) {
        log.debug('files.controller.ts', 'Preview interrupted by client', { filename });
        return;
      }
      log.error('files.controller.ts', 'Error al previsualizar archivo', { filename, error: String(err) });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to preview file' });
      }
    });
  } catch (err) {
    log.error('files.controller.ts', 'Error al previsualizar archivo', { filename: req.params.filename, error: String(err) });
    res.status(500).json({ error: 'Failed to preview file' });
  }
}

/** Handles DELETE /api/files/:filename. */
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
    log.error('files.controller.ts', 'Error al eliminar archivo', { filename: req.params.filename, error: String(err) });
    res.status(500).json({ error: 'Failed to delete file' });
  }
}

/** Handles GET /api/files/stats. */
export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await filesService.getDiskStats();
    res.status(200).json(stats);
  } catch (err) {
    log.error('files.controller.ts', 'Error al obtener estadísticas de disco', { error: String(err) });
    res.status(500).json({ error: 'Failed to get disk stats' });
  }
}
