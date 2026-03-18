import { useState, useEffect, useCallback } from 'react';
import { scanNetwork, type DiscoveredServer } from '../api/discovery.api';
import { getApiUrl } from '../api/files.api';

const LOCALHOST = 'http://localhost:3001';

function normalize(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/**
 * Returns true when running inside Tauri or from localhost.
 * Returns false when opened as a web page from a remote IP.
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
 * Manages server connection with auto-connect on mount.
 *
 * - Local/Tauri context: scans the network and auto-connects to the first
 *   server found, or falls back to the local backend (localhost).
 * - Remote browser context (e.g. http://192.168.x.y:3001): connects
 *   immediately to the current URL without scanning.
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

  const connect = useCallback((url: string) => {
    setServerUrl(normalize(url));
  }, []);

  /** Re-scans the network and updates availableServers without changing the active server. */
  const rescan = useCallback(async () => {
    const servers = await scanNetwork().catch(() => [] as DiscoveredServer[]);
    setAvailableServers(servers);
    return servers;
  }, []);

  return { serverUrl, connecting, availableServers, connect, rescan };
}
