const { Hono } = require('hono');
const { User } = require('../models');
const { getRouterName, showRoutes } = require('hono/dev');
const debug = require('debug')('nodejs-api-authentication:controllers->user');
const { Op } = require('sequelize');
const controller = new Hono();

// Create user
const handleCreate = async (context) => {
  const { username, password, email } = await context.req.json();
  if (!email)
    return context.json({ error: 'Email is required' }, 400);
  else if (!username || !password)
    return context.json({ error: 'Username and password are required' }, 400);

  try {
    const user = await User.create({ email, username, password });
    return context.json({ message: 'User created successfully', user });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      debug('Error creating user: SequelizeUniqueConstraintError', err);
      return context.json({ error: err['errors'][0]['message'] }, 400);
    } else if (err.name === 'SequelizeValidationError') {
      debug('Error creating user: SequelizeValidationError', err);
      return context.json({ error: err['errors'][0]['message'] }, 400);
    }

    debug('Error creating user: other', err);
    return context.json({ error: 'Error creating user' }, 400);
  }
};

controller.on(['POST'], ['/create'], handleCreate);


// Update user
const handleUpdate = async (context) => {
  const user = await User.findByPk(context.req.param('id'));
  if (!user)
    return context.json({ error: 'User not found' }, 404);

  const {
    username, email, password,
    first_name, last_name,
    role,
  } = await context.req.json();

  const updateFields = { username, email, first_name, last_name, role };

  if (password)
    updateFields.password = password;

  try {
    await user.update(updateFields);
    return context.json({ message: 'User updated successfully', user });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      debug('Error creating user: SequelizeUniqueConstraintError', err);
      return context.json({ error: err['errors'][0]['message'] }, 400);
    } else if (err.name === 'SequelizeValidationError') {
      debug('Error creating user: SequelizeValidationError', err);
      return context.json({ error: err['errors'][0]['message'] }, 400);
    }

    debug('Error updaing user: other', err);
    return context.json({ error: 'Error updaing user' }, 400);
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
  const { q = '', page = 1, limit = 10 } = context.req.query();

  try {
    const { count, rows: users } = await User.findAndCountAll({
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


debug(getRouterName(controller));
showRoutes(controller, {
  verbose: true,
});

module.exports = controller;
