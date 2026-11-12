import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getToken, setToken, clearToken, authenticate } from './auth.service';

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('session tokens', () => {
  // Regresión: había un solo token y el del servidor A se mandaba al B.
  it('are kept per server origin', () => {
    setToken('http://192.168.1.10:3001', 'token-a');
    setToken('http://192.168.1.20:3001/', 'token-b');
    expect(getToken('http://192.168.1.10:3001')).toBe('token-a');
    expect(getToken('http://192.168.1.20:3001')).toBe('token-b');
    clearToken('http://192.168.1.10:3001');
    expect(getToken('http://192.168.1.10:3001')).toBeNull();
    expect(getToken('http://192.168.1.20:3001')).toBe('token-b');
  });
});

describe('authenticate', () => {
  const respond = (status: number, body: unknown = {}) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it('stores the token for that server on success', async () => {
    respond(200, { token: 'abc' });
    expect(await authenticate('http://srv:3001', '123456')).toEqual({ ok: true });
    expect(getToken('http://srv:3001')).toBe('abc');
  });

  // Antes cualquier fallo se mostraba como "PIN incorrecto".
  it('distinguishes wrong PIN, rate limit and network errors', async () => {
    respond(401);
    expect(await authenticate('http://srv:3001', '000000')).toMatchObject({ ok: false, reason: 'wrong-pin' });
    respond(429);
    expect(await authenticate('http://srv:3001', '000000')).toMatchObject({ ok: false, reason: 'rate-limited' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await authenticate('http://srv:3001', '000000')).toMatchObject({ ok: false, reason: 'network' });
    expect(getToken('http://srv:3001')).toBeNull();
  });
});
