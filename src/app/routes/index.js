
const controllers = require('../controllers');
const { authenticateMiddleware, checkPermissionMiddleware } = require('../middleware');
const { every } = require('hono/combine');
// const debug = require('debug')('nodejs-api-authentication:routes');
const { Hono } = require('hono');
const route = new Hono();

// ─── /v1 versioned routes ─────────────────────────────────────────────────────
const v1 = new Hono();

// New v1-only auth flows: /v1/auth/refresh, /v1/auth/forgot-password, etc.
v1.route('/auth', controllers.authExtraController);

// Mirror existing user auth routes under /v1
v1.route('/users', controllers.authController);
v1.get('/user/me',     authenticateMiddleware, controllers.authController.handleShowProfile);
v1.get('/user/whoami', authenticateMiddleware, controllers.authController.handleShowProfile);

// Mirror admin user management under /v1
v1.use('/users/*', every(authenticateMiddleware, checkPermissionMiddleware));
v1.route('/users', controllers.userController);

route.route('/v1', v1);

// ─── Legacy root routes (backward-compat) ─────────────────────────────────────
// API handler for registering and logging in users
route.route('/users', controllers.authController);
route.get('/user/me', authenticateMiddleware, controllers.authController.handleShowProfile);
route.get('/user/whoami', authenticateMiddleware, controllers.authController.handleShowProfile);

// API handler for managing users
route.use('/users/*', every(authenticateMiddleware, checkPermissionMiddleware));
route.route('/users', controllers.userController);

// API handler for the home route (health, docs, static assets)
route.route('/', controllers.homeController);

module.exports = route;
