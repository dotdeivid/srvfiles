import { useState, useEffect, useCallback } from 'react';
import { getToken, authenticate, fetchLocalPin, onTokenCleared } from './auth.service';
import { isLocalOrigin } from '../../shared/utils/serverUrl';
import { log } from '../../lib/logger';

interface UseAuthReturn {
  /** true cuando hay un token para este servidor. */
  authenticated: boolean;
  pinDialogOpen: boolean;
  pinError: string | null;
  submitting: boolean;
  /** PIN del servidor local, para mostrarlo en el encabezado. Null en servidores remotos. */
  serverPin: string | null;
  submitPin: (pin: string) => Promise<void>;
}

/**
 * Manages authentication state for a given server URL.
 *
 * - Servidor local (Tauri / localhost): lee el PIN y se autentica sola. Siempre
 *   re-autentica, porque si el backend se reinició el token viejo no vale.
 * - Servidor remoto con token guardado para ese servidor: lo usa.
 * - Si no: abre el diálogo de PIN.
 * Un 401 en cualquier petición borra el token de ese servidor y reabre el diálogo.
 */
export function useAuth(serverUrl: string): UseAuthReturn {
  const [authenticated, setAuthenticated] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverPin, setServerPin] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAuthenticated(false);
    setPinDialogOpen(false);
    setPinError(null);
    setServerPin(null);

    (async () => {
      if (isLocalOrigin(serverUrl)) {
        const pin = await fetchLocalPin(serverUrl);
        if (cancelled) return;
        if (pin) {
          setServerPin(pin);
          const result = await authenticate(serverUrl, pin);
          if (cancelled) return;
          if (result.ok) {
            void log.info('[useAuth] auto-authenticated with local server', { serverUrl });
            setAuthenticated(true);
            return;
          }
          setPinError(result.message);
        }
        if (getToken(serverUrl)) {
          setAuthenticated(true);
          return;
        }
        setPinDialogOpen(true);
        return;
      }

      if (getToken(serverUrl)) {
        void log.info('[useAuth] existing token found for server', { serverUrl });
        setAuthenticated(true);
        return;
      }
      void log.info('[useAuth] opening PIN dialog', { serverUrl });
      setPinDialogOpen(true);
    })();

    return () => { cancelled = true; };
  }, [serverUrl]);

  // Re-open PIN dialog when this server's token is cleared (e.g. on 401).
  useEffect(() => {
    return onTokenCleared(serverUrl, () => {
      void log.warn('[useAuth] token cleared — re-opening PIN dialog', { serverUrl });
      setAuthenticated(false);
      setPinDialogOpen(true);
    });
  }, [serverUrl]);

  const submitPin = useCallback(async (pin: string) => {
    setPinError(null);
    setSubmitting(true);
    const result = await authenticate(serverUrl, pin);
    setSubmitting(false);
    if (result.ok) {
      setAuthenticated(true);
      setPinDialogOpen(false);
    } else {
      setPinError(result.message);
    }
  }, [serverUrl]);

  return { authenticated, pinDialogOpen, pinError, submitting, serverPin, submitPin };
}
