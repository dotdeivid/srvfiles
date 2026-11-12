import { apiFetch } from '../../lib/http';
import { log } from '../../lib/logger';

export interface DiscoveredServer {
  ip: string;
  url: string;
  appName: string;
  httpsPort?: number;
}

/**
 * Asks the local backend to scan the subnet for other SrvFiles servers.
 * El escaneo lo hace el servidor; [localUrl] es siempre el backend local con
 * su propio token.
 */
export async function scanNetwork(localUrl: string): Promise<DiscoveredServer[]> {
  void log.debug('[Discovery] starting network scan', { localUrl });
  const data = await apiFetch<DiscoveredServer[]>(localUrl, '/api/discovery/scan', {
    timeoutMs: 15_000,
    action: 'buscar servidores en la red',
  });
  void log.info('[Discovery] scan complete', { found: data.length });
  return data;
}
