'use strict';

/**
 * Error-paths integration tests — exercises all 500 catch blocks and
 * other uncovered branches by mocking model methods to throw.
 *
 * Uses vi.spyOn() for per-test isolation; vi.restoreAllMocks() in afterEach.
 */
const { request, resetDatabase, getTestApp } = require('../helpers/app');

beforeAll(async () => {
  await getTestApp();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await resetDatabase();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const register = (suffix) =>
  request('POST', '/users/register', {
    body: { email: `ep${suffix}@test.com`, username: `ep${suffix}`, password: 'pw123456' },
  });

const login = (suffix) =>
  request('POST', '/users/login', { body: { username: `ep${suffix}`, password: 'pw123456' } });

const registerAndLogin = async (suffix) => {
  await register(suffix);
  return (await login(suffix)).json();
};

// ─── auth.js — login 500 ─────────────────────────────────────────────────────

describe('POST /users/login — 500 when DB throws', () => {
  it('returns 500 when User.findOne throws', async () => {
    const { User } = require('../../src/app/models');
    vi.spyOn(User, 'findOne').mockRejectedValueOnce(new Error('DB error'));

    const res = await request('POST', '/users/login', {
      body: { username: 'whoever', password: 'whatever' },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error logging in/i);
  });
});

// ─── auth.js — logout 500 ────────────────────────────────────────────────────

describe('DELETE /users/logout — 500 when DB throws', () => {
  it('returns 500 when JwtDenylist.create throws', async () => {
    const { token } = await registerAndLogin('logout500');
    const { JwtDenylist } = require('../../src/app/models');
    vi.spyOn(JwtDenylist, 'create').mockRejectedValueOnce(new Error('DB error'));

    const res = await request('DELETE', '/users/logout', { token });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error logging out/i);
  });
});

// ─── auth.js — profile 500 ───────────────────────────────────────────────────

describe('GET /users/profile — 500 when serialization throws', () => {
  it('returns 500 when user.toJSON throws', async () => {
    const { User } = require('../../src/app/models');
    const { token } = await registerAndLogin('prof500');

    vi.spyOn(User.prototype, 'toJSON').mockImplementationOnce(() => {
      throw new Error('serialization error');
    });

    const res = await request('GET', '/users/profile', { token });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error fetching user profile/i);
  });
});

// ─── auth.js — delete account 500 ────────────────────────────────────────────

describe('DELETE /users — 500 when DB throws', () => {
  it('returns 500 when user.destroy throws', async () => {
    const { User } = require('../../src/app/models');
    const { token } = await registerAndLogin('del500');

    vi.spyOn(User.prototype, 'destroy').mockRejectedValueOnce(new Error('DB error'));

    const res = await request('DELETE', '/users', { token });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error deleting user/i);
  });
});

// ─── auth.js — update profile 500 ────────────────────────────────────────────

describe('PATCH /users — 500 when DB throws (non-Sequelize error)', () => {
  it('returns 500 when user.update throws a generic error', async () => {
    const { User } = require('../../src/app/models');
    const { token } = await registerAndLogin('upd500');

    vi.spyOn(User.prototype, 'update').mockRejectedValueOnce(new Error('generic DB error'));

    const res = await request('PATCH', '/users', {
      token,
      body: { first_name: 'Test' },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error updating profile/i);
  });
});

// ─── auth-extra.js — refresh 500 ─────────────────────────────────────────────

describe('POST /v1/auth/refresh — 500 when DB throws', () => {
  it('returns 500 when RefreshToken.findOne throws', async () => {
    const { RefreshToken } = require('../../src/app/models');
    vi.spyOn(RefreshToken, 'findOne').mockRejectedValueOnce(new Error('DB error'));

    const res = await request('POST', '/v1/auth/refresh', {
      body: { refresh_token: 'some-token' },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error refreshing token/i);
  });
});

// ─── auth-extra.js — forgot-password 500 ─────────────────────────────────────

describe('POST /v1/auth/forgot-password — 500 when DB throws', () => {
  it('returns 500 when User scope findOne throws', async () => {
    const { User } = require('../../src/app/models');
    vi.spyOn(User, 'findOne').mockRejectedValueOnce(new Error('DB error'));

    const res = await request('POST', '/v1/auth/forgot-password', {
      body: { email: 'some@email.com' },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error processing request/i);
  });
});

// ─── auth-extra.js — reset-password expired token ────────────────────────────

describe('POST /v1/auth/reset-password — expired token', () => {
  it('returns 400 when reset token is older than 2 hours', async () => {
    await register('resetexp');
    const { User } = require('../../src/app/models');

    // Manually set a reset token with a timestamp > 2h ago
    const user = await User.findOne({ where: { username: 'epresetexp' } });
    const oldDate = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
    await user.update({ reset_password_token: 'old-token', reset_password_sent_at: oldDate });

    const res = await request('POST', '/v1/auth/reset-password', {
      body: { token: 'old-token', password: 'newpass123' },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });
});

// ─── auth-extra.js — reset-password 500 ──────────────────────────────────────

describe('POST /v1/auth/reset-password — 500 when DB throws', () => {
  it('returns 500 when user.update throws', async () => {
    await register('reseterr');
    const { User } = require('../../src/app/models');

    // Set a valid reset token
    const user = await User.findOne({ where: { username: 'epreseterr' } });
    await user.update({ reset_password_token: 'valid-token', reset_password_sent_at: new Date() });

    vi.spyOn(User.prototype, 'update').mockRejectedValueOnce(new Error('DB error'));

    const res = await request('POST', '/v1/auth/reset-password', {
      body: { token: 'valid-token', password: 'newpass123' },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error resetting password/i);
  });
});

// ─── auth-extra.js — confirm-email 500 ───────────────────────────────────────

describe('POST /v1/auth/confirm-email — 500 when DB throws', () => {
  it('returns 500 when user.update throws', async () => {
    await register('confierr');
    const { User } = require('../../src/app/models');

    const user = await User.findOne({ where: { username: 'epconfierr' } });
    const token = user.confirmation_token;

    vi.spyOn(User.prototype, 'update').mockRejectedValueOnce(new Error('DB error'));

    const res = await request('POST', '/v1/auth/confirm-email', {
      body: { token },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error confirming email/i);
  });
});

// ─── auth-extra.js — resend-confirmation 500 ─────────────────────────────────

describe('POST /v1/auth/resend-confirmation — 500 when DB throws', () => {
  it('returns 500 when user.update throws', async () => {
    await register('resenderr');
    const { User } = require('../../src/app/models');

    vi.spyOn(User.prototype, 'update').mockRejectedValueOnce(new Error('DB error'));

    const res = await request('POST', '/v1/auth/resend-confirmation', {
      body: { email: 'epresenderr@test.com' },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error resending confirmation/i);
  });
});

// ─── user.js — getAll 500 ─────────────────────────────────────────────────────

describe('GET /users — 500 when DB throws', () => {
  it('returns 400 when User.findAndCountAll throws', async () => {
    const { User } = require('../../src/app/models');

    // Create admin first (before mocking)
    await User.create({ email: 'admin500@test.com', username: 'admin500', password: 'adminpw', role: 'admin' });
    const { token } = await (await request('POST', '/users/login', { body: { username: 'admin500', password: 'adminpw' } })).json();

    vi.spyOn(User, 'findAndCountAll').mockRejectedValueOnce(new Error('DB error'));

    const res = await request('GET', '/users', { token });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/error getting users/i);
  });
});

// ─── user.js — delete 500 ─────────────────────────────────────────────────────

describe('DELETE /users/:id — 500 when DB throws', () => {
  it('returns 400 when User.destroy throws', async () => {
    const { User } = require('../../src/app/models');

    await User.create({ email: 'admindel@test.com', username: 'admindel', password: 'adminpw', role: 'admin' });
    const { token } = await (await request('POST', '/users/login', { body: { username: 'admindel', password: 'adminpw' } })).json();

    const target = await User.create({ email: 'target@test.com', username: 'target', password: 'pw' });

    vi.spyOn(User, 'destroy').mockRejectedValueOnce(new Error('DB error'));

    const res = await request('DELETE', `/users/${target.id}`, { token });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/error deleting user/i);
  });
});

// ─── user.js — update 500 (non-Sequelize error) ───────────────────────────────

describe('PUT /users/:id — 500 when DB throws non-Sequelize error', () => {
  it('returns 500 when user.update throws a generic error', async () => {
    const { User } = require('../../src/app/models');

    await User.create({ email: 'adminupd@test.com', username: 'adminupd', password: 'adminpw', role: 'admin' });
    const { token } = await (await request('POST', '/users/login', { body: { username: 'adminupd', password: 'adminpw' } })).json();

    const target = await User.create({ email: 'target2@test.com', username: 'target2', password: 'pw' });

    vi.spyOn(User.prototype, 'update').mockRejectedValueOnce(new Error('generic DB error'));

    const res = await request('PUT', `/users/${target.id}`, {
      token,
      body: { first_name: 'Updated' },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error updating user/i);
  });
});

// ─── home.js — health DB error ────────────────────────────────────────────────

describe('GET /health — degraded status when DB unreachable', () => {
  it('returns status=degraded when sequelize.authenticate throws', async () => {
    const { sequelize } = require('../../src/app/models');
    vi.spyOn(sequelize, 'authenticate').mockRejectedValueOnce(new Error('DB connection failed'));

    const res = await request('GET', '/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.db).toBe('error');
  });
});

// ─── user.service.js — createUser 500 (non-Sequelize error) ──────────────────

describe('POST /users/register — 500 when User.create throws non-Sequelize error', () => {
  it('returns 500 when User.create throws a generic error', async () => {
    const { User } = require('../../src/app/models');
    vi.spyOn(User, 'create').mockRejectedValueOnce(new Error('generic DB error'));

    const res = await request('POST', '/users/register', {
      body: { email: 'err500@test.com', username: 'err500', password: 'pw123' },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/error creating user/i);
  });
});

// ─── auth-extra.js — .catch(() => ({})) callbacks when no JSON body ───────────
// Sending requests without Content-Type:application/json triggers the catch fallback

describe('auth-extra.js routes — handle requests with no/invalid body (catch callbacks)', () => {
  it('POST /v1/auth/refresh with no body returns 400', async () => {
    const testApp = await getTestApp();
    const res = await testApp.request('/v1/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(400);
  });

  it('POST /v1/auth/forgot-password with no body returns 400', async () => {
    const testApp = await getTestApp();
    const res = await testApp.request('/v1/auth/forgot-password', { method: 'POST' });
    expect(res.status).toBe(400);
  });

  it('POST /v1/auth/reset-password with no body returns 400', async () => {
    const testApp = await getTestApp();
    const res = await testApp.request('/v1/auth/reset-password', { method: 'POST' });
    expect(res.status).toBe(400);
  });

  it('POST /v1/auth/confirm-email with no body returns 400', async () => {
    const testApp = await getTestApp();
    const res = await testApp.request('/v1/auth/confirm-email', { method: 'POST' });
    expect(res.status).toBe(400);
  });

  it('POST /v1/auth/resend-confirmation with no body returns 400', async () => {
    const testApp = await getTestApp();
    const res = await testApp.request('/v1/auth/resend-confirmation', { method: 'POST' });
    expect(res.status).toBe(400);
  });
});

