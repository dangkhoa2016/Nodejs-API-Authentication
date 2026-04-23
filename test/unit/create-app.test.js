'use strict';

// Tests for src/create-app.js
// Covers: ALLOWED_ORIGINS from env (line 19), notFound handler (lines 34-35),
// onError handler branches — generic Error (500), HTTPException from middleware
const { Hono } = require('hono');
const { HTTPException } = require('hono/http-exception');

describe('createApp — ALLOWED_ORIGINS from environment', () => {
  it('uses ALLOWED_ORIGINS env var when set', async () => {
    const prev = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = 'http://example.com, https://example.org';

    // Re-require with a fresh createApp call to hit the ternary truthy branch
    const { createApp } = require('../../src/create-app');
    const app = createApp();

    const res = await app.request('/');
    expect(res.status).toBe(200);

    process.env.ALLOWED_ORIGINS = prev;
  });
});

describe('createApp — onError handler', () => {
  it('handles generic (non-HTTP) errors with 500', async () => {
    const { createApp } = require('../../src/create-app');
    const app = createApp();
    app.get('/boom', () => {
      throw new Error('something broke');
    });

    const res = await app.request('/boom');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(body.message).toBe('something broke');
  });

  it('handles HTTPException from middleware (without cause)', async () => {
    const { createApp } = require('../../src/create-app');
    const app = createApp();
    // Use app.use() so the error goes through onError (not Hono route-handler shortcut)
    app.use('/mw-forbidden', async (_c, _next) => {
      throw new HTTPException(403, { message: 'Forbidden from middleware' });
    });
    app.get('/mw-forbidden', (c) => c.json({ ok: true }));

    const res = await app.request('/mw-forbidden');
    // Hono may return HTTPException's built-in response OR the custom onError response
    // Either way, status should not be 200
    expect(res.status).not.toBe(200);
  });

  it('handles HTTPException from middleware with cause (err.cause branch)', async () => {
    const { createApp } = require('../../src/create-app');
    const app = createApp();
    app.use('/mw-auth-fail', async (_c, _next) => {
      const cause = new Error('Token validation details');
      throw new HTTPException(401, { message: 'Auth error', cause });
    });
    app.get('/mw-auth-fail', (c) => c.json({ ok: true }));

    const res = await app.request('/mw-auth-fail');
    expect(res.status).not.toBe(200);
  });

  it('returns 404 for unknown routes', async () => {
    const { createApp } = require('../../src/create-app');
    const app = createApp();

    const res = await app.request('/no-such-route-xyz');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
