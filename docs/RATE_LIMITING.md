# Rate Limiting
> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](RATE_LIMITING.vi.md)

This document describes the application's rate limiting mechanism, current thresholds, how to adjust them, and important notes when deploying behind a reverse proxy.

## Overview

Rate limiting is implemented with a custom **in-memory `createRateLimiter` middleware** (located in `src/app/middleware/rate-limit.js`) — a Hono middleware that runs before the controller, using a per-key fixed window counter to decide whether a request is allowed to proceed.

All `/users` and `/user/*` auth/profile routes below are also available under `/v1`; the table includes both root and versioned paths where the limiter applies.

**Storage backend:**
- **In-memory `Map`** — no Redis, no database required.
- Each running process has its own counter store. In a multi-process or multi-instance deployment, counters are not shared across processes.
- Expired entries are pruned automatically on each rate-limit window interval.

---

## Current Rate Limits

| Rule | Endpoint | Method | Limit | Window | Key | Env var |
|---|---|---|---|---|---|---|
| `loginRateLimiter` | `/users/sign_in`, `/users/login`, `/v1/users/sign_in`, `/v1/users/login` | POST | 5 requests | 60 seconds | IP | `LOGIN_RATE_LIMIT` |
| `registerRateLimiter` | `/users`, `/users/register`, `/users/sign_up`, `/v1/users`, `/v1/users/register`, `/v1/users/sign_up` | POST | 10 requests | 1 hour | IP | `REGISTER_RATE_LIMIT` |
| `forgotPasswordRateLimiter` | `/v1/auth/forgot-password` | POST | 5 requests | 1 hour | IP | `FORGOT_PASSWORD_RATE_LIMIT` |
| `resetPasswordRateLimiter` | `/v1/auth/reset-password` | POST | 10 requests | 1 hour | IP | `RESET_PASSWORD_RATE_LIMIT` |
| `confirmEmailRateLimiter` | `/v1/auth/confirm-email` | POST | 10 requests | 1 hour | IP | `CONFIRM_EMAIL_RATE_LIMIT` |
| `resendConfirmationRateLimiter` | `/v1/auth/resend-confirmation` | POST | 5 requests | 1 hour | IP | `RESEND_CONFIRMATION_RATE_LIMIT` |
| `refreshRateLimiter` | `/v1/auth/refresh` | POST | 30 requests | 60 seconds | IP | `REFRESH_RATE_LIMIT` |

---

## Throttled Response

HTTP **429 Too Many Requests**, with `Retry-After` and rate-limit headers:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 38
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 38

{"error":"Too many login attempts, please try again in 1 minute"}
```

This response follows the application's global error contract: `{ "error": "..." }` (singular key).

---

## Why IP-Based Rate Limiting for Login

The `loginRateLimiter` (5 req/60s per IP) protects against brute-force attacks from a single IP targeting multiple accounts. The key is extracted from the `x-forwarded-for` header (first value) when present, otherwise from the `connectionInfo.remote.address` populated by `loggerMiddleware`.

```js
// src/app/middleware/rate-limit.js — default keyFn
const getKey = (context) => {
  const forwarded = context.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return context.connectionInfo?.remote?.address || 'unknown';
};
```

---

## Adjusting Limits

**Via environment variables** (for the most attack-sensitive limiters):

```bash
# .env
LOGIN_RATE_LIMIT=10                  # login: increase to 10 attempts / 60s
REGISTER_RATE_LIMIT=5                # registration: tighten to 5 per hour
FORGOT_PASSWORD_RATE_LIMIT=3         # forgot-password: tighten to 3 per hour
RESET_PASSWORD_RATE_LIMIT=5          # reset-password: tighten to 5 per hour
CONFIRM_EMAIL_RATE_LIMIT=5           # confirm-email: tighten to 5 per hour
RESEND_CONFIRMATION_RATE_LIMIT=3     # resend-confirmation: tighten to 3 per hour
REFRESH_RATE_LIMIT=60                # token refresh: increase to 60 per minute
```

**Via code** — modify the `createRateLimiter` calls in `src/app/controllers/auth.js` and `src/app/controllers/auth-extra.js`:

```js
// Example: tighten registration to 5 attempts / 1 hour
const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts, please try again in 1 hour',
});
```

After making changes, run tests to verify:

```bash
yarn test test/integration/auth.test.js
```

> If you change `max`, remember to update the corresponding tests in `test/integration/`.

---

## Manual Testing

With the server running locally, use a loop to trigger throttling:

```bash
# Trigger loginRateLimiter (6 attempts, the 6th should return 429)
for i in $(seq 1 6); do
  echo "--- Request $i ---"
  curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/users/sign_in \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
  echo
done
```

Expected output: `400 400 400 400 400 429`

> The first 5 attempts return `400 Invalid credentials` (wrong password). The 6th exceeds the limit and returns `429`.

---

## Notes When Deploying Behind Reverse Proxy / Load Balancer

**Problem:** If an app only looks at the direct TCP peer address behind Nginx, Cloudflare, or a load balancer, that value will usually be the proxy's IP — **all requests will share the same counter**, causing legitimate users to be incorrectly throttled.

**How this middleware handles it:** The default `keyFn` already reads the first value from the `X-Forwarded-For` header when present. You only need to ensure the proxy sets this header correctly — no additional application configuration is required.

```js
// Already built into the default keyFn in rate-limit.js
const forwarded = context.req.header('x-forwarded-for');
if (forwarded) return forwarded.split(',')[0].trim();
```

> **Security warning:** Only trust `X-Forwarded-For` from proxies you control. If your proxy does not strip or validate this header, attackers can spoof their IP by injecting it in the request.

---

## Temporary Disable (for debugging only)

The in-memory rate limiter does not have a global toggle at runtime. In tests, mock or skip the middleware:

```js
// In Vitest — mock the module to return a pass-through middleware
vi.mock('../../src/app/middleware/rate-limit.js', () => ({
  createRateLimiter: () => async (_ctx, next) => next(),
}));
```

The test suite already disables all rate limiters by setting every `*_RATE_LIMIT` env var to `1000` in `test/setup.js`. This is the canonical approach — add any new limiter env var there as well.

---

## Related Files

| File                                  | Purpose                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `src/app/middleware/rate-limit.js`    | `createRateLimiter` factory — in-memory fixed-window counter implementation |
| `src/app/controllers/auth.js`         | `loginRateLimiter`, `registerRateLimiter`                                |
| `src/app/controllers/auth-extra.js`   | `refreshRateLimiter`, `forgotPasswordRateLimiter`, `resetPasswordRateLimiter`, `confirmEmailRateLimiter`, `resendConfirmationRateLimiter` |
| `test/unit/middleware/rate-limit.test.js` | Unit tests covering all rate-limiter scenarios                       |
