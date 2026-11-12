import { useState, useEffect, useCallback, useRef } from 'react';
import { scanNetwork, type DiscoveredServer } from './discovery.api';
import { getApiUrl } from '../files/files.api';
import { isTauriApp, getBackendPort } from '../../lib/tauri';
import { log } from '../../lib/logger';

function normalize(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/**
 * Decide a qué servidor conectarse.
 *
 * - Tauri: el backend propio, en el puerto que eligió la app.
 * - Navegador: el servidor que sirvió la página (origen actual). Antes, en
 *   localhost se escaneaba la red y se elegía el primer servidor encontrado,
 *   que era el de otra máquina.
 *
 * `localUrl` es siempre el backend de esta máquina/página (para escanear la
 * red); `serverUrl` es el servidor que se está viendo.
 */
export function useMode() {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const historyRef = useRef<string[]>([]);
  const currentRef = useRef<string | null>(null);
  const [historyLen, setHistoryLen] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = isTauriApp()
        ? `http://localhost:${await getBackendPort()}`
        : normalize(getApiUrl());
      if (cancelled) return;
      void log.info('[useMode] server resolved', { url, tauri: isTauriApp() });
      setLocalUrl(url);
      currentRef.current = url;
      setServerUrl(url);
      setConnecting(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /** Cambia al servidor `url`, recordando el anterior para poder volver. */
  const connect = useCallback((url: string) => {
    const next = normalize(url);
    const current = currentRef.current;
    if (current === next) return;
    if (current) historyRef.current.push(current);
    currentRef.current = next;
    setServerUrl(next);
    setHistoryLen(historyRef.current.length);
  }, []);

  /** Vuelve al servidor anterior (p. ej. si se cancela el PIN). */
  const goBack = useCallback((): boolean => {
    const prev = historyRef.current.pop();
    setHistoryLen(historyRef.current.length);
    if (!prev) return false;
    currentRef.current = prev;
    setServerUrl(prev);
    return true;
  }, []);

  const canGoBack = historyLen > 0;

  const rescan = useCallback(async (): Promise<DiscoveredServer[]> => {
    if (!localUrl) return [];
    return scanNetwork(localUrl).catch((err) => {
      void log.warn('[useMode] scan failed', { error: String(err) });
      return [] as DiscoveredServer[];
    });
  }, [localUrl]);

  return { serverUrl, localUrl, connecting, connect, goBack, canGoBack, rescan };
}
