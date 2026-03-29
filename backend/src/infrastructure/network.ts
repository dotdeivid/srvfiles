import os from 'os';

/**
 * Returns the first non-internal IPv4 address (typically the LAN IP).
 * Falls back to `'localhost'` if no external interface is found.
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

/**
 * Generates all 254 host IPs in the same /24 subnet as the local LAN IP.
 * Returns an empty array when no external network interface is available.
 */
export function getSubnetIPs(): string[] {
  const lanIp = getLanIp();
  if (lanIp === 'localhost') return [];

  const parts = lanIp.split('.');
  const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
  return Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
}
