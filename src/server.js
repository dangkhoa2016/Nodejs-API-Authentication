require('dotenv').config();

const { HTTPException } = require('hono/http-exception');
const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const colors = require('@colors/colors');
const app = new Hono();
const route = require('./app/routes');
const debug = require('debug')('nodejs-api-authentication:server');
const { loggerMiddleware } = require('./app/middleware');

app.use(loggerMiddleware);

// console.log('route', route)
app.route('/', route);

app.notFound((context) => {
  debug('Route not found', context.req.url);
  return context.json({ error: 'Route not found' }, 404);
});

app.onError((err, context) => {
  debug('Unhandled error', err);

  let statusCode = 500;
  let errorHeader = 'Internal server error';
  let errorMessage = err.message;

  if (err instanceof HTTPException) {
    // Get the custom response
    // return err.res

    // debug(err)
    err.res.headers.forEach((value, key) => {
      // debug(key, value);
      context.header(key, value);
    });

    statusCode = err.status;
    if (err.cause) {
      errorHeader = err.message;
      errorMessage = err.cause.message;
    } else {
      errorHeader = statusCode ? 'Unauthorized' : 'Internal server error';
      errorMessage = err.message;
    }
  }

  return context.json({
    error: errorHeader,
    message: errorMessage,
  }, statusCode);
});

// Start server
serve({
  fetch: app.fetch,
  port: process.env.PORT || 4000,
}, (info) => {
  const url = colors.yellow(`http://localhost:${info.port}`);
  debug(`Server started at ${colors.green(new Date())} and listening on ${url}`);
});
