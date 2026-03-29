import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getToken,
  authenticate,
  isLocalOrigin,
  onTokenCleared,
} from './auth.service';
import { log } from '../../lib/logger';

interface UseAuthReturn {
  authenticated: boolean;
  pinDialogOpen: boolean;
  pinError: string | null;
  /** Plain-text PIN shown in the header when the local server is running. Null for remote servers. */
  serverPin: string | null;
  submitPin: (pin: string) => Promise<void>;
}

/**
 * Manages authentication state for a given server URL.
 *
 * On mount:
 * - If a valid token already exists in sessionStorage, treats the session as authenticated.
 * - If the server is local (localhost / Tauri), auto-fetches the PIN and authenticates silently.
 * - Otherwise, opens the PinDialog so the user can enter the PIN manually.
 *
 * When a 401 is detected elsewhere (e.g. in useFiles), call clearToken() and the hook
 * will re-evaluate and re-open the dialog on the next render cycle.
 */
export function useAuth(serverUrl: string): UseAuthReturn {
  const [authenticated, setAuthenticated] = useState(() => !!getToken());
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [serverPin, setServerPin] = useState<string | null>(null);

  // Returns the PIN fetch URL, routing through loopback so the backend
  // accepts the request even when serverUrl uses the LAN IP.
  const toPinUrl = useCallback((url: string): string => {
    try {
      const parsed = new URL(url);
      parsed.hostname = 'localhost';
      return `${parsed.origin}/api/pin`;
    } catch {
      return `${url}/api/pin`;
    }
  }, []);

  useEffect(() => {
    if (isLocalOrigin(serverUrl)) {
      // Local server: always fetch the PIN for display in the header.
      // Use localhost explicitly so the backend's loopback-only guard passes.
      void log.debug('[useAuth] local server detected, fetching PIN', { serverUrl });
      fetch(toPinUrl(serverUrl))
        .then((r) => r.json())
        .then(async ({ pin }: { pin: string }) => {
          setServerPin(pin);
          // Siempre re-autenticar para servidores locales: el backend puede
          // haber reiniciado y generado un PIN nuevo, invalidando el token viejo.
          const ok = await authenticate(serverUrl, pin);
          if (ok) {
            void log.info('[useAuth] auto-authenticated with local server', { serverUrl });
            setAuthenticated(true);
          } else {
            void log.warn('[useAuth] auto-auth failed, opening PIN dialog', { serverUrl });
            setPinDialogOpen(true);
          }
        })
        .catch((err) => {
          void log.error('[useAuth] failed to fetch PIN from local server', { serverUrl, error: String(err) });
          if (!getToken()) setPinDialogOpen(true);
        });
      return;
    }

    // Remote server: if we already have a token, skip the auth flow
    if (getToken()) {
      void log.info('[useAuth] existing token found for remote server', { serverUrl });
      setAuthenticated(true);
      return;
    }

    // Remote server: ask the user for the PIN
    void log.info('[useAuth] remote server — opening PIN dialog', { serverUrl });
    setPinDialogOpen(true);
  }, [serverUrl, toPinUrl]);

  // Re-open PIN dialog when token is cleared externally (e.g. on 401 from useFiles).
  const authenticatedRef = useRef(authenticated);
  authenticatedRef.current = authenticated;
  useEffect(() => {
    return onTokenCleared(() => {
      if (authenticatedRef.current) {
        void log.warn('[useAuth] token cleared externally — re-opening PIN dialog');
        setAuthenticated(false);
        setPinDialogOpen(true);
      }
    });
  }, []);

  const submitPin = useCallback(async (pin: string) => {
    setPinError(null);
    void log.debug('[useAuth] submitting PIN', { serverUrl });
    const ok = await authenticate(serverUrl, pin);
    if (ok) {
      void log.info('[useAuth] PIN accepted, authenticated', { serverUrl });
      setAuthenticated(true);
      setPinDialogOpen(false);
    } else {
      void log.warn('[useAuth] wrong PIN submitted', { serverUrl });
      setPinError('PIN incorrecto. Intentá de nuevo.');
    }
  }, [serverUrl]);

  return { authenticated, pinDialogOpen, pinError, serverPin, submitPin };
}
