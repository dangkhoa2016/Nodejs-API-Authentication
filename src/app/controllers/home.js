const { Hono } = require('hono');
const { getRouterName, showRoutes } = require('hono/dev');
const debug = require('debug')('nodejs-api-authentication:controllers->home');
const controller = new Hono();
const path = require('path');
const mime = require('hono/utils/mime');
const fs = require('fs');

controller.get('/', (context) => context.json({ message: 'Welcome to the Node.js API Authentication' }));

const publicFolder = path.join(__dirname, '../../public');

const createStreamBody = (stream) => {
  const body = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => {
        controller.enqueue(chunk);
      });
      stream.on('end', () => {
        controller.close();
      });
    },
    cancel() {
      stream.destroy();
    },
  });
  return body;
};

const handleFile = (context, filePath) => {
  const file = path.join(publicFolder, filePath);
  const stats = fs.lstatSync(file);
  const mimeType = mime.getMimeType(file);
  context.header('Content-Type', mimeType || 'application/octet-stream');
  const size = stats.size;

  if (context.req.method === 'HEAD' || context.req.method === 'OPTIONS') {
    context.header('Content-Length', size.toString());
    context.status(200);
    return context.body(null);
  }

  const range = context.req.header('range') || '';
  if (!range) {
    context.header('Content-Length', size.toString());
    return context.body(createStreamBody(fs.createReadStream(file)), 200);
  }

  context.header('Accept-Ranges', 'bytes');
  context.header('Date', stats.birthtime.toUTCString());
  const parts = range.replace(/bytes=/, '').split('-', 2);
  const start = parts[0] ? parseInt(parts[0], 10) : 0;
  let end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
  if (size < end - start + 1) {
    end = size - 1;
  }
  const chunksize = end - start + 1;
  const stream = fs.createReadStream(file, { start, end });
  context.header('Content-Length', chunksize.toString());
  context.header('Content-Range', `bytes ${start}-${end}/${stats.size}`);
  return context.body(createStreamBody(stream), 206);
};

controller.all('/favicon.ico', (context) => {
  return handleFile(context, 'favicon.ico');
});

controller.all('/favicon.png', (context) => {
  return handleFile(context, 'favicon.png');
});


debug(getRouterName(controller));
showRoutes(controller, {
  verbose: true,
});

module.exports = controller;
