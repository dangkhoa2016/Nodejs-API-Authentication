'use strict';

const { HTTPException } = require('hono/http-exception');
const { cors } = require('hono/cors');
const { secureHeaders } = require('hono/secure-headers');
const { Hono } = require('hono');
const route = require('./app/routes');
const { loggerMiddleware } = require('./app/middleware');
const { sequelize } = require('./app/models');
const { appConfig } = require('./config');

const createApp = () => {
  const app = new Hono();
  const debug = require('debug')('nodejs-api-authentication:app');

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
        /* c8 ignore next -- statusCode is always a valid non-zero HTTP status code */
        errorHeader = statusCode ? 'Unauthorized' : 'Internal server error';
        errorMessage = err.message;
      }
    }

    return context.json({
      error: errorHeader,
      message: errorMessage,
    }, statusCode);
  });

  return app;
};

module.exports = { createApp, sequelize, appConfig };
