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

const registerUser = (body) => request('POST', '/users/register', { body });

const loginUser = (body) => request('POST', '/users/login', { body });

// ─── POST /users/register ───────────────────────────────────────────────────

describe('POST /users/register', () => {
  it('creates a new user and returns 201', async () => {
    const res = await registerUser({ email: 'new@test.com', username: 'newuser', password: 'pass123' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toMatch(/created/i);
    expect(body.user).toHaveProperty('id');
    expect(body.user).not.toHaveProperty('encrypted_password');
    expect(body.user).not.toHaveProperty('password');
  });

  it('returns 400 when email is missing', async () => {
    const res = await registerUser({ username: 'noemail', password: 'pass123' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it('returns 400 when username is missing', async () => {
    const res = await registerUser({ email: 'nouser@test.com', password: 'pass123' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('returns 400 when password is missing', async () => {
    const res = await registerUser({ email: 'nopw@test.com', username: 'nopwuser' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('returns 400 on duplicate email', async () => {
    await registerUser({ email: 'dup@test.com', username: 'dupuser1', password: 'pw' });
    const res = await registerUser({ email: 'dup@test.com', username: 'dupuser2', password: 'pw' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('returns 400 on duplicate username', async () => {
    await registerUser({ email: 'dup1@test.com', username: 'dupuser', password: 'pw' });
    const res = await registerUser({ email: 'dup2@test.com', username: 'dupuser', password: 'pw' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// ─── POST /users/login ──────────────────────────────────────────────────────

describe('POST /users/login', () => {
  // Use beforeEach so the user is re-created before every test, because the
  // top-level afterEach(resetDatabase) deletes all rows after each test.
  beforeEach(async () => {
    await registerUser({ email: 'login@test.com', username: 'loginuser', password: 'correctpw' });
  });

  it('returns 200 with a JWT token on valid credentials', async () => {
    const res = await loginUser({ username: 'loginuser', password: 'correctpw' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/successful/i);
    expect(body.token).toBeTruthy();
    expect(body.user).toHaveProperty('username', 'loginuser');
    expect(body.user).not.toHaveProperty('encrypted_password');
  });

  it('returns 400 on wrong password', async () => {
    const res = await loginUser({ username: 'loginuser', password: 'wrongpw' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/credentials/i);
  });

  it('returns 400 on nonexistent user', async () => {
    const res = await loginUser({ username: 'ghost', password: 'pw' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/credentials/i);
  });

  it('returns 400 when username or password missing', async () => {
    const res = await loginUser({ username: 'loginuser' });
    expect(res.status).toBe(400);
  });

  it('returns 423 when account is locked', async () => {
    const prevMax = process.env.MAX_FAILED_ATTEMPTS;
    process.env.MAX_FAILED_ATTEMPTS = '1';

    // Force lockout with 1 wrong attempt
    await loginUser({ username: 'loginuser', password: 'wrong' });

    const res = await loginUser({ username: 'loginuser', password: 'correctpw' });
    expect(res.status).toBe(423);
    const body = await res.json();
    expect(body.error).toMatch(/locked/i);

    process.env.MAX_FAILED_ATTEMPTS = prevMax;
    // User will be cleaned up by the top-level afterEach(resetDatabase)
  });

  it('resets failed_attempts to 0 after successful login', async () => {
    process.env.MAX_FAILED_ATTEMPTS = '5';
    await loginUser({ username: 'loginuser', password: 'wrong' });

    const { User } = require('../../src/app/models');
    let user = await User.findOne({ where: { username: 'loginuser' } });
    expect(user.failed_attempts).toBe(1);

    await loginUser({ username: 'loginuser', password: 'correctpw' });
    user = await User.findOne({ where: { username: 'loginuser' } });
    expect(user.failed_attempts).toBe(0);
  });
});

// ─── DELETE /users/logout ───────────────────────────────────────────────────

describe('DELETE /users/logout', () => {
  // Each test is self-contained so the top-level afterEach(resetDatabase)
  // cannot invalidate tokens or denylist entries from sibling tests.

  it('returns 200 on successful logout', async () => {
    await registerUser({ email: 'logout@test.com', username: 'logoutuser', password: 'pw123' });
    const loginRes = await loginUser({ username: 'logoutuser', password: 'pw123' });
    const { token } = await loginRes.json();
    const res = await request('DELETE', '/users/logout', { token });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/logout/i);
  });

  it('returns 401 when using a revoked token', async () => {
    // Register, login, logout once to add token to denylist, then retry.
    // All steps are in the same it() so afterEach cannot clear the denylist
    // between the logout and the revoked-token attempt.
    await registerUser({ email: 'revoked@test.com', username: 'revokeduser', password: 'pw123' });
    const loginRes = await loginUser({ username: 'revokeduser', password: 'pw123' });
    const { token } = await loginRes.json();
    await request('DELETE', '/users/logout', { token }); // revoke
    const res = await request('DELETE', '/users/logout', { token }); // use revoked token
    expect(res.status).toBe(401);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request('DELETE', '/users/logout');
    expect(res.status).toBe(401);
  });
});

// ─── GET /user/me ───────────────────────────────────────────────────────────

describe('GET /user/me', () => {
  let token;

  beforeAll(async () => {
    await registerUser({ email: 'me@test.com', username: 'meuser', password: 'mepw' });
    const res = await loginUser({ username: 'meuser', password: 'mepw' });
    const body = await res.json();
    token = body.token;
  });

  it('returns 200 with user profile for authenticated user', async () => {
    const res = await request('GET', '/user/me', { token });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('username', 'meuser');
    expect(body).not.toHaveProperty('encrypted_password');
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request('GET', '/user/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request('GET', '/user/me', { token: 'invalid.token.here' });
    expect(res.status).toBe(401);
  });
});
