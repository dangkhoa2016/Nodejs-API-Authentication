'use strict';

// Tests for src/app/services/user.service.js
// Covers: line 22 — return null for unknown errors in handleSequelizeError
//         lines 45-46 — fallthrough to generic 500 response in createUser
const { createUser, handleSequelizeError } = require('../../../src/app/services/user.service');

// Minimal mock context that mimics Hono's context.json()
const makeContext = () => {
  let _body, _status;
  return {
    json(body, status) {
      _body = body;
      _status = status;
      return { body, status };
    },
    get body() { return _body; },
    get status() { return _status; },
  };
};

describe('handleSequelizeError — unknown error type', () => {
  it('returns null when the error is not a Sequelize constraint/validation error (line 22)', () => {
    const ctx = makeContext();
    const err = new Error('some generic database error');
    err.name = 'SomeOtherError';
    const result = handleSequelizeError(ctx, err, 'testing');
    expect(result).toBeNull();
  });
});

describe('createUser — generic error fallthrough', () => {
  it('returns 500 when User.create throws a non-Sequelize error (lines 45-46)', async () => {
    // Temporarily replace User.create to throw a non-Sequelize error
    const models = require('../../../src/app/models');
    const original = models.User.create;
    models.User.create = async () => { throw new Error('unexpected DB failure'); };

    try {
      const ctx = makeContext();
      const result = await createUser(ctx, {
        email: 'fail@test.com',
        username: 'failuser',
        password: 'pw123456',
        role: 'user',
      });
      expect(result.status).toBe(500);
      expect(result.body).toEqual({ error: 'Error creating user' });
    } finally {
      models.User.create = original;
    }
  });
});
