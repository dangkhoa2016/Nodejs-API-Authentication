'use strict';

const { User } = require('../models');
const debug = require('debug')('nodejs-api-authentication:services->user');

/**
 * Handle Sequelize validation/unique constraint errors and return a JSON error response.
 * Returns null if the error is not a handled Sequelize error (caller should handle it).
 */
const handleSequelizeError = (context, err, action = 'processing') => {
  if (err.name === 'SequelizeUniqueConstraintError') {
    debug(`Error ${action}: SequelizeUniqueConstraintError`, err);
    return context.json({ error: err.errors[0].message }, 400);
  }

  if (err.name === 'SequelizeValidationError') {
    debug(`Error ${action}: SequelizeValidationError`, err);
    return context.json({ error: err.errors[0].message }, 400);
  }

  return null;
};

/**
 * Create a new user with the given fields.
 * Returns { user } on success, or a JSON error response on failure.
 */
const createUser = async (context, { email, username, password, role }) => {
  if (!email)
    return context.json({ error: 'Email is required' }, 400);

  if (!username || !password)
    return context.json({ error: 'Username and password are required' }, 400);

  try {
    const user = await User.create({ email, username, password, role });
    return context.json({ message: 'User created successfully', user }, 201);
  } catch (err) {
    const handled = handleSequelizeError(context, err, 'creating user');
    if (handled) return handled;

    debug('Error creating user: other', err);
    return context.json({ error: 'Error creating user' }, 500);
  }
};

module.exports = { createUser, handleSequelizeError };
