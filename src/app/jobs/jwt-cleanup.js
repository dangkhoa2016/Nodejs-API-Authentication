'use strict';

const { Op } = require('sequelize');
const debug = require('debug')('nodejs-api-authentication:jobs->jwt-cleanup');

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Starts a periodic job that deletes expired JWT denylist entries
 * and revoked/expired refresh tokens.
 * This prevents both tables from growing indefinitely.
 *
 * @param {object} JwtDenylist - The Sequelize JwtDenylist model
 * @param {number} [intervalMs] - How often to run (ms). Defaults to 1 hour.
 * @param {object} [RefreshToken] - Optional Sequelize RefreshToken model
 * @returns {NodeJS.Timeout} The interval handle (call clearInterval to stop)
 */
const startJwtCleanupJob = (JwtDenylist, intervalMs = DEFAULT_INTERVAL_MS, RefreshToken = null) => {
  const run = async () => {
    try {
      const deletedDenylist = await JwtDenylist.destroy({
        where: { exp: { [Op.lt]: new Date() } },
      });
      if (deletedDenylist > 0)
        debug(`JWT cleanup: removed ${deletedDenylist} expired denylist token(s)`);
    } catch (err) {
      debug('JWT denylist cleanup error:', err.message);
    }

    if (RefreshToken) {
      try {
        const deletedRefresh = await RefreshToken.destroy({
          where: {
            [Op.or]: [
              { expires_at: { [Op.lt]: new Date() } },
              { revoked_at: { [Op.ne]: null } },
            ],
          },
        });
        if (deletedRefresh > 0)
          debug(`JWT cleanup: removed ${deletedRefresh} expired/revoked refresh token(s)`);
      } catch (err) {
        debug('Refresh token cleanup error:', err.message);
      }
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
