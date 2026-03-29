import type { Request, Response } from 'express';
import { scanNetwork } from './discovery.service';
import { log } from '../../lib/logger';

/**
 * Handles GET /api/discovery/scan.
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
