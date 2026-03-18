import http from 'http';
import { getLanIp, PORT } from '../config';

export interface DiscoveredServer {
  ip: string;
  url: string;
  appName: string;
}

function getSubnetIPs(): string[] {
  const lanIp = getLanIp();
  if (lanIp === 'localhost') return [];

  const parts = lanIp.split('.');
  const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
  return Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
}

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
            if (json.status === 'ok' && json.app === 'SrvFiles') {
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

export async function scanNetwork(): Promise<DiscoveredServer[]> {
  const localIp = getLanIp();
  const ips = getSubnetIPs();

  const results = await Promise.all(ips.map((ip) => probeHost(ip)));

  return results
    .filter((r): r is DiscoveredServer => r !== null)
    .filter((r) => r.ip !== localIp); // exclude self
}
