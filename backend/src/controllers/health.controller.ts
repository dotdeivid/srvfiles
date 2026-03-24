import type { Request, Response } from 'express';
import { APP_NAME } from '../config';

/**
 * Handles `GET /api/health`.
 * Returns a simple status payload used by discovery probes to identify SrvFiles instances.
 *
 * @param _req - Express request (unused).
 * @param res - Express response. Sends `200` with `{ status, app, appName, timestamp }`.
 */
export function getHealth(_req: Request, res: Response): void {
  res.json({ status: 'ok', app: 'SrvFiles', appName: APP_NAME, timestamp: new Date().toISOString() });
}
