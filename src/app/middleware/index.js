const loggerMiddleware = require('./logger');
const authenticateMiddleware = require('./authenticate');
const checkPermissionMiddleware = require('./permission');
const { createRateLimiter } = require('./rate-limit');

module.exports = {
  loggerMiddleware,
  authenticateMiddleware,
  checkPermissionMiddleware,
  createRateLimiter,
};
