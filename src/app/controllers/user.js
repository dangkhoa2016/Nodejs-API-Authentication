const { Hono } = require('hono');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { getRouterName, showRoutes } = require('hono/dev');
const debug = require('debug')('nodejs-api-authentication:controllers->user');
const { Op } = require('sequelize');
const { createUser, handleSequelizeError } = require('../services/user.service');
const { appConfig } = require('../../config');
const controller = new Hono();

// Create user
const handleCreate = async (context) => {
  const { username, password, email, role } = await context.req.json();
  return createUser(context, { email, username, password, role });
};

controller.on(['POST'], ['/create'], handleCreate);


// Update user
const handleUpdate = async (context) => {
  const user = await User.findByPk(context.req.param('id'), {
    attributes: User.allowDisplayColumns,
  });
  if (!user)
    return context.json({ error: 'User not found' }, 404);

  const {
    username, email, password,
    first_name, last_name,
    role,
  } = await context.req.json();

  const updateFields = { username, email, first_name, last_name, role };

  if (password) {
    // Hash directly so encrypted_password is an explicit changed field in the UPDATE
    updateFields.encrypted_password = await bcrypt.hash(password, appConfig.hashSalt);
  }

  try {
    await user.update(updateFields);
    return context.json({ message: 'User updated successfully', user });
  } catch (err) {
    const handled = handleSequelizeError(context, err, 'updating user');
    if (handled) return handled;

    debug('Error updating user: other', err);
    return context.json({ error: 'Error updating user' }, 500);
  }
};

controller.on(['PUT', 'PATCH'], ['/:id{[0-9]+}'], handleUpdate);


// Delete user
const handleDelete = async (context) => {
  try {
    const id = context.req.param('id');
    let message = '';
    let result = await User.destroy({
      where: { id },
    });

    if (!result)
      message = 'User deleted successfully. Note: User not found';
    else
      message = `User with id: ${id} has been deleted successfully`;

    return context.json({ message });
  } catch (err) {
    debug('Error deleting user: other', err);
    return context.json({ error: 'Error deleting user' }, 400);
  }
};

controller.on(['DELETE', 'POST'], ['/:id{[0-9]+}/destroy', '/:id{[0-9]+}/delete'], handleDelete);
controller.on(['DELETE'], ['/:id{[0-9]+}'], handleDelete);


// Get all users
const handleGetAll = async (context) => {
  const query = context.req.query();
  const q = query.q || '';
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);

  try {
    const { count, rows: users } = await User.findAndCountAll({
      attributes: User.allowDisplayColumns,
      where: {
        [Op.or]: [
          { username: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
        ],
      },
      limit,
      offset: (page - 1) * limit,
    });

    return context.json({ count, users });
  } catch (err) {
    debug('Error getting users', err);
    return context.json({ error: 'Error getting users' }, 400);
  }
};

controller.on(['GET'], ['/', '/all'], handleGetAll);


/* c8 ignore next 4 */
if (appConfig.isDevelopment) {
  debug(getRouterName(controller));
  showRoutes(controller, { verbose: true });
}

module.exports = controller;
