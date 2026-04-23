require('dotenv').config();

const { validate: validateEnv } = require('./config/validate-env');
validateEnv();

const { HTTPException } = require('hono/http-exception');
const { cors } = require('hono/cors');
const { secureHeaders } = require('hono/secure-headers');
const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const colors = require('@colors/colors');
const app = new Hono();
const route = require('./app/routes');
const debug = require('debug')('nodejs-api-authentication:server');
const { loggerMiddleware } = require('./app/middleware');
const { sequelize } = require('./app/models');
const { appConfig } = require('./config');
const { JwtDenylist } = require('./app/models');
const { startJwtCleanupJob } = require('./app/jobs/jwt-cleanup');

app.use(secureHeaders());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:4000'];

app.use(cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(loggerMiddleware);

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
    err.res.headers.forEach((value, key) => {
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
