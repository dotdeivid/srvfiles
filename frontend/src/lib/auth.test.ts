import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getToken,
  setToken,
  clearToken,
  authenticate,
  autoAuthenticate,
  isLocalOrigin,
} from '../features/auth/auth.service';

// ─── sessionStorage is provided by jsdom ─────────────────────────────────────

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

// ─── isLocalOrigin ────────────────────────────────────────────────────────────

describe('isLocalOrigin', () => {
  it('returns true for localhost', () => {
    expect(isLocalOrigin('http://localhost:3001')).toBe(true);
  });

  it('returns true for 127.0.0.1', () => {
    expect(isLocalOrigin('http://127.0.0.1:3001')).toBe(true);
  });

  it('returns true for tauri.localhost', () => {
    expect(isLocalOrigin('http://tauri.localhost')).toBe(true);
  });

  it('returns false for a LAN IP', () => {
    expect(isLocalOrigin('http://192.168.1.10:3001')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isLocalOrigin('')).toBe(false);
  });

  it('returns false for a malformed URL', () => {
    expect(isLocalOrigin('not-a-url')).toBe(false);
  });
});

// ─── Token management ─────────────────────────────────────────────────────────

describe('getToken / setToken / clearToken', () => {
  it('getToken returns null when nothing is stored', () => {
    expect(getToken()).toBeNull();
  });

  it('setToken stores the token and getToken retrieves it', () => {
    setToken('abc-123');
    expect(getToken()).toBe('abc-123');
  });

  it('clearToken removes the token', () => {
    setToken('abc-123');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('setToken overwrites a previous token', () => {
    setToken('first-token');
    setToken('second-token');
    expect(getToken()).toBe('second-token');
  });
});

// ─── authenticate ─────────────────────────────────────────────────────────────

describe('authenticate', () => {
  it('stores the token and returns true on 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'server-token-xyz' }),
    }));

    const result = await authenticate('http://localhost:3001', '123456');
    expect(result).toBe(true);
    expect(getToken()).toBe('server-token-xyz');
  });

  it('returns false and does not store a token on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'PIN incorrecto' }),
    }));

    const result = await authenticate('http://localhost:3001', '000000');
    expect(result).toBe(false);
    expect(getToken()).toBeNull();
  });

  it('returns false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await authenticate('http://localhost:3001', '123456');
    expect(result).toBe(false);
    expect(getToken()).toBeNull();
  });

  it('sends the PIN to the correct endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'tok' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await authenticate('http://localhost:3001', '654321');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ pin: '654321' }),
      }),
    );
  });
});

// ─── autoAuthenticate ─────────────────────────────────────────────────────────

describe('autoAuthenticate', () => {
  it('returns false for a non-local origin without fetching', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = await autoAuthenticate('http://192.168.1.10:3001');
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches /api/pin and authenticates on success for local origin', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pin: '987654' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'auto-token' }),
      }),
    );

    const result = await autoAuthenticate('http://localhost:3001');
    expect(result).toBe(true);
    expect(getToken()).toBe('auto-token');
  });

  it('returns false when /api/pin request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await autoAuthenticate('http://localhost:3001');
    expect(result).toBe(false);
  });

  it('returns false when /api/pin throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await autoAuthenticate('http://localhost:3001');
    expect(result).toBe(false);
  });
});
