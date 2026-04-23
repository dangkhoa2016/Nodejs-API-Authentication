'use strict';

const { Op } = require('sequelize');
const debug = require('debug')('nodejs-api-authentication:jobs->jwt-cleanup');

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Starts a periodic job that deletes expired JWT denylist entries.
 * This prevents the jwt_denylists table from growing indefinitely.
 *
 * @param {object} JwtDenylist - The Sequelize JwtDenylist model
 * @param {number} [intervalMs] - How often to run (ms). Defaults to 1 hour.
 * @returns {NodeJS.Timeout} The interval handle (call clearInterval to stop)
 */
const startJwtCleanupJob = (JwtDenylist, intervalMs = DEFAULT_INTERVAL_MS) => {
  const run = async () => {
    try {
      const deleted = await JwtDenylist.destroy({
        where: { exp: { [Op.lt]: new Date() } },
      });
      if (deleted > 0)
        debug(`JWT cleanup: removed ${deleted} expired token(s)`);
    } catch (err) {
      debug('JWT cleanup error:', err.message);
    }
  };

  // Run once immediately on startup, then on schedule
  run();

  const handle = setInterval(run, intervalMs);

  // Allow Node to exit without waiting for this interval
  if (handle.unref) handle.unref();

  debug(`JWT cleanup job started — interval: ${intervalMs / 1000}s`);
  return handle;
};

module.exports = { startJwtCleanupJob };
