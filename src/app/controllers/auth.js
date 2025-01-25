const { Hono } = require('hono');
const jwt = require('hono/jwt');
const bcrypt = require('bcryptjs');
const { User, JwtDenylist } = require('../models');
const { getRouterName, showRoutes } = require('hono/dev');
const { authenticateMiddleware } = require('../middleware');
const debug = require('debug')('nodejs-api-authentication:controllers->auth');
const ms = require('ms');
const controller = new Hono();

// Register user
const handleRegister = async (context) => {
  const { username, password, email } = await context.req.json();
  if (!email)
    return context.json({ error: 'Email is required' }, 400);
  else if (!username || !password)
    return context.json({ error: 'Username and password are required' }, 400);

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await User.create({ email, username, encrypted_password: hashedPassword });
    delete user.dataValues.encrypted_password;
    return context.json({ message: 'User created successfully', user });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      debug('Error registering: SequelizeUniqueConstraintError', err);
      // return context.json({ error: 'Username or email already exists' })
      return context.json({ error: err['errors'][0]['message'] }, 400);
    } else if (err.name === 'SequelizeValidationError') {
      debug('Error registering: SequelizeValidationError', err);
      return context.json({ error: err['errors'][0]['message'] }, 400);
    }

    debug('Error registering: other', err);
    return context.json({ error: 'Error creating user' }, 400);
  }
};

controller.on(['POST'], ['/', '/register', '/sign_up'], handleRegister);

// Login and create JWT token
controller.on('POST', ['/sign_in', '/login'], async (context) => {
  const { username, password } = await context.req.json();
  if (!username || !password)
    return context.json({ error: 'Username and password are required' }, 400);

  try {
    const user = await User.scope('withPassword').findOne({ where: { username } });
    if (!user)
      return context.json({ error: 'Invalid credentials' }, 400);

    const isPasswordValid = await bcrypt.compare(password, user.encrypted_password);
    if (!isPasswordValid)
      return context.json({ error: 'Invalid credentials' }, 400);

    delete user.dataValues.encrypted_password;

    // update login stats
    const connectionInfo = context.connectionInfo;
    user.sign_in_count++;
    user.last_sign_in_at = user.current_sign_in_at;
    user.last_sign_in_ip = user.current_sign_in_ip;
    user.current_sign_in_at = new Date();
    user.current_sign_in_ip = connectionInfo.remote.address;
    await user.save();

    // create JWT token
    const now = Date.now() / 1e3 | 0;
    const payload = { id: user.id, username: user.username, exp: now + (ms('1h') / 1000), jti: user.id + '.' + now };
    debug('payload', payload);
    const token = await jwt.sign(payload, process.env.JWT_SECRET);

    return context.json({
      message: 'Login successful',
      token,
      user,
    });
  } catch (err) {
    debug('Error logging in', err);
    return context.json({ error: 'Error logging in' }, 500);
  }
});

// Logout user
const handleLogout = async (context) => {
  try {
    if (!context.user)
      return context.json({ error: 'User not found' }, 404);

    // add token to denylist
    const decoded_auth = context.get('jwtPayload');
    const jti = decoded_auth.jti;
    const exp = new Date(decoded_auth.exp * 1e3);
    await JwtDenylist.create({ jti, exp });

    return context.json({ message: 'Logout successful' });
  } catch (err) {
    debug('Error logging out', err);
    return context.json({ error: 'Error logging out' }, 500);
  }
};
controller.handleLogout = handleLogout;
controller.on(['DELETE', 'GET'], ['/sign_out', '/logout'], authenticateMiddleware, handleLogout);

// Get authenticated user profile
const handleShowProfile = async (context) => {
  try {
    if (!context.user)
      return context.json({ error: 'User not found' }, 404);

    return context.json(context.user);
  } catch (err) {
    debug('Error handling profile', err);
    return context.json({ error: 'Error fetching user profile' }, 500);
  }
};

controller.handleShowProfile = handleShowProfile;
controller.get('/profile', authenticateMiddleware, handleShowProfile);

// Delete user account
controller.delete('/', authenticateMiddleware, async (context) => {
  try {
    if (!context.user)
      return context.json({ error: 'User not found' }, 404);

    await context.user.destroy();
    return context.json({ message: 'Bye! Your account has been successfully cancelled. We hope to see you again soon.' });
  } catch (err) {
    debug('Error deleting user', err);
    return context.json({ error: 'Error deleting user' }, 500);
  }
});

// Update user profile
const handleUpdateProfile = async (context) => {
  try {
    if (!context.user)
      return context.json({ error: 'User not found' }, 404);

    let {
      username, email, password,
      first_name, last_name,
      role,
    } = await context.req.json();

    const updateFields = { username, email, first_name, last_name };
    if (role && context.user.isAdmin())
      updateFields.role = role;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.encrypted_password = hashedPassword;
    }

    await context.user.update(updateFields);

    delete context.user.dataValues.encrypted_password;
    return context.json({ message: 'Profile updated successfully', user: context.user });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      debug('Error updating profile: SequelizeUniqueConstraintError', err);
      // return context.json({ error: 'Username or email already exists' })
      return context.json({ error: err['errors'][0]['message'] }, 400);
    } else if (err.name === 'SequelizeValidationError') {
      debug('Error updating profile: SequelizeValidationError', err);
      return context.json({ error: err['errors'][0]['message'] }, 400);
    }

    debug('Error updating profile: other', err);
    return context.json({ error: 'Error creating user' }, 400);
  }
};

controller.on(['PUT', 'PATCH'], ['/', '/profile'], authenticateMiddleware, handleUpdateProfile);


debug(getRouterName(controller));
showRoutes(controller, {
  verbose: true,
});

module.exports = controller;
