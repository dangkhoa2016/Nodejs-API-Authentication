
const { homeController } = require('../controllers');
// const debug = require('debug')('nodejs-api-authentication:routes');
const { Hono } = require('hono');
const route = new Hono();

// API handler for the home route
route.route('/', homeController);

module.exports = route;
