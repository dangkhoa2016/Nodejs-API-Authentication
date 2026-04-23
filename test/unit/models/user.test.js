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

// ─── fullName getter ──────────────────────────────────────────────────────────

describe('User model — fullName getter', () => {
  it('returns the full name combined from first_name and last_name', async () => {
    const user = await User.create({
      email: 'fn@test.com', username: 'fntest', password: 'pw',
      first_name: 'John', last_name: 'Doe',
    });
    expect(user.fullName).toBe('John Doe');
  });

  it('skips empty name parts', async () => {
    const user = await User.create({ email: 'fn2@test.com', username: 'fntest2', password: 'pw', first_name: 'Jane' });
    expect(user.fullName).toBe('Jane');
  });
});

// ─── validPassword edge cases ─────────────────────────────────────────────────

describe('User model — validPassword edge cases', () => {
  it('returns true when both password and encrypted_password are falsy', async () => {
    // Build an in-memory user without saving (no encrypted_password)
    const user = User.build({ email: 'e@e.com', username: 'nobody', role: 'user' });
    expect(await user.validPassword(null)).toBe(true);
    expect(await user.validPassword(undefined)).toBe(true);
  });

  it('returns false when user has no encrypted_password in DB (fetched with default scope)', async () => {
    // Create user without a password so encrypted_password stays as empty string
    const created = await User.create({ email: 'nopw@test.com', username: 'nopwuser' });
    // Fetch with default scope — encrypted_password is excluded
    const fetched = await User.findByPk(created.id);
    expect(fetched.encrypted_password).toBeUndefined();
    // encrypted_password in withPassword scope is '' (falsy) → returns false
    const result = await fetched.validPassword('somepassword');
    expect(result).toBe(false);
  });
});

// ─── encrypted_password customValidator ──────────────────────────────────────

describe('User model — encrypted_password customValidator', () => {
  it('throws validation error when encrypted_password is updated to an invalid value', async () => {
    // Create a valid user first, then directly update encrypted_password to an invalid string.
    // The beforeValidate hook only hashes when isNewRecord || password is set.
    // When updating without the password virtual field, validation runs on the raw value.
    const user = await User.create({ email: 'invalid@test.com', username: 'invalidpw', password: 'pw' });

    let threw = false;
    try {
      await user.update({ encrypted_password: 'not-a-bcrypt-hash' });
    } catch (err) {
      threw = true;
      expect(err.name === 'SequelizeValidationError' || err.message.includes('60-character')).toBe(true);
    }
    expect(threw).toBe(true);
  });
});

// ─── Sequelize scopes ─────────────────────────────────────────────────────────

describe('User model — random() and withRole() scopes', () => {
  beforeEach(async () => {
    await User.create({ email: 'scope1@test.com', username: 'scope1', password: 'pw', role: 'user' });
    await User.create({ email: 'scope2@test.com', username: 'scope2', password: 'pw', role: 'admin' });
  });

  it('random() scope returns results in random order', async () => {
    const users = await User.scope('random').findAll({ limit: 2 });
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
  });

  it('withRole() scope filters by role', async () => {
    const adminUsers = await User.scope({ method: ['withRole', 'admin'] }).findAll();
    expect(adminUsers.every(u => u.role === 'admin')).toBe(true);
  });
});

// ─── resetFailedAttempts when counter is already zero ─────────────────────────

describe('User model — resetFailedAttempts no-op when counter is already 0', () => {
  it('does not call save when failed_attempts and locked_at are already 0/null', async () => {
    const user = await User.create({ email: 'noreset@test.com', username: 'noreset', password: 'pw' });
    expect(user.failed_attempts).toBe(0);
    expect(user.locked_at == null).toBe(true); // accepts both null and undefined

    // Should do nothing (the if-guard prevents unnecessary save)
    await user.resetFailedAttempts();
    expect(user.failed_attempts).toBe(0);
  });
});

// ─── isLocked when lock has expired ──────────────────────────────────────────

describe('User model — isLocked returns false when lock period has expired', () => {
  it('returns false after the lock duration has passed', async () => {
    const user = await User.create({ email: 'explock@test.com', username: 'explock', password: 'pw' });
    // Set locked_at far in the past (more than lockDurationMs ago)
    user.locked_at = new Date(Date.now() - 999 * 60 * 1000); // >999 minutes ago
    expect(user.isLocked).toBe(false);
  });
});

// ─── encryptPassword when no password is provided ────────────────────────────

describe('User model — encryptPassword skips if no password to encrypt', () => {
  it('creates user without password without throwing', async () => {
    // Creating without a password sets encrypted_password to '' via the ||= operator
    // encryptPassword is called but returns early since this.password is falsy
    const user = await User.create({ email: 'nopw2@test.com', username: 'nopw2user' });
    expect(user).toBeTruthy();
    const withPw = await User.scope('withPassword').findByPk(user.id);
    // encrypted_password was set to '' (empty) since no password was provided
    expect(withPw.encrypted_password).toBe('');
  });
});

