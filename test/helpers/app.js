'use strict';

const { createApp, sequelize } = require('../../src/create-app');

let app;

/**
 * Returns a configured Hono app instance for integration tests.
 * Syncs the in-memory SQLite schema on first call.
 */
const getTestApp = async () => {
  if (!app) {
    await sequelize.sync({ force: true });
    app = createApp();
  }
  return app;
};

/**
 * Reset all tables between test suites to ensure isolation.
 */
const resetDatabase = async () => {
  const { User, JwtDenylist } = require('../../src/app/models');
  await JwtDenylist.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
};

/**
 * Helper: perform a JSON request against the test app.
 */
const request = async (method, path, { body, token } = {}) => {
  const testApp = await getTestApp();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return testApp.request(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
};

module.exports = { getTestApp, resetDatabase, request, sequelize };
