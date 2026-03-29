import type { Request, Response } from 'express';
import { APP_NAME } from '../../config';

/**
 * Handles GET /api/health.
 */
export function getHealth(_req: Request, res: Response): void {
  res.json({ status: 'ok', app: 'SrvFiles', appName: APP_NAME, timestamp: new Date().toISOString() });
}
