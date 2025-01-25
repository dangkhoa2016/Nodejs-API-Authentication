
const { homeController, authController } = require('../controllers');
const { authenticateMiddleware } = require('../middleware');
// const debug = require('debug')('nodejs-api-authentication:routes');
const { Hono } = require('hono');
const route = new Hono();

// API handler for registering and logging in users
route.route('/users', authController);
route.get('/user/me', authenticateMiddleware, authController.handleShowProfile);
route.get('/user/whoami', authenticateMiddleware, authController.handleShowProfile);

// API handler for the home route
route.route('/', homeController);

module.exports = route;
