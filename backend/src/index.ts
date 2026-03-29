import http from 'http';
import https from 'https';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { WebSocketServer } from 'ws';
import filesRouter from './routes/files.route';
import healthRouter from './routes/health.route';
import configRouter from './routes/config.route';
import discoveryRouter from './routes/discovery.route';
import authRouter from './routes/auth.route';
import { PORT, HOST, HTTPS_PORT, CERTS_DIR, getLanIp, APP_NAME, MAX_FILE_SIZE_MB } from './config';
import { handleConnection } from './services/transfer.service';
import { generatePin, getPin, requireAuth, resetAuth } from './middleware/auth';
import { getOrCreateCert } from './lib/cert';
import { log } from './lib/logger';

// ─── Express app setup ──────────────────────────────────────────────
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ─────────────────────────────────────────────────────
// /api/health and /api/auth are public — no PIN required
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);

// /api/pin — returns the plain-text PIN, but ONLY to localhost connections.
// Used by the web UI (served from the same origin) to auto-authenticate on startup.
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

// ─── Serve frontend static files (production) ──────────────────────
// When running as pkg binary (Tauri sidecar), frontend/dist is embedded in the
// virtual FS relative to __dirname (backend/dist → root → frontend/dist).
// In dev mode, resolve from cwd (which is backend/).
const FRONTEND_DIST = (process as any).pkg
  ? path.join(__dirname, '..', '..', 'frontend', 'dist')
  : path.resolve(process.cwd(), '..', 'frontend', 'dist');

app.use(express.static(FRONTEND_DIST));

// SPA fallback: any non-API route returns index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'), (err) => {
      if (err) {
        // In dev mode, frontend/dist won't exist — that's fine
        res.status(404).json({ error: 'Frontend not built. Run: cd frontend && npm run build' });
      }
    });
  }
});

// ─── HTTP server (loopback + LAN — used by Tauri webview and Flutter) ──
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', handleConnection);

server.listen(PORT, HOST, () => {
  log.debug('index.ts', 'HTTP server listening', { port: PORT });
});

server.on('error', (err) => {
  log.error('index.ts', 'Error al iniciar el servidor HTTP', { error: String(err) });
});

// ─── HTTPS server (LAN — used by external browsers) ──────────────────
void (async () => {
  const cert = await getOrCreateCert(CERTS_DIR);
  const httpsServer = https.createServer({ key: cert.key, cert: cert.cert }, app);

  // Attach a second WSS so encrypted WebSocket sessions also work over HTTPS.
  const wssHttps = new WebSocketServer({ server: httpsServer, path: '/ws' });
  wssHttps.on('connection', handleConnection);

  httpsServer.on('error', (err) => {
    log.error('index.ts', 'Error al iniciar el servidor HTTPS', { error: String(err) });
  });

  httpsServer.listen(HTTPS_PORT, HOST, () => {
    const lanIp = getLanIp();
    const pin = generatePin();

    console.log(`\n🗂️  ${APP_NAME} running!`);
    console.log(`   Local (Tauri):  http://localhost:${PORT}`);
    console.log(`   Network (web):  https://${lanIp}:${HTTPS_PORT}`);
    console.log(`   Max file size:  ${MAX_FILE_SIZE_MB} MB`);
    // Special format for Tauri IPC to parse the PIN
    console.log(`   PIN: ${pin}`);
    console.log('');

    log.info('index.ts', `${APP_NAME} server started`, {
      httpPort: PORT,
      httpsPort: HTTPS_PORT,
      lanIp,
      maxFileSizeMb: MAX_FILE_SIZE_MB,
    });
  });
})();

// ─── Cleanup on shutdown ─────────────────────────────────────────────
process.on('SIGTERM', () => { resetAuth(); process.exit(0); });
process.on('SIGINT',  () => { resetAuth(); process.exit(0); });
process.on('uncaughtException', (err) => {
  log.error('index.ts', 'Excepción no capturada', { error: String(err) });
});

