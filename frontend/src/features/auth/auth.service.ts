import { log } from '../../lib/logger';
import { timeoutSignal } from '../../lib/signal';

// ─── Session tokens (por servidor, en sessionStorage) ───────────────
// Cada servidor tiene su propio token: antes había uno solo y el token del
// servidor A se mandaba al servidor B. Se borran al cerrar la pestaña.

const TOKENS_KEY = 'srvfiles-session-tokens';
const TOKEN_CLEARED = 'srvfiles:token-cleared';

/** Clave estable para un servidor: su origen (`http://host:puerto`). */
function keyFor(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl;
  }
}

function readAll(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(TOKENS_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function writeAll(tokens: Record<string, string>): void {
  sessionStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function getToken(baseUrl: string): string | null {
  return readAll()[keyFor(baseUrl)] ?? null;
}

export function setToken(baseUrl: string, token: string): void {
  writeAll({ ...readAll(), [keyFor(baseUrl)]: token });
}

export function clearToken(baseUrl: string): void {
  const tokens = readAll();
  const key = keyFor(baseUrl);
  if (!(key in tokens)) return;
  delete tokens[key];
  writeAll(tokens);
  void log.info('[auth] session token cleared', { server: key });
  window.dispatchEvent(new CustomEvent(TOKEN_CLEARED, { detail: key }));
}

/** Avisa cuando se borra el token de `baseUrl` (p. ej. tras un 401). */
export function onTokenCleared(baseUrl: string, cb: () => void): () => void {
  const key = keyFor(baseUrl);
  const handler = (e: Event) => {
    if ((e as CustomEvent<string>).detail === key) cb();
  };
  window.addEventListener(TOKEN_CLEARED, handler);
  return () => window.removeEventListener(TOKEN_CLEARED, handler);
}

// ─── Authentication ──────────────────────────────────────────────────

export type AuthResult =
  | { ok: true }
  | { ok: false; reason: 'wrong-pin' | 'rate-limited' | 'network' | 'server'; message: string };

/**
 * Envía el PIN al servidor y guarda el token devuelto para ese servidor.
 * Distingue PIN incorrecto, demasiados intentos y errores de red.
 */
export async function authenticate(baseUrl: string, pin: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${baseUrl}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
      signal: timeoutSignal(10_000),
    });
    if (res.status === 401) return { ok: false, reason: 'wrong-pin', message: 'PIN incorrecto. Intentá de nuevo.' };
    if (res.status === 429) {
      return { ok: false, reason: 'rate-limited', message: 'Demasiados intentos. Esperá un minuto y probá de nuevo.' };
    }
    if (!res.ok) {
      void log.warn('[auth] authenticate failed', { baseUrl, status: res.status });
      return { ok: false, reason: 'server', message: `El servidor respondió con un error (${res.status}).` };
    }
    const { token } = (await res.json()) as { token?: string };
    if (!token) return { ok: false, reason: 'server', message: 'Respuesta inválida del servidor.' };
    setToken(baseUrl, token);
    void log.info('[auth] authenticated successfully', { baseUrl });
    return { ok: true };
  } catch (err) {
    void log.error('[auth] authenticate error', { baseUrl, error: String(err) });
    return { ok: false, reason: 'network', message: 'No se pudo contactar al servidor.' };
  }
}

/**
 * Lee el PIN del servidor local (solo responde a conexiones desde esta
 * máquina). Devuelve null si no está disponible.
 */
export async function fetchLocalPin(baseUrl: string): Promise<string | null> {
  try {
    const url = new URL(baseUrl);
    url.hostname = 'localhost';
    const res = await fetch(`${url.origin}/api/pin`, { signal: timeoutSignal(5_000) });
    if (!res.ok) return null;
    const { pin } = (await res.json()) as { pin?: string };
    return pin ?? null;
  } catch (err) {
    void log.warn('[auth] could not read local PIN', { baseUrl, error: String(err) });
    return null;
  }
}
