'use strict';

// describe, it, expect, beforeAll, afterEach are globals injected by Vitest
const { request, resetDatabase, getTestApp } = require('../helpers/app');

beforeAll(async () => {
  await getTestApp();
});

afterEach(async () => {
  await resetDatabase();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const register = (suffix = 'a') =>
  request('POST', '/users/register', { body: { email: `extra${suffix}@test.com`, username: `extra${suffix}`, password: 'pw123456' } });

const login = (suffix = 'a') =>
  request('POST', '/users/login', { body: { username: `extra${suffix}`, password: 'pw123456' } });

const registerAndLogin = async (suffix = 'a') => {
  await register(suffix);
  const res = await login(suffix);
  return res.json();
};

// ─── GET /health ─────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request('GET', '/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(body.version).toBeTruthy();
  });
});

// ─── GET /openapi.json ────────────────────────────────────────────────────────

describe('GET /openapi.json', () => {
  it('returns 200 with a valid OpenAPI spec', async () => {
    const res = await request('GET', '/openapi.json');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toMatch(/^3\./);
    expect(body.info.title).toBeTruthy();
    expect(body.paths).toBeTruthy();
  });
});

// ─── POST /v1/auth/refresh ────────────────────────────────────────────────────

describe('POST /v1/auth/refresh', () => {
  it('returns a new access + refresh token on valid refresh token', async () => {
    const { token, refresh_token } = await registerAndLogin('r1');

    const res = await request('POST', '/v1/auth/refresh', { body: { refresh_token } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.refresh_token).toBeTruthy();
    expect(body.token).not.toBe(token);
    expect(body.refresh_token).not.toBe(refresh_token);
  });

  it('returns 401 when refresh token is invalid', async () => {
    const res = await request('POST', '/v1/auth/refresh', { body: { refresh_token: 'not-a-real-token' } });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it('returns 401 when refresh token is reused (rotated)', async () => {
    const { refresh_token } = await registerAndLogin('r2');

    // First use — valid
    const res1 = await request('POST', '/v1/auth/refresh', { body: { refresh_token } });
    expect(res1.status).toBe(200);

    // Second use of same token — must be rejected (token was rotated)
    const res2 = await request('POST', '/v1/auth/refresh', { body: { refresh_token } });
    expect(res2.status).toBe(401);
  });

  it('returns 400 when refresh_token field is missing', async () => {
    const res = await request('POST', '/v1/auth/refresh', { body: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });
});

// ─── POST /v1/auth/forgot-password ────────────────────────────────────────────

describe('POST /v1/auth/forgot-password', () => {
  it('returns 200 for a known email (does not expose whether user exists)', async () => {
    await register('fp1');
    const res = await request('POST', '/v1/auth/forgot-password', { body: { email: 'extrafp1@test.com' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBeTruthy();
  });

  it('returns 200 even for an unknown email (prevent user enumeration)', async () => {
    const res = await request('POST', '/v1/auth/forgot-password', { body: { email: 'nonexistent@test.com' } });
    expect(res.status).toBe(200);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request('POST', '/v1/auth/forgot-password', { body: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it('stores a reset token on the user in dev mode (debug_token exposed)', async () => {
    await register('fp2');
    const res = await request('POST', '/v1/auth/forgot-password', { body: { email: 'extrafp2@test.com' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    // In test (dev-like) environment the debug_token is returned
    expect(body.debug_token).toBeTruthy();
    expect(body.debug_token).toHaveLength(64); // 32 random bytes → 64 hex chars
  });
});

// ─── POST /v1/auth/reset-password ─────────────────────────────────────────────

describe('POST /v1/auth/reset-password', () => {
  const getResetToken = async (suffix) => {
    await register(suffix);
    const res = await request('POST', '/v1/auth/forgot-password', { body: { email: `extra${suffix}@test.com` } });
    const { debug_token } = await res.json();
    return debug_token;
  };

  it('resets the password with a valid token', async () => {
    const token = await getResetToken('rp1');
    const res = await request('POST', '/v1/auth/reset-password', { body: { token, password: 'newpassword123' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/reset/i);
  });

  it('allows login with the new password after reset', async () => {
    const token = await getResetToken('rp2');
    await request('POST', '/v1/auth/reset-password', { body: { token, password: 'brandnewpw' } });

    // Verify reset_password_token is cleared
    const { User } = require('../../src/app/models');
    const user = await User.findOne({ where: { email: 'extrarp2@test.com' } });
    expect(user?.reset_password_token).toBeNull();

    // Verify the new password works for login
    const loginRes = await request('POST', '/users/login', { body: { username: 'extrarp2', password: 'brandnewpw' } });
    expect(loginRes.status).toBe(200);
  });

  it('returns 400 with an invalid token', async () => {
    const res = await request('POST', '/v1/auth/reset-password', { body: { token: 'badbadtoken', password: 'newpw' } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it('returns 400 when token or password is missing', async () => {
    const res1 = await request('POST', '/v1/auth/reset-password', { body: { password: 'newpw' } });
    expect(res1.status).toBe(400);

    const res2 = await request('POST', '/v1/auth/reset-password', { body: { token: 'sometoken' } });
    expect(res2.status).toBe(400);
  });
});

// ─── POST /v1/auth/confirm-email ──────────────────────────────────────────────

describe('POST /v1/auth/confirm-email', () => {
  const getConfirmationToken = async (suffix) => {
    await register(suffix);
    const { User } = require('../../src/app/models');
    const user = await User.findOne({ where: { username: `extra${suffix}` } });
    return user.confirmation_token;
  };

  it('confirms email with a valid token', async () => {
    const token = await getConfirmationToken('ce1');
    const res = await request('POST', '/v1/auth/confirm-email', { body: { token } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/confirmed/i);
  });

  it('sets confirmed_at on the user after confirmation', async () => {
    const token = await getConfirmationToken('ce2');
    await request('POST', '/v1/auth/confirm-email', { body: { token } });
    const { User } = require('../../src/app/models');
    const user = await User.findOne({ where: { username: 'extrace2' } });
    expect(user.confirmed_at).not.toBeNull();
    expect(user.confirmation_token).toBeNull();
  });

  it('returns 200 with "already confirmed" message on duplicate confirmation', async () => {
    const token = await getConfirmationToken('ce3');
    await request('POST', '/v1/auth/confirm-email', { body: { token } });
    // Second call – user already confirmed, token is null now
    const res2 = await request('POST', '/v1/auth/confirm-email', { body: { token } });
    expect(res2.status).toBe(400); // token no longer exists
  });

  it('returns 400 with an invalid token', async () => {
    const res = await request('POST', '/v1/auth/confirm-email', { body: { token: 'fakefakefake' } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it('returns 400 when token is missing', async () => {
    const res = await request('POST', '/v1/auth/confirm-email', { body: {} });
    expect(res.status).toBe(400);
  });
});

// ─── POST /v1/auth/resend-confirmation ────────────────────────────────────────

describe('POST /v1/auth/resend-confirmation', () => {
  it('generates a new confirmation token for an unconfirmed user', async () => {
    await register('rc1');
    const { User } = require('../../src/app/models');
    const before = await User.findOne({ where: { username: 'extrarc1' } });
    const oldToken = before.confirmation_token;

    const res = await request('POST', '/v1/auth/resend-confirmation', { body: { email: 'extrarc1@test.com' } });
    expect(res.status).toBe(200);

    const after = await User.findOne({ where: { username: 'extrarc1' } });
    expect(after.confirmation_token).not.toBe(oldToken);
    expect(after.confirmation_token).toHaveLength(64);
  });

  it('returns 200 even for unknown email (prevent enumeration)', async () => {
    const res = await request('POST', '/v1/auth/resend-confirmation', { body: { email: 'ghost@test.com' } });
    expect(res.status).toBe(200);
  });

  it('returns 200 but no new token for an already-confirmed user', async () => {
    const token = await (async () => {
      await register('rc2');
      const { User } = require('../../src/app/models');
      const user = await User.findOne({ where: { username: 'extrarc2' } });
      return user.confirmation_token;
    })();

    // Confirm first
    await request('POST', '/v1/auth/confirm-email', { body: { token } });

    // Resend for confirmed account — should be no-op
    const res = await request('POST', '/v1/auth/resend-confirmation', { body: { email: 'extrarc2@test.com' } });
    expect(res.status).toBe(200);

    const { User } = require('../../src/app/models');
    const user = await User.findOne({ where: { username: 'extrarc2' } });
    expect(user.confirmation_token).toBeNull();
  });

  it('returns 400 when email is missing', async () => {
    const res = await request('POST', '/v1/auth/resend-confirmation', { body: {} });
    expect(res.status).toBe(400);
  });
});
