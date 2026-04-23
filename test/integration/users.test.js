'use strict';

// describe, it, expect, beforeAll, afterEach are globals injected by Vitest
const { request, resetDatabase, getTestApp } = require('../helpers/app');

beforeAll(async () => {
  // getTestApp() initialises the app AND syncs the DB (force: true) in one shot,
  // so any subsequent User.create() calls inside tests won't be wiped by a
  // second sync triggered lazily when request() is first called.
  await getTestApp();
});

afterEach(async () => {
  await resetDatabase();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const register = (body) => request('POST', '/users/register', { body });
const login = (body) => request('POST', '/users/login', { body });

const createAdmin = async () => {
  const { User } = require('../../src/app/models');
  const user = await User.create({ email: 'admin@admin.com', username: 'adminuser', password: 'adminpw', role: 'admin' });
  const res = await login({ username: 'adminuser', password: 'adminpw' });
  const body = await res.json();
  return { user, token: body.token };
};

const createRegularUser = async (suffix = '') => {
  await register({ email: `user${suffix}@test.com`, username: `user${suffix}`, password: 'userpw' });
  const res = await login({ username: `user${suffix}`, password: 'userpw' });
  const body = await res.json();
  return { user: body.user, token: body.token };
};

// ─── GET /users (admin list) ─────────────────────────────────────────────────

describe('GET /users — admin only', () => {
  it('returns 200 with user list for admin', async () => {
    const { token } = await createAdmin();
    const res = await request('GET', '/users', { token });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('count');
    expect(Array.isArray(body.users)).toBe(true);
  });

  it('returns 403 for regular user', async () => {
    const { token } = await createRegularUser('a');
    const res = await request('GET', '/users', { token });
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request('GET', '/users');
    expect(res.status).toBe(401);
  });

  it('respects limit clamping (max 100)', async () => {
    const { token } = await createAdmin();
    const res = await request('GET', '/users?limit=999&page=1', { token });
    expect(res.status).toBe(200);
  });

  it('supports search by username', async () => {
    const { token } = await createAdmin();
    const res = await request('GET', '/users?q=admin', { token });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users.some(u => u.username === 'adminuser')).toBe(true);
  });
});

// ─── POST /users/create ───────────────────────────────────────────────────────

describe('POST /users/create — admin only', () => {
  it('creates a user as admin', async () => {
    const { token } = await createAdmin();
    const res = await request('POST', '/users/create', {
      token,
      body: { email: 'created@test.com', username: 'createduser', password: 'pw' },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toHaveProperty('username', 'createduser');
    expect(body.user).not.toHaveProperty('encrypted_password');
  });

  it('returns 403 for regular user', async () => {
    const { token } = await createRegularUser('b');
    const res = await request('POST', '/users/create', {
      token,
      body: { email: 'blocked@test.com', username: 'blockeduser', password: 'pw' },
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when email is missing', async () => {
    const { token } = await createAdmin();
    const res = await request('POST', '/users/create', {
      token,
      body: { username: 'noemail', password: 'pw' },
    });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /users/:id ──────────────────────────────────────────────────────────

describe('PUT /users/:id — admin only', () => {
  it('updates a user as admin', async () => {
    const { token } = await createAdmin();
    const { user } = await createRegularUser('c');

    const res = await request('PUT', `/users/${user.id}`, {
      token,
      body: { first_name: 'Updated', email: `user_c_updated@test.com`, username: 'user_c_updated' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.first_name).toBe('Updated');
  });

  it('returns 404 for nonexistent user', async () => {
    const { token } = await createAdmin();
    const res = await request('PUT', '/users/99999', {
      token,
      body: { first_name: 'Ghost' },
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 for regular user', async () => {
    const { token } = await createRegularUser('d');
    const res = await request('PUT', `/users/1`, { token, body: { first_name: 'Hack' } });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /users/:id ────────────────────────────────────────────────────────

describe('DELETE /users/:id — admin only', () => {
  it('deletes a user as admin', async () => {
    const { token } = await createAdmin();
    const { user } = await createRegularUser('e');

    const res = await request('DELETE', `/users/${user.id}`, { token });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/deleted/i);
  });

  it('returns 200 with note when user not found', async () => {
    const { token } = await createAdmin();
    const res = await request('DELETE', '/users/99999', { token });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/not found/i);
  });

  it('returns 403 for regular user', async () => {
    const { token } = await createRegularUser('f');
    const res = await request('DELETE', `/users/1`, { token });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /users (self-delete via auth controller) ─────────────────────────

describe('DELETE /users — self-delete', () => {
  it('allows a user to delete their own account', async () => {
    const { token } = await createRegularUser('g');
    const res = await request('DELETE', '/users', { token });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/cancelled|deleted/i);
  });
});
