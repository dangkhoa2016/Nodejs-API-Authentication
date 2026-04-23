'use strict';

const debug = require('debug')('nodejs-api-authentication:middleware->rate-limit');

/**
 * Simple in-memory rate limiter middleware.
 *
 * @param {object} options
 * @param {number} options.windowMs   - Time window in milliseconds (default: 60_000)
 * @param {number} options.max        - Max requests allowed per window per key (default: 10)
 * @param {string} options.message    - Error message to return when limit exceeded
 * @param {Function} [options.keyFn] - Function(context) => string key. Defaults to IP address.
 */
const createRateLimiter = ({
  windowMs = 60_000,
  max = 10,
  message = 'Too many requests, please try again later',
  keyFn = null,
} = {}) => {
  // Map: key -> { count, resetAt }
  const store = new Map();

  // Periodically purge expired entries to avoid unbounded memory growth
  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      /* c8 ignore next -- the else branch (entry not yet expired) is only hit when prune fires mid-window */
      if (now >= entry.resetAt) store.delete(key);
    }
  }, windowMs);

  // Allow GC when tests or server shuts down
  /* c8 ignore next */
  if (pruneInterval.unref) pruneInterval.unref();

  const getKey = keyFn || ((context) => {
    const forwarded = context.req.header('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    // connectionInfo is set by logger middleware
    return context.connectionInfo?.remote?.address || 'unknown';
  });

  return async (context, next) => {
    const key = getKey(context);
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;
    debug(`Rate limit check — key: ${key}, count: ${entry.count}/${max}`);

    const remaining = Math.max(0, max - entry.count);
    const resetSec = Math.ceil((entry.resetAt - now) / 1000);

    context.header('X-RateLimit-Limit', String(max));
    context.header('X-RateLimit-Remaining', String(remaining));
    context.header('X-RateLimit-Reset', String(resetSec));

    if (entry.count > max) {
      context.header('Retry-After', String(resetSec));
      return context.json({ error: message }, 429);
    }

    await next();
  };
};

module.exports = { createRateLimiter };
