import { useState, useEffect, useCallback } from 'react';
import { scanNetwork, type DiscoveredServer } from './discovery.api';
import { getApiUrl } from '../files/files.api';
import { isTauriApp } from '../../lib/tauri';
import { log } from '../../lib/logger';

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

export function useMode() {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function autoConnect() {
      // Tauri: always its own server — no scan needed
      if (isTauriApp()) {
        void log.info('[useMode] Tauri context detected, connecting to localhost');
        if (!cancelled) {
          setServerUrl(LOCALHOST);
          setConnecting(false);
        }
        return;
      }

      // Browser accessing a remote server: already there, skip scan
      if (!isLocalContext()) {
        const url = normalize(getApiUrl());
        void log.info('[useMode] remote browser context, using current origin', { url });
        if (!cancelled) {
          setServerUrl(url);
          setConnecting(false);
        }
        return;
      }

      // localhost in browser (dev mode): scan to find the backend
      void log.info('[useMode] localhost browser context, scanning for backend');
      let servers: DiscoveredServer[] = [];
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          servers = await scanNetwork();
          break;
        } catch (err) {
          void log.warn('[useMode] scan attempt failed', { attempt, error: String(err) });
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      if (cancelled) return;

      const chosen = normalize(servers.length > 0 ? servers[0].url : LOCALHOST);
      void log.info('[useMode] server resolved', { url: chosen, discovered: servers.length });
      setServerUrl(chosen);
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

  const rescan = useCallback(async () => {
    return scanNetwork().catch(() => [] as DiscoveredServer[]);
  }, []);

  return { serverUrl, connecting, connect, rescan };
}
