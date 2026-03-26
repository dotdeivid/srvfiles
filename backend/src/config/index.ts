import os from 'os';

// ─── Server ─────────────────────────────────────────────────────────
export const PORT = parseInt(process.env.PORT || '3001', 10);
export const HOST = '0.0.0.0';

// ─── App ────────────────────────────────────────────────────────────
export const APP_NAME = process.env.APP_NAME || 'SrvFiles';
export const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '5173', 10);

// ─── Files ──────────────────────────────────────────────────────────
export const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10240', 10);
export const MAX_UPLOAD_COUNT = parseInt(process.env.MAX_UPLOAD_COUNT || '50', 10);

// ─── Network ────────────────────────────────────────────────────────

/**
 * Iterates all network interfaces and returns the first non-internal IPv4 address.
 * Typically corresponds to the machine's LAN IP (e.g. 192.168.x.x).
 *
 * @returns The LAN IPv4 address, or `'localhost'` if no external interface is found.
 */
export function getLanIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}
