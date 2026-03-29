import type { Request, Response, NextFunction } from 'express';
import { validateToken } from './auth.service';
import { log } from '../../lib/logger';

/**
 * Express middleware that requires a valid session token.
 * Checks X-SrvFiles-Token header or ?token query param.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = (req.headers['x-srvfiles-token'] as string | undefined)
    ?? (req.query.token as string | undefined);
  if (validateToken(token)) {
    next();
  } else {
    const ip = (req.socket.remoteAddress ?? '').replace('::ffff:', '');
    log.warn('auth.middleware.ts', 'Unauthorized request — invalid or missing token', { ip, path: req.path });
    res.status(401).json({ error: 'Unauthorized' });
  }
}
