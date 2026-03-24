import type { Request, Response } from 'express';
import { scanNetwork } from '../services/discovery.service';

/**
 * Handles `GET /api/discovery/scan`.
 * Triggers a full /24 subnet scan and returns all SrvFiles instances found on the LAN,
 * excluding the server itself.
 *
 * @param _req - Express request (unused).
 * @param res - Express response. Sends `200` with an array of `{ ip, url, appName }` objects.
 *              Returns an empty array if no other instances are found or the machine has no
 *              external network interface.
 */
export async function scan(_req: Request, res: Response): Promise<void> {
  const servers = await scanNetwork();
  res.json(servers);
}
