import { describe, it, expect, beforeEach } from 'vitest';
import {
  generatePin,
  getPin,
  validatePin,
  createSession,
  validateToken,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  resetAuth,
} from '../src/features/auth/auth.service';

// ─── Helpers ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetAuth();
});

// ─── PIN ───────────────────────────────────────────────────────────────────────

describe('generatePin', () => {
  it('returns a 6-digit string', () => {
    const pin = generatePin();
    expect(pin).toMatch(/^\d{6}$/);
  });

  it('is between 100000 and 999999', () => {
    const pin = parseInt(generatePin(), 10);
    expect(pin).toBeGreaterThanOrEqual(100_000);
    expect(pin).toBeLessThanOrEqual(999_999);
  });

  it('getPin returns the same PIN right after generation', () => {
    const pin = generatePin();
    expect(getPin()).toBe(pin);
  });

  it('generates different PINs on successive calls (statistically)', () => {
    const pins = new Set(Array.from({ length: 10 }, () => generatePin()));
    expect(pins.size).toBeGreaterThan(1);
  });
});

describe('validatePin', () => {
  it('returns true for the correct PIN', () => {
    const pin = generatePin();
    expect(validatePin(pin)).toBe(true);
  });

  it('returns false for a wrong PIN', () => {
    generatePin();
    expect(validatePin('000000')).toBe(false);
  });

  it('returns false when no PIN has been generated', () => {
    expect(validatePin('123456')).toBe(false);
  });

  it('is case-sensitive / exact-match (hash must match)', () => {
    const pin = generatePin();
    expect(validatePin(pin + ' ')).toBe(false);
  });
});

describe('getPin', () => {
  it('returns null before any PIN is generated', () => {
    expect(getPin()).toBeNull();
  });

  it('returns null after resetAuth', () => {
    generatePin();
    resetAuth();
    expect(getPin()).toBeNull();
  });
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

describe('createSession / validateToken', () => {
  it('creates a valid UUID token', () => {
    const token = createSession();
    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('validateToken returns true for a created session', () => {
    const token = createSession();
    expect(validateToken(token)).toBe(true);
  });

  it('validateToken returns false for an unknown token', () => {
    expect(validateToken('not-a-real-token')).toBe(false);
  });

  it('validateToken returns false for undefined', () => {
    expect(validateToken(undefined)).toBe(false);
  });

  it('validateToken returns false for empty string', () => {
    expect(validateToken('')).toBe(false);
  });

  it('multiple sessions can coexist independently', () => {
    const t1 = createSession();
    const t2 = createSession();
    expect(validateToken(t1)).toBe(true);
    expect(validateToken(t2)).toBe(true);
    expect(t1).not.toBe(t2);
  });

  it('resetAuth invalidates all sessions', () => {
    const token = createSession();
    resetAuth();
    expect(validateToken(token)).toBe(false);
  });
});

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe('rate limiting', () => {
  const IP = '10.0.0.1';
  const OTHER_IP = '10.0.0.2';

  it('not blocked initially', () => {
    expect(checkRateLimit(IP).blocked).toBe(false);
  });

  it('not blocked after fewer than MAX_ATTEMPTS failures', () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt(IP);
    expect(checkRateLimit(IP).blocked).toBe(false);
  });

  it('blocked after MAX_ATTEMPTS (5) failures', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(IP);
    expect(checkRateLimit(IP).blocked).toBe(true);
  });

  it('one IP block does not affect another IP', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(IP);
    expect(checkRateLimit(OTHER_IP).blocked).toBe(false);
  });

  it('clearFailedAttempts unblocks the IP', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(IP);
    clearFailedAttempts(IP);
    expect(checkRateLimit(IP).blocked).toBe(false);
  });

  it('resetAuth clears all rate limit state', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(IP);
    resetAuth();
    expect(checkRateLimit(IP).blocked).toBe(false);
  });
});
