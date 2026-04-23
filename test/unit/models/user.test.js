'use strict';

// describe, it, expect, beforeAll, afterEach are globals injected by Vitest
const { sequelize, resetDatabase } = require('../../helpers/app');

let User;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  ({ User } = require('../../../src/app/models'));
});

afterEach(async () => {
  await resetDatabase();
});

describe('User model — password encryption', () => {
  it('hashes the password automatically on create', async () => {
    const user = await User.scope('withPassword').findOne({
      where: { username: 'hashtest' },
    }).then(() => null).catch(() => null);
    expect(user).toBeNull();

    const created = await User.scope('withPassword').create({
      email: 'hash@test.com',
      username: 'hashtest',
      password: 'plaintext123',
    }).then(u => User.scope('withPassword').findByPk(u.id));

    expect(created.encrypted_password).toBeTruthy();
    expect(created.encrypted_password).toMatch(/^\$2[ayb]\$\d{2}\$/);
    expect(created.encrypted_password).not.toBe('plaintext123');
    expect(created.dataValues.password).toBeUndefined();
  });

  it('does not re-hash an already-hashed password', async () => {
    const user = await User.create({ email: 'rehash@test.com', username: 'rehashtest', password: 'pw1' });
    const withPw = await User.scope('withPassword').findByPk(user.id);
    const originalHash = withPw.encrypted_password;

    // Update without changing password
    await user.update({ first_name: 'Test' });
    const afterUpdate = await User.scope('withPassword').findByPk(user.id);

    expect(afterUpdate.encrypted_password).toBe(originalHash);
  });
});

describe('User model — validPassword()', () => {
  it('returns true for the correct password', async () => {
    const user = await User.create({ email: 'vp@test.com', username: 'vptest', password: 'secret123' });
    expect(await user.validPassword('secret123')).toBe(true);
  });

  it('returns false for an incorrect password', async () => {
    const user = await User.create({ email: 'vp2@test.com', username: 'vptest2', password: 'secret123' });
    expect(await user.validPassword('wrongpassword')).toBe(false);
  });

  it('returns false when password is empty', async () => {
    const user = await User.create({ email: 'vp3@test.com', username: 'vptest3', password: 'secret123' });
    expect(await user.validPassword('')).toBe(false);
  });
});

describe('User model — defaultScope excludes encrypted_password', () => {
  it('does not return encrypted_password in default queries', async () => {
    await User.create({ email: 'scope@test.com', username: 'scopetest', password: 'pw' });
    const user = await User.findOne({ where: { username: 'scopetest' } });
    expect(user.encrypted_password).toBeUndefined();
  });

  it('returns encrypted_password with withPassword scope', async () => {
    await User.create({ email: 'scope2@test.com', username: 'scopetest2', password: 'pw' });
    const user = await User.scope('withPassword').findOne({ where: { username: 'scopetest2' } });
    expect(user.encrypted_password).toBeTruthy();
  });
});

describe('User model — isAdmin getter', () => {
  it('returns true for admin role', async () => {
    const user = await User.create({ email: 'admin@test.com', username: 'adminuser', password: 'pw', role: 'admin' });
    expect(user.isAdmin).toBe(true);
  });

  it('returns false for regular user role', async () => {
    const user = await User.create({ email: 'reg@test.com', username: 'reguser', password: 'pw', role: 'user' });
    expect(user.isAdmin).toBe(false);
  });
});

describe('User model — account lockout', () => {
  it('isLocked returns false for new user', async () => {
    const user = await User.create({ email: 'lock@test.com', username: 'locktest', password: 'pw' });
    expect(user.isLocked).toBe(false);
  });

  it('increments failed_attempts and locks after MAX_FAILED_ATTEMPTS', async () => {
    process.env.MAX_FAILED_ATTEMPTS = '3';
    const user = await User.create({ email: 'lock2@test.com', username: 'locktest2', password: 'pw' });

    await user.incrementFailedAttempts();
    expect(user.failed_attempts).toBe(1);
    expect(user.locked_at).toBeFalsy();

    await user.incrementFailedAttempts();
    expect(user.failed_attempts).toBe(2);
    expect(user.locked_at).toBeFalsy();

    await user.incrementFailedAttempts();
    expect(user.failed_attempts).toBe(3);
    expect(user.locked_at).not.toBeNull();
    expect(user.isLocked).toBe(true);
  });

  it('resetFailedAttempts clears counter and locked_at', async () => {
    process.env.MAX_FAILED_ATTEMPTS = '2';
    const user = await User.create({ email: 'lock3@test.com', username: 'locktest3', password: 'pw' });
    await user.incrementFailedAttempts();
    await user.incrementFailedAttempts();
    expect(user.isLocked).toBe(true);

    await user.resetFailedAttempts();
    expect(user.failed_attempts).toBe(0);
    expect(user.locked_at).toBeNull();
    expect(user.isLocked).toBe(false);
  });
});

describe('User model — toJSON via allowDisplayColumns', () => {
  it('serializes only allowed columns', async () => {
    const user = await User.create({ email: 'json@test.com', username: 'jsontest', password: 'pw' });
    const json = user.toJSON();

    expect(json).toHaveProperty('id');
    expect(json).toHaveProperty('email');
    expect(json).toHaveProperty('username');
    expect(json).not.toHaveProperty('encrypted_password');
    expect(json).not.toHaveProperty('failed_attempts');
    expect(json).not.toHaveProperty('locked_at');
    expect(json).not.toHaveProperty('sign_in_count');
  });
});
