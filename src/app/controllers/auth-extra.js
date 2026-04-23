'use strict';

/**
 * auth-extra controller — v1 auth flows:
 *   POST /v1/auth/refresh              — Rotate refresh token and issue new access token
 *   POST /v1/auth/forgot-password      — Initiate password reset
 *   POST /v1/auth/reset-password       — Complete password reset with token
 *   POST /v1/auth/confirm-email        — Confirm email address with token
 *   POST /v1/auth/resend-confirmation  — Resend email confirmation token
 */

const { Hono } = require('hono');
const jwt = require('hono/jwt');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User, RefreshToken } = require('../models');
const { getRouterName, showRoutes } = require('hono/dev');
const debug = require('debug')('nodejs-api-authentication:controllers->auth-extra');
const ms = require('ms');
const { appConfig } = require('../../config');

const controller = new Hono();

// ─── POST /refresh ──────────────────────────────────────────────────────────
// Validates a refresh token, rotates it, and returns a new access + refresh token.
controller.post('/refresh', async (context) => {
  const body = await context.req.json().catch(() => ({}));
  const refresh_token = body?.refresh_token;

  if (!refresh_token)
    return context.json({ error: 'Refresh token is required' }, 400);

  try {
    const tokenRecord = await RefreshToken.findOne({ where: { token: refresh_token } });

    if (!tokenRecord || !tokenRecord.isValid)
      return context.json({ error: 'Invalid or expired refresh token' }, 401);

    const user = await User.findByPk(tokenRecord.user_id);
    /* c8 ignore next 2 -- cascade delete removes refresh tokens when user is deleted */
    if (!user)
      return context.json({ error: 'User not found' }, 404);

    // Rotate: revoke old token, issue new pair
    const now = Date.now() / 1e3 | 0;
    const newJti = user.id + '.' + now + '.' + crypto.randomBytes(4).toString('hex');
    const newAccessToken = await jwt.sign(
      { id: user.id, username: user.username, exp: now + (ms('1h') / 1000), jti: newJti },
      process.env.JWT_SECRET,
    );

    const newRefreshTokenValue = crypto.randomBytes(64).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + ms('7d'));

    await tokenRecord.update({ revoked_at: new Date(), replaced_by: newRefreshTokenValue });
    await RefreshToken.create({ token: newRefreshTokenValue, user_id: user.id, expires_at: refreshExpiresAt });

    return context.json({ token: newAccessToken, refresh_token: newRefreshTokenValue });
  } catch (err) {
    debug('Error refreshing token', err);
    return context.json({ error: 'Error refreshing token' }, 500);
  }
});

// ─── POST /forgot-password ───────────────────────────────────────────────────
// Generates a password reset token (valid 2h) and stores it on the user.
// In production, this would trigger an email. In dev, the token is returned directly.
controller.post('/forgot-password', async (context) => {
  const body = await context.req.json().catch(() => ({}));
  const email = body?.email;

  if (!email)
    return context.json({ error: 'Email is required' }, 400);

  try {
    const user = await User.scope('withPassword').findOne({ where: { email } });

    // Always return the same message to prevent user enumeration
    const genericResponse = { message: 'If an account with that email exists, a reset link has been sent' };

    if (!user)
      return context.json(genericResponse);

    const token = crypto.randomBytes(32).toString('hex');
    await user.update({ reset_password_token: token, reset_password_sent_at: new Date() });

    debug(`Password reset token generated for user id=${user.id}`);

    // In development/test, expose the token so it can be tested without an email service
    /* c8 ignore next -- isDevelopment short-circuit branch only in dev environments, not during test runs */
    if (appConfig.isDevelopment || appConfig.isTest)
      return context.json({ ...genericResponse, debug_token: token });

    /* c8 ignore next -- only reached in production (isTest is always true in tests) */
    return context.json(genericResponse);
  } catch (err) {
    debug('Error in forgot-password', err);
    return context.json({ error: 'Error processing request' }, 500);
  }
});

// ─── POST /reset-password ────────────────────────────────────────────────────
// Validates the reset token and sets a new password.
controller.post('/reset-password', async (context) => {
  const body = await context.req.json().catch(() => ({}));
  const { token, password } = body;

  if (!token || !password)
    return context.json({ error: 'Token and password are required' }, 400);

  try {
    const user = await User.findOne({ where: { reset_password_token: token } });

    if (!user)
      return context.json({ error: 'Invalid or expired reset token' }, 400);

    const tokenAge = Date.now() - new Date(user.reset_password_sent_at).getTime();
    if (tokenAge > ms('2h'))
      return context.json({ error: 'Reset token has expired' }, 400);

    // Hash the new password directly so the encrypted value is an explicit field
    // in the UPDATE (Sequelize captures changed fields before beforeValidate runs)
    const hashedPassword = await bcrypt.hash(password, appConfig.hashSalt);
    await user.update({ encrypted_password: hashedPassword, reset_password_token: null, reset_password_sent_at: null });

    return context.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    debug('Error resetting password', err);
    return context.json({ error: 'Error resetting password' }, 500);
  }
});

// ─── POST /confirm-email ─────────────────────────────────────────────────────
// Verifies an email confirmation token and marks the email as confirmed.
controller.post('/confirm-email', async (context) => {
  const body = await context.req.json().catch(() => ({}));
  const token = body?.token;

  if (!token)
    return context.json({ error: 'Confirmation token is required' }, 400);

  try {
    const user = await User.findOne({ where: { confirmation_token: token } });

    if (!user)
      return context.json({ error: 'Invalid or expired confirmation token' }, 400);

    /* c8 ignore next 2 -- unreachable: confirmation_token is cleared on first confirmation, so a valid token can't belong to an already-confirmed user */
    if (user.confirmed_at)
      return context.json({ message: 'Email is already confirmed' });

    await user.update({ confirmed_at: new Date(), confirmation_token: null });

    return context.json({ message: 'Email confirmed successfully' });
  } catch (err) {
    debug('Error confirming email', err);
    return context.json({ error: 'Error confirming email' }, 500);
  }
});

// ─── POST /resend-confirmation ───────────────────────────────────────────────
// Regenerates and resends the email confirmation token for an unconfirmed account.
controller.post('/resend-confirmation', async (context) => {
  const body = await context.req.json().catch(() => ({}));
  const email = body?.email;

  if (!email)
    return context.json({ error: 'Email is required' }, 400);

  try {
    const user = await User.findOne({ where: { email } });

    // Always respond the same to prevent email enumeration
    const genericResponse = { message: 'If an unconfirmed account with that email exists, a new confirmation link has been sent' };

    if (!user || user.confirmed_at)
      return context.json(genericResponse);

    const token = crypto.randomBytes(32).toString('hex');
    await user.update({ confirmation_token: token, confirmation_sent_at: new Date() });

    debug(`Confirmation token regenerated for user id=${user.id}`);

    /* c8 ignore next -- isDevelopment short-circuit branch only in dev environments, not during test runs */
    if (appConfig.isDevelopment || appConfig.isTest)
      return context.json({ ...genericResponse, debug_token: token });

    /* c8 ignore next -- only reached in production (isTest is always true in tests) */
    return context.json(genericResponse);
  } catch (err) {
    debug('Error resending confirmation', err);
    return context.json({ error: 'Error resending confirmation' }, 500);
  }
});


/* c8 ignore next 4 */
if (appConfig.isDevelopment) {
  debug(getRouterName(controller));
  showRoutes(controller, { verbose: true });
}

module.exports = controller;
