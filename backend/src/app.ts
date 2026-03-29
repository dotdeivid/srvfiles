import express from 'express';
import cors from 'cors';
import path from 'path';
import filesRouter from './features/files/files.route';
import healthRouter from './features/health/health.route';
import configRouter from './features/config/config.route';
import discoveryRouter from './features/discovery/discovery.route';
import authRouter from './features/auth/auth.route';
import { requireAuth } from './features/auth/auth.middleware';
import { getPin } from './features/auth/auth.service';
import { errorHandler } from './shared/middleware/error-handler';

// ─── Express app factory ────────────────────────────────────────────

/**
 * Creates and configures the Express application.
 * Separated from index.ts to enable testing without starting the HTTP server.
 */
export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: '*' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ─── API Routes ─────────────────────────────────────────────────
  // /api/health and /api/auth are public — no PIN required
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);

  // /api/pin — returns the plain-text PIN, but ONLY to localhost connections.
  app.get('/api/pin', (req, res) => {
    const ip = (req.socket.remoteAddress ?? '').replace('::ffff:', '');
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '';
    if (!isLocal) { res.status(403).json({ error: 'Forbidden' }); return; }
    const pin = getPin();
    if (!pin) { res.status(503).json({ error: 'Server not ready' }); return; }
    res.json({ pin });
  });

  // All other /api/* routes require a valid session token
  app.use('/api/files', requireAuth, filesRouter);
  app.use('/api/config', requireAuth, configRouter);
  app.use('/api/discovery', requireAuth, discoveryRouter);

  // ─── Serve frontend static files (production) ───────────────────
  const FRONTEND_DIST = (process as any).pkg
    ? path.join(__dirname, '..', '..', 'frontend', 'dist')
    : path.resolve(process.cwd(), '..', 'frontend', 'dist');

  app.use(express.static(FRONTEND_DIST));

  // SPA fallback: any non-API route returns index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'), (err) => {
        if (err) {
          res.status(404).json({ error: 'Frontend not built. Run: cd frontend && npm run build' });
        }
      });
    }
  });

  // ─── Global error handler (must be last) ────────────────────────
  app.use(errorHandler);

  return app;
}
