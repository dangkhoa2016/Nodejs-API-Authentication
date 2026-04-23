require('dotenv').config();

const { validate: validateEnv } = require('./config/validate-env');
validateEnv();

const { serve } = require('@hono/node-server');
const colors = require('@colors/colors');
const debug = require('debug')('nodejs-api-authentication:server');
const { createApp, sequelize, appConfig } = require('./create-app');
const { JwtDenylist } = require('./app/models');
const { startJwtCleanupJob } = require('./app/jobs/jwt-cleanup');

const app = createApp();

const startServer = () => {
  const cleanupIntervalMs = parseInt(process.env.JWT_CLEANUP_INTERVAL_MS || String(60 * 60 * 1000), 10);
  startJwtCleanupJob(JwtDenylist, cleanupIntervalMs);

  serve({
    fetch: app.fetch,
    port: process.env.PORT || 4000,
  }, (info) => {
    const url = colors.yellow(`http://localhost:${info.port}`);
    debug(`Server started at ${colors.green(new Date())} and listening on ${url}`);
  });
};

// In development/test: auto-sync schema for convenience.
// In production: migrations must be run manually before starting.
if (appConfig.isDevelopment || appConfig.isTest) {
  sequelize.sync({ force: false }).then(() => {
    debug(`Database synced! at ${colors.green(new Date())}`);
    startServer();
  });
} else {
  startServer();
}
