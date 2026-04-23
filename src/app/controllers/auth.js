const { Hono } = require('hono');
const jwt = require('hono/jwt');
const crypto = require('crypto');
const { User, JwtDenylist, RefreshToken } = require('../models');
const { getRouterName, showRoutes } = require('hono/dev');
const { authenticateMiddleware } = require('../middleware');
const { createRateLimiter } = require('../middleware');
const { createUser, handleSequelizeError } = require('../services/user.service');
const debug = require('debug')('nodejs-api-authentication:controllers->auth');
const ms = require('ms');
const { appConfig } = require('../../config');
const controller = new Hono();

const loginRateLimiter = createRateLimiter({
  windowMs: 60_000,   // 1 minute window
  max: parseInt(process.env.LOGIN_RATE_LIMIT || '5', 10),
  message: 'Too many login attempts, please try again in 1 minute',
});

// Register user
const handleRegister = async (context) => {
  const { username, password, email } = await context.req.json();
  return createUser(context, { email, username, password });
};

controller.on(['POST'], ['/', '/register', '/sign_up'], handleRegister);

// Login and create JWT token
controller.on('POST', ['/sign_in', '/login'], loginRateLimiter, async (context) => {
  const { username, password } = await context.req.json();
  if (!username || !password)
    return context.json({ error: 'Username and password are required' }, 400);

  try {
    const user = await User.findOne({ where: { username } });
    if (!user)
      return context.json({ error: 'Invalid credentials' }, 400);

    // Check account lockout before validating password
    if (user.isLocked) {
      const lockDurationMin = Math.round(parseInt(process.env.ACCOUNT_LOCK_DURATION_MS || String(30 * 60 * 1000), 10) / 60000);
      return context.json({
        error: 'Account locked',
        message: `Too many failed login attempts. Account is locked for ${lockDurationMin} minutes.`,
      }, 423);
    }

    const isPasswordValid = await user.validPassword(password);
    if (!isPasswordValid) {
      await user.incrementFailedAttempts();
      return context.json({ error: 'Invalid credentials' }, 400);
    }

    // Successful login — reset lockout counters
    await user.resetFailedAttempts();

    // Update login stats
    const connectionInfo = context.connectionInfo || {};
    user.sign_in_count++;
    user.last_sign_in_at = user.current_sign_in_at;
    user.last_sign_in_ip = user.current_sign_in_ip;
    user.current_sign_in_at = new Date();
    user.current_sign_in_ip = connectionInfo?.remote?.address || null;
    await user.save();

    // Create JWT access token
    const now = Date.now() / 1e3 | 0;
    const payload = { id: user.id, username: user.username, exp: now + (ms('1h') / 1000), jti: user.id + '.' + now };
    debug('payload', payload);
    const token = await jwt.sign(payload, process.env.JWT_SECRET);

    // Create refresh token (7 day lifetime)
    const refreshTokenValue = crypto.randomBytes(64).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + ms('7d'));
    await RefreshToken.create({ token: refreshTokenValue, user_id: user.id, expires_at: refreshExpiresAt });

    return context.json({
      message: 'Login successful',
      token,
      refresh_token: refreshTokenValue,
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

    // Add access token jti to denylist
    const decoded_auth = context.get('jwtPayload');
    const jti = decoded_auth.jti;
    const exp = new Date(decoded_auth.exp * 1e3);
    await JwtDenylist.create({ jti, exp });

    // Revoke refresh token if provided in body
    const body = await context.req.json().catch(() => ({}));
    const refresh_token = body?.refresh_token;
    if (refresh_token) {
      const tokenRecord = await RefreshToken.findOne({ where: { token: refresh_token } });
      if (tokenRecord && tokenRecord.isValid)
        await tokenRecord.update({ revoked_at: new Date() });
    }

    return context.json({ message: 'Logout successful' });
  } catch (err) {
    debug('Error logging out', err);
    return context.json({ error: 'Error logging out' }, 500);
  }
};
controller.handleLogout = handleLogout;
controller.on(['DELETE', 'POST'], ['/sign_out', '/logout'], authenticateMiddleware, handleLogout);

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

    const {
      username, email, password,
      first_name, last_name,
    } = await context.req.json();

    const updateFields = { username, email, first_name, last_name };

    if (password)
      updateFields.password = password;

    await context.user.update(updateFields);

    return context.json({ message: 'Profile updated successfully', user: context.user });
  } catch (err) {
    const handled = handleSequelizeError(context, err, 'updating profile');
    if (handled) return handled;

    debug('Error updating profile: other', err);
    return context.json({ error: 'Error updating profile' }, 500);
  }
};

controller.on(['PUT', 'PATCH'], ['/', '/profile'], authenticateMiddleware, handleUpdateProfile);


if (appConfig.isDevelopment) {
  debug(getRouterName(controller));
  showRoutes(controller, { verbose: true });
}

module.exports = controller;
