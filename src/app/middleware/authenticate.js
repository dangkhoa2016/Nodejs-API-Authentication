const { jwt } = require('hono/jwt');
const { User, JwtDenylist } = require('../models');
// const debug = require('debug')('nodejs-api-authentication:middleware->authenticate');

const jwtMiddleware = jwt({
  secret: process.env.JWT_SECRET,
});

const handlePayload = async (context) => {
  const decoded = context.get('jwtPayload');
  if (!decoded)
    return;

  const jwtDenylist = await JwtDenylist.findOne({ where: { jti: decoded.jti } });
  if (jwtDenylist) {
    context.res = new Response(JSON.stringify({ error: 'Token revoked' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    return;
  }

  const user = await User.findByPk(decoded.id);
  if (!user) {
    context.res = new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return;
  }

  context.user = user;
};

const authenticateMiddleware = async (context, next) => {
  await jwtMiddleware(context, () => {});
  await handlePayload(context);
  await next();
};

module.exports = authenticateMiddleware;
