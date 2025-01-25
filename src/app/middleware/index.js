const loggerMiddleware = require('./logger');
const authenticateMiddleware = require('./authenticate');
const checkPermissionMiddleware = require('./permission');

module.exports = {
  loggerMiddleware,
  authenticateMiddleware,
  checkPermissionMiddleware,
};
