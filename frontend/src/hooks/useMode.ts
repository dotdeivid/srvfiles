import { useState, useEffect, useCallback } from 'react';
import { scanNetwork, type DiscoveredServer } from '../api/discovery.api';
import { getApiUrl } from '../api/files.api';

const LOCALHOST = 'http://localhost:3001';

/**
 * Removes trailing slashes and surrounding whitespace from a URL.
 *
 * @param url - The raw URL string.
 * @returns A normalized URL without a trailing slash.
 */
function normalize(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/**
 * Returns `true` when the app is running in a "local" context:
 * inside Tauri, or in a browser on the same machine as the server
 * (`localhost` / `127.0.0.1`).
 *
 * Returns `false` when accessed from a remote device via its LAN IP,
 * meaning the server is already known from `window.location`.
 *
 * @returns Boolean indicating whether a network scan is needed to find the server.
 */
function isLocalContext(): boolean {
  const h = window.location.hostname;
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === 'tauri.localhost' ||
    '__TAURI_INTERNALS__' in window
  );
}

/**
 * Manages server connection with automatic discovery on mount.
 *
 * - **Local / Tauri context**: scans the LAN for SrvFiles instances
 *   (retrying up to 6 × 500 ms while the local sidecar warms up) and
 *   auto-connects to the first found server, or falls back to `localhost:3001`.
 * - **Remote browser context** (e.g. `http://192.168.x.y:5173`): skips the
 *   scan and connects directly to the URL visible in `window.location`.
 *
 * @returns An object with:
 *   - `serverUrl` — the active backend URL, or `null` while connecting.
 *   - `connecting` — `true` during the initial discovery phase.
 *   - `availableServers` — list of all servers found during the last scan.
 *   - `connect(url)` — manually switches the active server.
 *   - `rescan()` — re-scans the network and updates `availableServers`.
 */
export function useMode() {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [availableServers, setAvailableServers] = useState<DiscoveredServer[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function autoConnect() {
      // Browser accessing a remote server: already there, skip scan
      if (!isLocalContext()) {
        if (!cancelled) {
          setServerUrl(normalize(getApiUrl()));
          setConnecting(false);
        }
        return;
      }

      // Tauri / localhost: scan for other SrvFiles instances.
      // Retry up to 6 × 500 ms = 3 s while the local sidecar warms up.
      let servers: DiscoveredServer[] = [];
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          servers = await scanNetwork();
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      if (cancelled) return;

      setAvailableServers(servers);
      setServerUrl(normalize(servers.length > 0 ? servers[0].url : LOCALHOST));
      setConnecting(false);
    }

    autoConnect();
    return () => { cancelled = true; };
  }, []);

  /**
   * Switches the active server to the given URL.
   *
   * @param url - The backend base URL to connect to.
   */
  const connect = useCallback((url: string) => {
    setServerUrl(normalize(url));
  }, []);

  /**
   * Re-scans the local network for SrvFiles instances and updates `availableServers`.
   * Does not change the currently active server URL.
   *
   * @returns A promise resolving to the updated list of discovered servers.
   */
  const rescan = useCallback(async () => {
    const servers = await scanNetwork().catch(() => [] as DiscoveredServer[]);
    setAvailableServers(servers);
    return servers;
  }, []);

  return { serverUrl, connecting, availableServers, connect, rescan };
}
