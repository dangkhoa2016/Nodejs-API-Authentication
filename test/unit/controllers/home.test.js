'use strict';

// Tests for src/app/controllers/home.js — /favicon.ico, /favicon.png, HEAD, range requests
const { request, getTestApp } = require('../../helpers/app');

beforeAll(async () => {
  await getTestApp();
});

describe('GET /', () => {
  it('returns 200 with welcome message', async () => {
    const res = await request('GET', '/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/welcome/i);
  });
});

describe('GET /favicon.ico', () => {
  it('returns 200 with correct content-type', async () => {
    const res = await request('GET', '/favicon.ico');
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type');
    expect(ct).toBeTruthy();
    // Should be an image type
    expect(ct).toMatch(/image/i);
  });

  it('returns content-length header', async () => {
    const res = await request('GET', '/favicon.ico');
    expect(res.headers.get('content-length')).toBeTruthy();
  });
});

describe('GET /favicon.png', () => {
  it('returns 200 with image/png content-type', async () => {
    const res = await request('GET', '/favicon.png');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/png/i);
  });
});

describe('HEAD /favicon.ico', () => {
  it('returns 200 with no body but with content-length', async () => {
    const testApp = await getTestApp();
    const res = await testApp.request('/favicon.ico', { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBeTruthy();
    // HEAD response must have empty body
    const text = await res.text();
    expect(text).toBe('');
  });
});

describe('GET /favicon.ico with Range header', () => {
  it('returns 206 Partial Content when range is requested', async () => {
    const testApp = await getTestApp();
    const res = await testApp.request('/favicon.ico', {
      method: 'GET',
      headers: { range: 'bytes=0-99' },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toMatch(/^bytes 0-/);
    expect(res.headers.get('accept-ranges')).toBe('bytes');
  });

  it('clamps end of range when it exceeds file size', async () => {
    const testApp = await getTestApp();
    const res = await testApp.request('/favicon.ico', {
      method: 'GET',
      headers: { range: 'bytes=0-999999999' },
    });
    expect(res.status).toBe(206);
    const contentRange = res.headers.get('content-range');
    expect(contentRange).toBeTruthy();
    // end should be clamped to file size - 1
    const [, start, end, total] = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
    expect(parseInt(end)).toBe(parseInt(total) - 1);
  });

  it('handles range with no end value (bytes=N-)', async () => {
    const testApp = await getTestApp();
    const res = await testApp.request('/favicon.ico', {
      method: 'GET',
      headers: { range: 'bytes=0-' },
    });
    // Should return full file as 206 or 200
    expect([200, 206]).toContain(res.status);
  });
});

describe('GET /docs', () => {
  it('returns 200 with HTML content', async () => {
    const res = await request('GET', '/docs');
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type');
    expect(ct).toMatch(/html/i);
  });
});

describe('GET /favicon.ico — body consumption (covers ReadableStream data/end events)', () => {
  it('returns file content when body is fully consumed', async () => {
    const testApp = await getTestApp();
    const res = await testApp.request('/favicon.ico', { method: 'GET' });
    expect(res.status).toBe(200);
    // Consume the body to trigger the ReadableStream data+end events
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });
});

describe('OPTIONS /favicon.ico — HEAD/OPTIONS branch', () => {
  it('returns 200 with content-length for OPTIONS on controller (bypasses CORS middleware)', async () => {
    // Test the controller directly to avoid the CORS preflight intercepting the OPTIONS request
    const homeController = require('../../../src/app/controllers/home');
    const res = await homeController.request('/favicon.ico', { method: 'OPTIONS' });
    expect([200, 204]).toContain(res.status);
    // The handleFile HEAD/OPTIONS path sets Content-Length
    expect(res.headers.get('content-length')).toBeTruthy();
  });
});

describe('GET /favicon.ico — range with no explicit start (bytes=-N suffix range)', () => {
  it('handles suffix range (bytes=-N) where start defaults to 0', async () => {
    const testApp = await getTestApp();
    // bytes=-100 means last 100 bytes; parts[0] is '' (falsy), so start defaults to 0
    const res = await testApp.request('/favicon.ico', {
      method: 'GET',
      headers: { range: 'bytes=-100' },
    });
    expect([200, 206]).toContain(res.status);
  });
});

