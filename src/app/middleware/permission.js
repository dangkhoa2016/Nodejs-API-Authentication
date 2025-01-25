// const { User, } = require('../models')
const debug = require('debug')('nodejs-api-authentication:middleware->permission');

const checkPermission = async (context, next) => {
  const user = context.user;
  if (!user)
    return context.json({ error: 'User not found' }, 404);

  debug('User role:', user.role);
  if (user.isAdmin)
    return await next();
  else
    return context.json({ error: 'You must be an administrator to perform this action' }, 403);
};

module.exports = checkPermission;
