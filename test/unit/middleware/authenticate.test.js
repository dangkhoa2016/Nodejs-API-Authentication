'use strict';

// Tests for src/app/middleware/authenticate.js
// Covers: JTI revocation (lines 15-17), user-not-found (lines 22-23)
// Also covers auth.js lines 140 (delete !context.user) and 154 (update !context.user)
// And permission.js line 7 (!user check)
const { request, resetDatabase, getTestApp } = require('../../helpers/app');

beforeAll(async () => {
  await getTestApp();
});

afterEach(async () => {
  await resetDatabase();
});

const register = (suffix) =>
  request('POST', '/users/register', { body: { email: `auth${suffix}@test.com`, username: `auth${suffix}`, password: 'pw123456' } });

const login = (suffix) =>
  request('POST', '/users/login', { body: { username: `auth${suffix}`, password: 'pw123456' } });

describe('authenticate middleware — token revoked (JTI denylist)', () => {
  it('returns 401 when accessing a protected route with a revoked token', async () => {
    await register('rev1');
    const { token } = await (await login('rev1')).json();

    // Logout once to add JTI to denylist
    await request('DELETE', '/users/logout', { token });

    // The same token is now revoked — profile should return 401
    const res = await request('GET', '/users/profile', { token });
    expect(res.status).toBe(401);
  });
});

describe('authenticate middleware — user not found (covers auth.js check in handlers)', () => {
  it('returns 404 when the user is deleted after token was issued (GET /users/profile)', async () => {
    await register('del1');
    const { token } = await (await login('del1')).json();

    // Delete the user directly from the DB
    const { User } = require('../../../src/app/models');
    await User.destroy({ where: { username: 'authdel1' } });

    // authenticate.js sets context.res = 404 without context.user
    // handleShowProfile then also returns 404 (covering auth.js line 128)
    const res = await request('GET', '/users/profile', { token });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the user is deleted after token was issued (DELETE /users — covers auth.js line 140)', async () => {
    await register('del2');
    const { token } = await (await login('del2')).json();

    const { User } = require('../../../src/app/models');
    await User.destroy({ where: { username: 'authdel2' } });

    const res = await request('DELETE', '/users', { token });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the user is deleted after token was issued (PATCH /users — covers auth.js line 154)', async () => {
    await register('del3');
    const { token } = await (await login('del3')).json();

    const { User } = require('../../../src/app/models');
    await User.destroy({ where: { username: 'authdel3' } });

    const res = await request('PATCH', '/users', { token, body: { first_name: 'X' } });
    expect(res.status).toBe(404);
  });

  it('returns 404 via permission middleware when user is deleted and requests an admin route (permission.js line 7)', async () => {
    // Register as admin first, then delete the user, then use the token on an admin route
    const { User } = require('../../../src/app/models');
    const admin = await User.create({ email: 'delmw@test.com', username: 'delmw', password: 'pw123', role: 'admin' });
    const { token } = await (await request('POST', '/users/login', { body: { username: 'delmw', password: 'pw123' } })).json();

    // Delete admin from DB
    await User.destroy({ where: { id: admin.id } });

    // Now make a request to an admin route — permission middleware runs, !user is true
    const res = await request('GET', '/users', { token });
    expect(res.status).toBe(404);
  });
});

