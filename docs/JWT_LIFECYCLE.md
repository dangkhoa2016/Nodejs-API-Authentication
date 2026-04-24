# JWT Lifecycle
> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](JWT_LIFECYCLE.vi.md)

This document explains the full lifecycle of a JWT within the system — from creation to revocation and cleanup from the database.

All `/users` and `/user/*` auth/profile routes described here are also available under `/v1`; the `/v1/auth/*` routes are versioned-only.

## Overview

```
[POST /users/sign_in  or  /users/login]
        │
        ▼
  Application validates username + password (bcrypt)
        │
        ▼
  JWT access token created via hono/jwt (HS256)
  Payload: { id, username, exp (1h from now), jti }
  Refresh token created (7-day lifetime) → stored in refresh_tokens table
        │
        ▼
  Response body: { token, refresh_token, user }
        │
        ▼
  Client stores token, sends it with every subsequent request:
  Authorization: Bearer <token>
        │
        ▼
  authenticateMiddleware (hono/jwt)
  → Decode token (verify signature + exp)
  → Check JTI in jwt_denylist table (is it revoked?)
  → If valid: load user from DB → set context.user
        │
        ▼
  [DELETE or POST /users/sign_out  or  /users/logout]
  → Add access token JTI to jwt_denylist table
  → Optionally revoke refresh token if provided in request body
  → Token can no longer be used even if it hasn't expired
        │
        ▼
  [Automatic cleanup — startJwtCleanupJob]
  → Runs at startup and every JWT_CLEANUP_INTERVAL_MS (default: 1 hour)
  → Deletes rows in jwt_denylist where exp < now
  → Deletes rows in refresh_tokens where expired or revoked
```

---

## JWT Payload

Tokens are signed using the HS256 algorithm (via `hono/jwt`). The payload includes:

| Field | Meaning |
|---|---|
| `id` | User ID (integer) |
| `username` | Username (string) |
| `exp` | Expiration — Unix timestamp (seconds), 1 hour from login |
| `jti` | JWT ID — `userId.timestamp` at login and `userId.timestamp.randomHex` during refresh rotation; used for revocation |

The default access token lifetime is **1 hour**. To change it, update the `exp` calculation in `src/app/controllers/auth.js`.

The refresh token lifetime is **7 days** and is stored in the `refresh_tokens` table.

---

## Signing Key

The JWT is signed with the `JWT_SECRET` environment variable:

- **Required** — must be at least 32 characters long.
- Validated at startup by `src/config/validate-env.js`; the server will not start if missing or too short.
- Generate a secure key with: `openssl rand -base64 32`

> **Production Note:** Keep `JWT_SECRET` secret and rotate it only when necessary, as rotation immediately invalidates all existing tokens.

---

## Revocation — The `jwt_denylist` table

When a user signs out, the token's `jti` is recorded in the `jwt_denylist` table:

```
jwt_denylist
┌────────┬──────────────────┬─────────────────────┐
│ id     │ jti              │ exp                 │
├────────┼──────────────────┼─────────────────────┤
│ 1      │ 1.1714003200     │ 2026-04-24 11:00:00 │
│ 2      │ 2.1714003100     │ 2026-04-23 09:30:00 │
└────────┴──────────────────┴─────────────────────┘
```

For every request with a JWT, `authenticateMiddleware` checks if the `jti` exists in this table. If it does, the request is rejected with `401 Token revoked`, even if the token has not yet reached its `exp` time.

---

## Refresh Token Rotation

When the access token expires, the client can obtain a new access + refresh token pair without re-authenticating:

```
POST /v1/auth/refresh
Body: { "refresh_token": "<current_refresh_token>" }

→ Validates the refresh token (not expired, not revoked)
→ Issues a new access token (1h) + new refresh token (7d)
→ Marks the old refresh token as revoked (replaced_by = new token)
→ Returns: { token, refresh_token }
```

Once a refresh token is used (rotated), it is immediately invalidated. Attempting to reuse it returns `401 Invalid or expired refresh token`.

---

## Cleanup — Denylist and refresh token maintenance

The cleanup job runs automatically at startup and on a configurable interval.

### What gets deleted

- **`jwt_denylist` rows** where `exp < now` — the access token is already expired anyway.
- **`refresh_tokens` rows** where `expires_at < now` OR `revoked_at` is set.

### Configuration

```bash
# .env — default: 3600000 (1 hour)
JWT_CLEANUP_INTERVAL_MS=3600000
```

### Manual trigger (Node.js REPL)

```js
// From the project root
node -e "
require('dotenv').config();
const { sequelize, JwtDenylist, RefreshToken } = require('./src/app/models');
const { startJwtCleanupJob } = require('./src/app/jobs/jwt-cleanup');
sequelize.sync().then(() => startJwtCleanupJob(JwtDenylist, 0, RefreshToken));
"
```

---

## `GET /user/me` — Profile and Token Status

This endpoint returns the authenticated user's profile. It does **not** return token metadata. The same profile is also available via `GET /users/profile`, `GET /user/whoami`, and their `/v1` mirrors.

| Scenario | Status | Response |
|---|---|---|
| Valid Token | 200 | `{ id, username, email, role, ... }` |
| Missing / Invalid / Expired token | 401 | `{ "error": "Unauthorized", "message": "..." }` |
| Revoked token | 401 | `{ "error": "Token revoked" }` |
| User deleted from DB | 404 | `{ "error": "User not found" }` |

---

## Related Files

| File | Role |
|---|---|
| `src/app/models/jwt_denylist.js` | Sequelize model for the `jwt_denylist` table |
| `src/app/models/refresh_token.js` | Sequelize model for the `refresh_tokens` table |
| `src/app/models/user.js` | `isAdmin` getter, `validPassword`, `isLocked` |
| `src/app/controllers/auth.js` | Login (creates tokens + refresh token), logout (records denylist), profile |
| `src/app/controllers/auth-extra.js` | Refresh token rotation, forgot-password, reset-password, email confirmation |
| `src/app/middleware/authenticate.js` | JWT verification, denylist check, user loading |
| `src/app/jobs/jwt-cleanup.js` | Background job for periodic cleanup of expired JWTs and refresh tokens |
| `src/config/validate-env.js` | Startup validation ensuring `JWT_SECRET` meets minimum requirements |
