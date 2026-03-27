import type { Request, Response } from 'express';
import { scanNetwork } from '../services/discovery.service';
import { log } from '../lib/logger';

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
  try {
    const servers = await scanNetwork();
    res.json(servers);
  } catch (err) {
    log.error('discovery.controller.ts', 'Network scan failed', { error: String(err) });
    res.status(500).json({ error: 'Network scan failed' });
  }
}
