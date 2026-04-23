'use strict';

// Tests for src/app/middleware/rate-limit.js
// Covers: rate limit exceeded (429), header values, window reset, keyFn defaults
const { Hono } = require('hono');
const { createRateLimiter } = require('../../../src/app/middleware/rate-limit');

const makeApp = (max = 2, windowMs = 60_000, keyFn = () => 'test-key') => {
  const app = new Hono();
  const limiter = createRateLimiter({ windowMs, max, keyFn });
  app.use('*', limiter);
  app.get('/ping', (c) => c.json({ ok: true }));
  return app;
};

describe('createRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = makeApp(3);
    const res = await app.request('/ping');
    expect(res.status).toBe(200);
  });

  it('returns 429 when limit is exceeded', async () => {
    const app = makeApp(2);
    await app.request('/ping');
    await app.request('/ping');
    const res = await app.request('/ping');
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/too many/i);
  });

  it('sets Retry-After header when rate limited', async () => {
    const app = makeApp(1);
    await app.request('/ping');
    const res = await app.request('/ping');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('sets X-RateLimit-* headers on allowed requests', async () => {
    const app = makeApp(5);
    const res = await app.request('/ping');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('resets count after window expires', async () => {
    const app = makeApp(1, 100); // 100ms window
    const r1 = await app.request('/ping');
    expect(r1.status).toBe(200);

    const r2 = await app.request('/ping');
    expect(r2.status).toBe(429);

    // Wait for the window to expire
    await new Promise((r) => setTimeout(r, 150));

    const r3 = await app.request('/ping');
    expect(r3.status).toBe(200);
  });

  it('uses x-forwarded-for header as key when no keyFn', async () => {
    const app = new Hono();
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    app.use('*', limiter);
    app.get('/ping', (c) => c.json({ ok: true }));

    await app.request('/ping', { headers: { 'x-forwarded-for': '1.2.3.4' } });
    const res = await app.request('/ping', { headers: { 'x-forwarded-for': '1.2.3.4' } });
    expect(res.status).toBe(429);
  });

  it('falls back to "unknown" key when no IP info available', async () => {
    const app = new Hono();
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    app.use('*', limiter);
    app.get('/ping', (c) => c.json({ ok: true }));

    await app.request('/ping');
    const res = await app.request('/ping');
    // Should still rate-limit the same "unknown" key
    expect(res.status).toBe(429);
  });

  it('uses different counters per key', async () => {
    let callCount = 0;
    const app = new Hono();
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyFn: () => `key-${callCount++}`, // different key each time
    });
    app.use('*', limiter);
    app.get('/ping', (c) => c.json({ ok: true }));

    const r1 = await app.request('/ping'); // key-0
    const r2 = await app.request('/ping'); // key-1
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });
});
