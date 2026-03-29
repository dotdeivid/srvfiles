import type { Request, Response } from 'express';
import { APP_NAME, PORT, HTTPS_PORT, FRONTEND_PORT, MAX_FILE_SIZE_MB, PREVIEW_MAX_FILE_SIZE_MB } from '../../config';
import { getLanIp } from '../../infrastructure/network';
import type { AppConfig } from '../../domain/types';

/**
 * Handles GET /api/config.
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
