import crypto from 'crypto';
import { log } from '../../lib/logger';

// ─── PIN state (in-memory, cleared on every server restart) ─────────

let pinHash: string | null = null;
let pinPlain: string | null = null;
const sessions = new Map<string, true>();

// ─── Rate limiting: IP → { count, blockedUntil } ─────────────────────

const rateLimitMap = new Map<string, { count: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 60_000;

// ─── PIN ─────────────────────────────────────────────────────────────

/**
 * Generates a random 6-digit PIN, stores its sha256 hash in memory,
 * and returns the plain-text PIN (shown once in the UI/console).
 */
export function generatePin(): string {
  const pin = String(crypto.randomInt(100_000, 1_000_000));
  pinHash = crypto.createHash('sha256').update(pin).digest('hex');
  pinPlain = pin;
  return pin;
}

/** Returns the current plain-text PIN. Only used by the /api/pin localhost endpoint. */
export function getPin(): string | null {
  return pinPlain;
}

export function validatePin(input: string): boolean {
  if (!pinHash) return false;
  const h = crypto.createHash('sha256').update(input).digest('hex');
  return h === pinHash;
}

// ─── Sessions ─────────────────────────────────────────────────────────

export function createSession(): string {
  const token = crypto.randomUUID();
  sessions.set(token, true);
  return token;
}

export function validateToken(token: string | undefined): boolean {
  return !!token && sessions.has(token);
}

// ─── Rate limiting ────────────────────────────────────────────────────

export function checkRateLimit(ip: string): { blocked: boolean } {
  const entry = rateLimitMap.get(ip);
  if (!entry) return { blocked: false };
  if (entry.blockedUntil > Date.now()) return { blocked: true };
  // Block expired — clean up
  rateLimitMap.delete(ip);
  return { blocked: false };
}

export function recordFailedAttempt(ip: string): void {
  const entry = rateLimitMap.get(ip) ?? { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_MS;
    log.warn('auth.service.ts', 'IP blocked due to too many failed PIN attempts', { ip, attempts: entry.count });
  } else {
    log.warn('auth.service.ts', 'Failed PIN attempt recorded', { ip, count: entry.count });
  }
  rateLimitMap.set(ip, entry);
}

export function clearFailedAttempts(ip: string): void {
  rateLimitMap.delete(ip);
}

// ─── Cleanup ──────────────────────────────────────────────────────────

export function resetAuth(): void {
  pinHash = null;
  pinPlain = null;
  sessions.clear();
  rateLimitMap.clear();
}
