import http from 'http';
import { getLanIp, PORT } from '../config';

export interface DiscoveredServer {
  ip: string;
  url: string;
  appName: string;
}

/**
 * Generates all 254 host IPs in the same /24 subnet as the local LAN IP.
 * Returns an empty array when `getLanIp()` falls back to `'localhost'`
 * (i.e. no external network interface is available).
 *
 * @returns Array of IPv4 strings in the form `"x.x.x.1"` … `"x.x.x.254"`.
 */
function getSubnetIPs(): string[] {
  const lanIp = getLanIp();
  if (lanIp === 'localhost') return [];

  const parts = lanIp.split('.');
  const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
  return Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
}

/**
 * Sends a single HTTP GET to `GET /api/health` on the given host and port.
 * The request times out after 500 ms. The response is considered a valid
 * SrvFiles server only when `{ status: "ok", app: "SrvFiles" }` is returned.
 *
 * @param ip - The IPv4 address to probe.
 * @returns A promise resolving to a {@link DiscoveredServer} object on success,
 *          or `null` if the host is unreachable, times out, or is not a SrvFiles instance.
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
 * Probes all 254 possible hosts simultaneously and filters the results to exclude
 * the local machine's own IP.
 *
 * @returns A promise resolving to an array of {@link DiscoveredServer} objects
 *          representing every responsive SrvFiles instance found on the network,
 *          excluding the caller itself.
 */
export async function scanNetwork(): Promise<DiscoveredServer[]> {
  const localIp = getLanIp();
  const ips = getSubnetIPs();

  const results = await Promise.all(ips.map((ip) => probeHost(ip)));

  return results
    .filter((r): r is DiscoveredServer => r !== null)
    .filter((r) => r.ip !== localIp); // exclude self
}
