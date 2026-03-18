import axios from 'axios';
import { getApiUrl } from './files.api';

export interface DiscoveredServer {
  ip: string;
  url: string;
  appName: string;
}

/**
 * Asks the LOCAL backend to scan the subnet for other SrvFiles instances.
 * Always hits localhost — the scan itself happens server-side.
 */
export async function scanNetwork(): Promise<DiscoveredServer[]> {
  const localApi = getApiUrl();
  const { data } = await axios.get<DiscoveredServer[]>(
    `${localApi}/api/discovery/scan`,
    { timeout: 15000 }
  );
  return data;
}
