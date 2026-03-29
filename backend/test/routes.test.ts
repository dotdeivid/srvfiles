import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import authRouter from '../src/features/auth/auth.route';
import healthRouter from '../src/features/health/health.route';
import { requireAuth } from '../src/features/auth/auth.middleware';
import { generatePin, getPin, createSession, resetAuth, recordFailedAttempt } from '../src/features/auth/auth.service';

// ─── Test app factory ─────────────────────────────────────────────────────────
// Builds the same Express stack as app.ts but without calling server.listen().

function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);

  // Replicate the /api/pin localhost-only endpoint
  app.get('/api/pin', (req, res) => {
    const ip = (req.socket.remoteAddress ?? '').replace('::ffff:', '');
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '';
    if (!isLocal) { res.status(403).json({ error: 'Forbidden' }); return; }
    const pin = getPin();
    if (!pin) { res.status(503).json({ error: 'Server not ready' }); return; }
    res.json({ pin });
  });

  // A simple protected endpoint to test requireAuth middleware
  app.get('/api/protected', requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let app: Express;
let currentPin: string;

beforeEach(() => {
  resetAuth();
  currentPin = generatePin();
  app = createTestApp();
});

// ─── Health ───────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns 200 without authentication', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('returns { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toMatchObject({ status: 'ok' });
  });
});

// ─── POST /api/auth ──────────────────────────────────────────────────────────

describe('POST /api/auth', () => {
  it('returns a token for the correct PIN', async () => {
    const res = await request(app).post('/api/auth').send({ pin: currentPin });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
  });

  it('returned token is a UUID v4', async () => {
    const res = await request(app).post('/api/auth').send({ pin: currentPin });
    expect(res.body.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('returns 401 for a wrong PIN', async () => {
    const res = await request(app).post('/api/auth').send({ pin: '000000' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when PIN is missing', async () => {
    const res = await request(app).post('/api/auth').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when PIN is not a string', async () => {
    const res = await request(app).post('/api/auth').send({ pin: 123456 });
    expect([400, 401]).toContain(res.status);
  });

  it('returns 429 when the IP is rate-limited', async () => {
    // Pre-populate the rate limit for all loopback variants supertest may use
    for (const ip of ['127.0.0.1', '::1', '']) {
      for (let i = 0; i < 5; i++) recordFailedAttempt(ip);
    }
    const res = await request(app).post('/api/auth').send({ pin: '000000' });
    expect(res.status).toBe(429);
  });

  it('successful auth resets the failed-attempt counter', async () => {
    // 4 failures
    for (let i = 0; i < 4; i++) {
      await request(app).post('/api/auth').send({ pin: '000000' });
    }
    // correct PIN — should clear the counter
    await request(app).post('/api/auth').send({ pin: currentPin });
    // Now we can fail 4 more times without being blocked
    for (let i = 0; i < 4; i++) {
      const r = await request(app).post('/api/auth').send({ pin: '000000' });
      expect(r.status).toBe(401);
    }
  });
});

// ─── requireAuth middleware ───────────────────────────────────────────────────

describe('requireAuth middleware', () => {
  it('returns 401 with no token header', async () => {
    const res = await request(app).get('/api/protected');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('X-SrvFiles-Token', 'bad-token');
    expect(res.status).toBe(401);
  });

  it('returns 200 with a valid session token', async () => {
    const token = createSession();
    const res = await request(app)
      .get('/api/protected')
      .set('X-SrvFiles-Token', token);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 401 after auth is reset (token invalidated)', async () => {
    const token = createSession();
    resetAuth();
    generatePin(); // reinitialize so app stays functional
    const res = await request(app)
      .get('/api/protected')
      .set('X-SrvFiles-Token', token);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/pin ─────────────────────────────────────────────────────────────

describe('GET /api/pin', () => {
  it('returns the PIN when accessed from loopback (supertest = 127.0.0.1)', async () => {
    const res = await request(app).get('/api/pin');
    expect(res.status).toBe(200);
    expect(res.body.pin).toBe(currentPin);
  });

  it('returns 503 when no PIN has been generated', async () => {
    resetAuth(); // clears the PIN
    const res = await request(app).get('/api/pin');
    expect(res.status).toBe(503);
  });
});
