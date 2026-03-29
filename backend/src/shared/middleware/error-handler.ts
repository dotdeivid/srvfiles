import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../domain/errors';
import { log } from '../../lib/logger';

/**
 * Global Express error handler.
 * If the error is an AppError, responds with its statusCode and code.
 * Otherwise logs and returns a generic 500.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  log.error('error-handler', 'Unhandled error', { error: String(err) });
  res.status(500).json({ error: 'Internal server error' });
}
