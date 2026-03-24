import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { WebSocketServer } from 'ws';
import filesRouter from './routes/files.route';
import healthRouter from './routes/health.route';
import configRouter from './routes/config.route';
import discoveryRouter from './routes/discovery.route';
import { PORT, HOST, getLanIp, APP_NAME, MAX_FILE_SIZE_MB } from './config';
import { handleConnection } from './services/transfer.service';

// ─── Express app setup ──────────────────────────────────────────────
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ─────────────────────────────────────────────────────
app.use('/api/files', filesRouter);
app.use('/api/health', healthRouter);
app.use('/api/config', configRouter);
app.use('/api/discovery', discoveryRouter);

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
