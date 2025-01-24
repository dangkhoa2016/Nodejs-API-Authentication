const { loggerConfig } = require('../../config');  // Ensure that loggerConfig.js is properly configured
const colors = require('@colors/colors');
const { getConnInfo } = require('@hono/node-server/conninfo');

const loggerMiddleware = async (context, next) => {
  const method = colors.red(context.req.method);
  const url = colors.blue(context.req.path);
  const body = await context.req.json().catch(() => ({})); // Get the body, default to {} if there is no body

  // Log the request information
  const connectionInfo = getConnInfo(context);
  loggerConfig.info(`Request from: ${JSON.stringify(connectionInfo)}`);
  const headers = context.req.header();
  delete headers['accept'];
  delete headers['host'];
  loggerConfig.info(`Request headers: ${JSON.stringify(headers)}`);
  loggerConfig.info(`Request detail: ${method} ${url} - Body: ${JSON.stringify(body)}`);

  // Log query params (if any)
  const queryParams = context.req.query();
  if (Object.keys(queryParams).length > 0) {
    loggerConfig.info(`Query params: ${JSON.stringify(queryParams)}`);
  }

  context.connectionInfo = connectionInfo;
  // Proceed with processing the request and log the response result after completion
  await next();

  // Log the response information
  const status = colors.yellow(context.res.status);
  const contentType = colors.grey(context.res.headers.get('content-type'));
  if (['/json', 'text/'].some((type) => contentType.includes(type))) {
    const responseBody = await context.res.text();
    loggerConfig.info(`Response: ${status} - ${contentType} - Body: ${responseBody}`);
  } else
    loggerConfig.info(`Response: ${status} - ${contentType}`);
};

module.exports = loggerMiddleware;
