import axios from 'axios';
import { getApiUrl } from './files.api';
import { getToken } from '../lib/auth';
import { log } from '../lib/logger';

export interface DiscoveredServer {
  ip: string;
  url: string;
  appName: string;
}

/**
 * Asks the local backend to scan the subnet for other SrvFiles instances.
 * The actual network probing happens server-side; this call always hits localhost.
 * Uses a 15-second timeout to accommodate slow networks.
 *
 * @returns A promise resolving to an array of {@link DiscoveredServer} objects
 *          found on the local network, excluding the server itself.
 */
export async function scanNetwork(): Promise<DiscoveredServer[]> {
  const localApi = getApiUrl();
  const token = getToken();
  void log.debug('[Discovery] starting network scan', { localApi });
  try {
    const { data } = await axios.get<DiscoveredServer[]>(
      `${localApi}/api/discovery/scan`,
      {
        timeout: 15000,
        headers: token ? { 'X-SrvFiles-Token': token } : {},
      }
    );
    void log.info('[Discovery] scan complete', { found: data.length });
    return data;
  } catch (err) {
    void log.error('[Discovery] scan failed', { error: String(err) });
    throw err;
  }
}
