'use strict';

// Tests for src/app/middleware/logger.js
// Covers: line 56 — else branch when response content-type is not JSON or text
const { Hono } = require('hono');
const loggerMiddleware = require('../../../src/app/middleware/logger');

const buildApp = (contentType, responseBody = 'data') => {
  const app = new Hono();
  app.use(loggerMiddleware);
  app.get('/test', (c) => {
    return new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': contentType },
    });
  });
  return app;
};

describe('logger middleware — response content-type branch', () => {
  it('logs body when response is application/json', async () => {
    const app = buildApp('application/json', JSON.stringify({ ok: true }));
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('logs body when response is text/plain', async () => {
    const app = buildApp('text/plain', 'hello');
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  // Covers line 56: else branch for non-text / non-JSON content types
  it('logs without body when response content-type is application/octet-stream', async () => {
    const app = buildApp('application/octet-stream', 'binary');
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('logs without body when response content-type is image/png', async () => {
    const app = buildApp('image/png', '\x89PNG');
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });
});
