import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { WebSocketServer } from 'ws';
import filesRouter from './routes/files.route';
import { PORT, HOST, APP_NAME, MAX_FILE_SIZE_MB, FRONTEND_PORT, getLanIp } from './config';
import { scanNetwork } from './services/discovery.service';
import { handleConnection } from './services/transfer.service';
import type { AppConfig } from './types';

// ─── Express app setup ──────────────────────────────────────────────
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ─────────────────────────────────────────────────────
app.use('/api/files', filesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'SrvFiles', appName: APP_NAME, timestamp: new Date().toISOString() });
});

app.get('/api/discovery/scan', async (_req, res) => {
  const servers = await scanNetwork();
  res.json(servers);
});

app.get('/api/config', (_req, res) => {
  const lanIp = getLanIp();
  const config: AppConfig = {
    appName: APP_NAME,
    lanIp,
    port: PORT,
    frontendPort: FRONTEND_PORT,
    maxFileSizeMb: MAX_FILE_SIZE_MB,
    lanUrl: `http://${lanIp}`,
  };
  res.json(config);
});

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

// ─── HTTP + WebSocket server ─────────────────────────────────────────
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', handleConnection);

server.listen(PORT, HOST, () => {
  const lanIp = getLanIp();

  console.log(`\n🗂️  ${APP_NAME} running!`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${lanIp}:${PORT}`);
  console.log(`   Max file size: ${MAX_FILE_SIZE_MB} MB`);
  console.log('');
});

export default app;
