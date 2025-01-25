
const controllers = require('../controllers');
const { authenticateMiddleware, checkPermissionMiddleware } = require('../middleware');
const { every } = require('hono/combine');
// const debug = require('debug')('nodejs-api-authentication:routes');
const { Hono } = require('hono');
const route = new Hono();

// API handler for registering and logging in users
route.route('/users', controllers.authController);
route.get('/user/me', authenticateMiddleware, controllers.authController.handleShowProfile);
route.get('/user/whoami', authenticateMiddleware, controllers.authController.handleShowProfile);

// API handler for managing users
route.use('/users/*', every(authenticateMiddleware, checkPermissionMiddleware));
route.route('/users', controllers.userController);

// API handler for the home route
route.route('/', controllers.homeController);

module.exports = route;
