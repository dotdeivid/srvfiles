import express from 'express';
import cors from 'cors';
import filesRouter from './routes/files.route';
import { PORT, HOST, APP_NAME, MAX_FILE_SIZE_MB, FRONTEND_PORT, getLanIp } from './config';
import type { AppConfig } from './types';

// ─── Express app setup ──────────────────────────────────────────────
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ─────────────────────────────────────────────────────────
app.use('/api/files', filesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// ─── Start server ───────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  const lanIp = getLanIp();

  console.log(`\n🗂️  ${APP_NAME} Backend running!`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${lanIp}:${PORT}`);
  console.log(`   Max file size: ${MAX_FILE_SIZE_MB} MB`);
  console.log('');
});

export default app;
