'use strict';

// Additional controller coverage — v1 aliases, update profile, error branches
const { request, resetDatabase, getTestApp } = require('../helpers/app');

beforeAll(async () => {
  await getTestApp();
});

afterEach(async () => {
  await resetDatabase();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const register = (suffix) =>
  request('POST', '/users/register', { body: { email: `cov${suffix}@test.com`, username: `cov${suffix}`, password: 'pw123456' } });

const login = (suffix) =>
  request('POST', '/users/login', { body: { username: `cov${suffix}`, password: 'pw123456' } });

const registerAndLogin = async (suffix) => {
  await register(suffix);
  const res = await login(suffix);
  return res.json();
};

// ─── /v1 mirrored auth routes ────────────────────────────────────────────────

describe('POST /v1/users/register', () => {
  it('creates a user via the /v1 prefix', async () => {
    const res = await request('POST', '/v1/users/register', {
      body: { email: 'v1reg@test.com', username: 'v1reg', password: 'pw123456' },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toHaveProperty('username', 'v1reg');
  });
});

describe('POST /v1/users/login', () => {
  it('logs in via /v1 prefix and returns token + refresh_token', async () => {
    await request('POST', '/v1/users/register', {
      body: { email: 'v1log@test.com', username: 'v1log', password: 'pw123456' },
    });
    const res = await request('POST', '/v1/users/login', {
      body: { username: 'v1log', password: 'pw123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.refresh_token).toBeTruthy();
  });
});

describe('GET /v1/user/me', () => {
  it('returns profile via /v1 prefix', async () => {
    const { token } = await registerAndLogin('v1me');
    const res = await request('GET', '/v1/user/me', { token });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('username', 'covv1me');
  });
});

describe('GET /v1/user/whoami', () => {
  it('returns profile via /v1/user/whoami', async () => {
    const { token } = await registerAndLogin('v1who');
    const res = await request('GET', '/v1/user/whoami', { token });
    expect(res.status).toBe(200);
    expect((await res.json())).toHaveProperty('username', 'covv1who');
  });
});

describe('GET /users/profile', () => {
  it('returns profile for authenticated user', async () => {
    const { token } = await registerAndLogin('prof');
    const res = await request('GET', '/users/profile', { token });
    expect(res.status).toBe(200);
    expect((await res.json())).toHaveProperty('username', 'covprof');
  });
});

// ─── PATCH /users — update own profile ──────────────────────────────────────

describe('PATCH /users — update own profile', () => {
  it('updates first_name and last_name', async () => {
    const { token } = await registerAndLogin('upd1');
    const res = await request('PATCH', '/users', {
      token,
      body: { first_name: 'John', last_name: 'Doe' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.first_name).toBe('John');
    expect(body.user.last_name).toBe('Doe');
  });

  it('allows password update', async () => {
    const { token } = await registerAndLogin('upd2');
    const res = await request('PATCH', '/users', {
      token,
      body: { password: 'newstrongpw' },
    });
    expect(res.status).toBe(200);

    // Verify new password works for login
    const loginNew = await request('POST', '/users/login', {
      body: { username: 'covupd2', password: 'newstrongpw' },
    });
    expect(loginNew.status).toBe(200);
  });

  it('returns 401 without token', async () => {
    const res = await request('PATCH', '/users', { body: { first_name: 'X' } });
    expect(res.status).toBe(401);
  });

  it('returns 400 on duplicate email', async () => {
    await request('POST', '/users/register', {
      body: { email: 'taken@test.com', username: 'takenuser', password: 'pw' },
    });
    const { token } = await registerAndLogin('upd3');
    const res = await request('PATCH', '/users', {
      token,
      body: { email: 'taken@test.com' },
    });
    expect(res.status).toBe(400);
  });
});

describe('PUT /users — update own profile (PUT alias)', () => {
  it('updates profile via PUT', async () => {
    const { token } = await registerAndLogin('put1');
    const res = await request('PUT', '/users', {
      token,
      body: { first_name: 'Updated' },
    });
    expect(res.status).toBe(200);
  });
});

// ─── DELETE /users/logout with refresh_token body ────────────────────────────

describe('DELETE /users/logout — refresh token revocation', () => {
  it('revokes refresh token when provided in body', async () => {
    const { token, refresh_token } = await registerAndLogin('lrt');

    const res = await request('DELETE', '/users/logout', {
      token,
      body: { refresh_token },
    });
    expect(res.status).toBe(200);

    // Refresh token should now be invalid
    const refreshRes = await request('POST', '/v1/auth/refresh', {
      body: { refresh_token },
    });
    expect(refreshRes.status).toBe(401);
  });
});

// ─── login returns refresh_token ─────────────────────────────────────────────

describe('POST /users/login — refresh_token in response', () => {
  it('includes refresh_token in login response', async () => {
    await register('rtl');
    const res = await login('rtl');
    const body = await res.json();
    expect(body.refresh_token).toBeTruthy();
    expect(typeof body.refresh_token).toBe('string');
    expect(body.refresh_token.length).toBeGreaterThan(32);
  });
});

// ─── register includes confirmation_token ────────────────────────────────────

describe('POST /users/register — confirmation_token generated', () => {
  it('stores a confirmation_token on the user after registration', async () => {
    await register('ct');
    const { User } = require('../../src/app/models');
    const user = await User.findOne({ where: { username: 'covct' } });
    expect(user.confirmation_token).toBeTruthy();
    expect(user.confirmation_token).toHaveLength(64);
    expect(user.confirmed_at).toBeNull();
  });
});
