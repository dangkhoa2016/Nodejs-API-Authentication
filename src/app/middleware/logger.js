const { loggerConfig } = require('../../config');  // Ensure that loggerConfig.js is properly configured
const colors = require('@colors/colors');
const { getConnInfo } = require('@hono/node-server/conninfo');

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'encrypted_password', 'authorization'];

const sanitize = (obj) => {
  /* c8 ignore next -- null/non-object guard; in practice obj is always a valid request body object */
  if (!obj || typeof obj !== 'object') return obj;
  const clone = { ...obj };
  for (const field of SENSITIVE_FIELDS) {
    if (field in clone) clone[field] = '[REDACTED]';
  }
  return clone;
};

const loggerMiddleware = async (context, next) => {
  const method = colors.red(context.req.method);
  const url = colors.blue(context.req.path);
  const body = await context.req.json().catch(() => ({})); // Get the body, default to {} if there is no body

  // Log the request information — getConnInfo may throw in test environments (no TCP connection)
  let connectionInfo = {};
  try {
    /* c8 ignore next -- getConnInfo always throws in tests (no TCP), so the || fallback is unreachable here */
    connectionInfo = getConnInfo(context) || {};
  } catch {
    connectionInfo = {};
  }
  loggerConfig.info(`Request from: ${JSON.stringify(connectionInfo)}`);
  const headers = context.req.header();
  delete headers['accept'];
  delete headers['host'];
  loggerConfig.info(`Request headers: ${JSON.stringify(sanitize(headers))}`);
  loggerConfig.info(`Request detail: ${method} ${url} - Body: ${JSON.stringify(sanitize(body))}`);

  // Log query params (if any)
  const queryParams = context.req.query();
  if (Object.keys(queryParams).length > 0) {
    loggerConfig.info(`Query params: ${JSON.stringify(queryParams)}`);
  }

  context.connectionInfo = connectionInfo;
  // Proceed with processing the request and log the response result after completion
  await next();

  // Log the response information — clone before reading to avoid consuming the stream
  const status = colors.yellow(context.res.status);
  const contentType = colors.grey(context.res.headers.get('content-type') || '');
  try {
    if (['/json', 'text/'].some((type) => contentType.includes(type))) {
      const cloned = context.res.clone();
      const responseBody = await cloned.text();
      loggerConfig.info(`Response: ${status} - ${contentType} - Body: ${responseBody}`);
    } else {
      loggerConfig.info(`Response: ${status} - ${contentType}`);
    }
  } catch { /* c8 ignore next -- catch body only reached if Response.clone().text() throws */
    loggerConfig.info(`Response: ${status} - ${contentType}`);
  }
};

module.exports = loggerMiddleware;
