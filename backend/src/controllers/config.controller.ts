import type { Request, Response } from 'express';
import { APP_NAME, PORT, HTTPS_PORT, FRONTEND_PORT, MAX_FILE_SIZE_MB, PREVIEW_MAX_FILE_SIZE_MB, getLanIp } from '../config';
import type { AppConfig } from '../types';

/**
 * Handles `GET /api/config`.
 * Returns the current server configuration so the frontend can display the LAN IP,
 * build QR codes, and set upload limits without hard-coding any values.
 *
 * @param _req - Express request (unused).
 * @param res - Express response. Sends `200` with an {@link AppConfig} object containing
 *              `appName`, `lanIp`, `port`, `frontendPort`, `maxFileSizeMb`, and `lanUrl`.
 */
export function getConfig(_req: Request, res: Response): void {
  const lanIp = getLanIp();
  const config: AppConfig = {
    appName: APP_NAME,
    lanIp,
    port: PORT,
    httpsPort: HTTPS_PORT,
    frontendPort: FRONTEND_PORT,
    maxFileSizeMb: MAX_FILE_SIZE_MB,
    previewMaxFileSizeMb: PREVIEW_MAX_FILE_SIZE_MB,
    lanUrl: `http://${lanIp}`,
  };
  res.json(config);
}
