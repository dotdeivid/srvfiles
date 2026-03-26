// ─── Session token (in-memory via sessionStorage) ───────────────────
// Token is tied to the browser tab — cleared when the tab closes.
// This is intentional: if the server restarts (new PIN), old tokens are invalid.

const TOKEN_KEY = 'srvfiles-session-token';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

const TOKEN_CLEARED = 'srvfiles:token-cleared';

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new CustomEvent(TOKEN_CLEARED));
}

export function onTokenCleared(cb: () => void): () => void {
  window.addEventListener(TOKEN_CLEARED, cb);
  return () => window.removeEventListener(TOKEN_CLEARED, cb);
}

// ─── Authentication ──────────────────────────────────────────────────

/**
 * Sends the PIN to the server and stores the returned session token.
 * Returns true on success, false on wrong PIN or network error.
 */
export async function authenticate(baseUrl: string, pin: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) return false;
    const { token } = await res.json();
    setToken(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches the PIN from the server (localhost only) and auto-authenticates.
 * Returns true if the server is local and auto-auth succeeded.
 */
export async function autoAuthenticate(baseUrl: string): Promise<boolean> {
  if (!isLocalOrigin(baseUrl)) return false;
  try {
    const res = await fetch(`${baseUrl}/api/pin`);
    if (!res.ok) return false;
    const { pin } = await res.json();
    return authenticate(baseUrl, pin);
  } catch {
    return false;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function isLocalOrigin(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'tauri.localhost'
    );
  } catch {
    return false;
  }
}
