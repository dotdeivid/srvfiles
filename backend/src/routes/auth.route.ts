import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  validatePin,
  createSession,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
} from '../middleware/auth';
import { log } from '../lib/logger';

const router = Router();

/**
 * POST /api/auth
 * Body: { pin: string }
 * Returns: { token: string } on success, 401 on wrong PIN, 429 on rate limit.
 */
router.post('/', (req: Request, res: Response) => {
  const rawIp = (req.socket.remoteAddress ?? '').replace('::ffff:', '');
  // Normalize IPv6 loopback to IPv4 so ::1 and 127.0.0.1 share the same counter
  const ip = rawIp === '::1' ? '127.0.0.1' : rawIp;

  if (checkRateLimit(ip).blocked) {
    log.warn('auth.route.ts', 'Rate limited auth attempt', { ip });
    res.status(429).json({ error: 'Demasiados intentos. Intentá de nuevo en 60 segundos.' });
    return;
  }

  const { pin } = req.body as { pin?: string };
  if (!pin || typeof pin !== 'string') {
    log.warn('auth.route.ts', 'Auth attempt with missing PIN', { ip });
    res.status(400).json({ error: 'PIN requerido' });
    return;
  }

  if (validatePin(pin)) {
    clearFailedAttempts(ip);
    log.info('auth.route.ts', 'Auth successful, session created', { ip });
    res.json({ token: createSession() });
  } else {
    recordFailedAttempt(ip);
    res.status(401).json({ error: 'PIN incorrecto' });
  }
});

export default router;
