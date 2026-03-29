import http from 'http';
import https from 'https';
import { WebSocketServer } from 'ws';
import { createApp } from './app';
import { PORT, HOST, HTTPS_PORT, CERTS_DIR, APP_NAME, MAX_FILE_SIZE_MB } from './config';
import { getLanIp } from './infrastructure/network';
import { handleConnection } from './features/transfer/transfer.handler';
import { generatePin } from './features/auth/auth.service';
import { resetAuth } from './features/auth/auth.service';
import { getOrCreateCert } from './lib/cert';
import { log } from './lib/logger';

// ─── Create Express app ─────────────────────────────────────────────
const app = createApp();

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
