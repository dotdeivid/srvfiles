import http from 'http';
import { getLanIp, getSubnetIPs } from '../../infrastructure/network';
import { PORT } from '../../config';
import { log } from '../../lib/logger';
import type { DiscoveredServer } from '../../domain/types';

/**
 * Sends a single HTTP GET to `GET /api/health` on the given host and port.
 * The request times out after 500 ms.
 */
function probeHost(ip: string): Promise<DiscoveredServer | null> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: ip, port: PORT, path: '/api/health', method: 'GET' },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.status === 'ok' && String(json.app).toLowerCase() === 'srvfiles') {
              resolve({ ip, url: `http://${ip}:${PORT}`, appName: json.appName || 'SrvFiles' });
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.setTimeout(500, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}

/**
 * Scans the entire local /24 subnet in parallel for other SrvFiles instances.
 */
export async function scanNetwork(): Promise<DiscoveredServer[]> {
  const localIp = getLanIp();
  const ips = getSubnetIPs();

  log.info('discovery.service.ts', 'Starting LAN scan', { subnet: ips[0]?.split('.').slice(0, 3).join('.'), hostCount: ips.length });

  const results = await Promise.all(ips.map((ip) => probeHost(ip)));

  const found = results
    .filter((r): r is DiscoveredServer => r !== null)
    .filter((r) => r.ip !== localIp); // exclude self

  log.info('discovery.service.ts', 'LAN scan complete', { found: found.length });
  return found;
}
