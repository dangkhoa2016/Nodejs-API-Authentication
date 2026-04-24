# Node.js API Authentication with JWT
> 🌐 Language: **English** | [Vietnamese](README.vi.md)

A production-ready REST API for authentication and user management, built with **Hono**, **Sequelize**, **bcryptjs**, **JWT**, and **SQLite** (dev) / **Postgres** (prod).

## Features

- **User Registration** — email + username + password; generates an email confirmation token upon signup
- **JWT Authentication** — 1-hour access token + 7-day refresh token with full rotation mechanism
- **Token Refresh** — `POST /v1/auth/refresh` rotates the refresh token and issues a new access token
- **Logout** — adds `jti` to denylist and (optionally) revokes refresh token
- **Password Reset** — forgot password → email link → reset password flow
- **Email Verification** — confirm-email endpoint + resend-confirmation
- **Account Locking** — locks account after N failed login attempts (configurable)
- **Rate Limiting** — IP-based rate limits on all public auth endpoints (login, register, refresh, forgot/reset password, email confirmation)
- **Admin CRUD** — create / update / delete / list users (requires admin role)
- **Swagger UI** — interactive API docs at `GET /docs`
- **Health Check** — `GET /health` returns DB status, uptime, and version
- **API Versioning** — all `/users` and `/user/*` routes are mirrored under `/v1`; legacy paths are retained and `/v1/auth/*` remains versioned-only
- **Security** — `hono/secure-headers`, CORS, environment validation, sensitive data masking in logs
- **Scheduled Cleanup** — hourly job removes expired JWT denylist entries and old refresh tokens
- **Test Suite** — 167 integration + unit tests (14 test files) using Vitest

## Technologies Used

| Package | Purpose |
|---------|---------|
| [Hono](https://hono.dev/) | Web framework |
| [@hono/node-server](https://github.com/honojs/node-server) | Node.js adapter |
| [@hono/swagger-ui](https://github.com/honojs/middleware/tree/main/packages/swagger-ui) | Swagger UI middleware |
| [Sequelize](https://sequelize.org/) | ORM (SQLite / Postgres) |
| [bcryptjs](https://www.npmjs.com/package/bcryptjs) | Password hashing |
| [jsonwebtoken (via hono/jwt)](https://hono.dev/middleware/builtin/jwt) | Token signing & verification |
| [winston](https://www.npmjs.com/package/winston) | Structured logging |
| [vitest](https://vitest.dev/) | Test runner |

## Installation

```bash
git clone <repository-url>
cd Nodejs-API-Authentication
yarn install
cp .env.sample .env   # edit .env — at minimum set JWT_SECRET and DB_NAME
```

## Running the App

```bash
# Development (hot-reload)
yarn dev

# Production
yarn migrate          # run migrations first
yarn start

# Tests
yarn test
yarn test:watch
yarn test:coverage

# Lint
yarn lint
yarn lint:fix

# Migration
yarn migrate
yarn migrate:undo

# Seeder
yarn seed             # run all seeders
yarn seed:undo        # revert last seeder
yarn migrate-seed     # migrate + seed together
```

## Environment Variables

See [.env.sample](.env.sample) for the full list. Key variables:

| Variable                   | Required | Default                                       | Description                            |
| -------------------------- | -------- | --------------------------------------------- | -------------------------------------- |
| `JWT_SECRET`               | ✅        | —                                             | Must be ≥ 32 characters                |
| `DB_NAME`                  | ✅        | —                                             | SQLite file path or Postgres DB name   |
| `PORT`                     |          | `4000`                                        | Server port                            |
| `APP_URL`                  |          | `http://localhost:4000`                       | Base URL for email links               |
| `DIALECT`                  |          | `sqlite` in `.env.sample`                     | Database type (`sqlite` or `postgres`); production falls back to `postgres` when unset |
| `LOGIN_RATE_LIMIT`         |          | `5`                                           | Max login attempts / minute / IP       |
| `REGISTER_RATE_LIMIT`      |          | `10`                                          | Max registration attempts / hour / IP  |
| `REFRESH_RATE_LIMIT`       |          | `30`                                          | Max token refresh attempts / minute / IP |
| `FORGOT_PASSWORD_RATE_LIMIT` |        | `5`                                           | Max forgot-password requests / hour / IP |
| `RESET_PASSWORD_RATE_LIMIT` |         | `10`                                          | Max reset-password attempts / hour / IP |
| `CONFIRM_EMAIL_RATE_LIMIT` |          | `10`                                          | Max confirm-email attempts / hour / IP |
| `RESEND_CONFIRMATION_RATE_LIMIT` |    | `5`                                           | Max resend-confirmation requests / hour / IP |
| `MAX_FAILED_ATTEMPTS`      |          | `5`                                           | Failed attempts before lock            |
| `ACCOUNT_LOCK_DURATION_MS` |          | `1800000`                                     | Lock duration (30 minutes)             |
| `HASH_SALT`                |          | `12`                                          | Bcrypt salt rounds                     |
| `ALLOWED_ORIGINS`          |          | `http://localhost:3000,http://localhost:4000` | Allowed CORS origins (comma-separated) |
| `JWT_CLEANUP_INTERVAL_MS`  |          | `3600000`                                     | Cleanup interval (1 hour)              |
| `LOG_FOLDER`               |          | `./logs`                                      | Log directory                          |
| `LOG_FILE`                 |          | `combined.log`                                | Log file name                          |

## API Endpoints

> All `/users` and `/user/*` routes listed below are also available under `/v1` (for example `/v1/users/login`, `/v1/user/me`).
> System endpoints remain at the root, and `/v1/auth/*` routes are versioned-only.
> Interactive docs: **`GET /docs`** — OpenAPI spec: **`GET /openapi.json`**

### System

| Method | Path            | Auth | Description                                      |
| ------ | --------------- | ---- | ------------------------------------------------ |
| `GET`  | `/`             | —    | Welcome message                                  |
| `GET`  | `/health`       | —    | System status: `{ status, db, uptime, version }` |
| `GET`  | `/docs`         | —    | Swagger UI                                       |
| `GET`  | `/openapi.json` | —    | OpenAPI 3.0 spec                                 |

### Authentication

| Method            | Path                                        | Auth | Description                                |
| ----------------- | ------------------------------------------- | ---- | ------------------------------------------ |
| `POST`            | `/users/register` `/users` `/users/sign_up` | —    | Register user                              |
| `POST`            | `/users/login` `/users/sign_in`             | —    | Login — returns `token` + `refresh_token`  |
| `POST` / `DELETE` | `/users/logout` `/users/sign_out`           | JWT  | Logout — revoke access + refresh token     |
| `POST`            | `/v1/auth/refresh`                          | —    | Rotate refresh token, get new access token |
| `POST`            | `/v1/auth/forgot-password`                  | —    | Request password reset link                |
| `POST`            | `/v1/auth/reset-password`                   | —    | Reset password using token                 |
| `POST`            | `/v1/auth/confirm-email`                    | —    | Confirm email via token                    |
| `POST`            | `/v1/auth/resend-confirmation`              | —    | Resend confirmation email                  |

### Profile (Authenticated User)

| Method   | Path                                       | Auth | Description      |
| -------- | ------------------------------------------ | ---- | ---------------- |
| `GET`    | `/users/profile` `/user/me` `/user/whoami` | JWT  | Get user profile |
| `DELETE` | `/users`                                   | JWT  | Delete account   |

### Admin (Requires Admin Role)

| Method        | Path                                                  | Auth        | Description                     |
| ------------- | ----------------------------------------------------- | ----------- | ------------------------------- |
| `GET`         | `/users` `/users/all`                                 | JWT + Admin | List users (pagination, search) |
| `POST`        | `/users/create`                                       | JWT + Admin | Create user                     |
| `PATCH`/`PUT` | `/users/:id`                                          | JWT + Admin | Update user                     |
| `DELETE`      | `/users/:id` `/users/:id/delete` `/users/:id/destroy` | JWT + Admin | Delete user                     |

## Authentication Flow

```
1. POST /users/login
   ← { token, refresh_token, user }

2. Use token in header Authorization: Bearer <token>

3. When token expires (1 hour):
   POST /v1/auth/refresh  { refresh_token }
   ← { token, refresh_token }   ← old refresh token is replaced

4. Logout:
   DELETE /users/logout  Authorization: Bearer <token>
   Body (optional): { refresh_token }
```

## Password Reset Flow

```
1. POST /v1/auth/forgot-password  { email }
   ← { message }  (+ debug_token in dev/test environments)

2. POST /v1/auth/reset-password  { token, password }
   ← { message }
```

> In production, step 1 sends an email with a reset link. Integrate an email provider (nodemailer, SendGrid, Resend, ...) and use `APP_URL` + token to generate the link.

## Email Verification Flow

```
1. POST /users/register  { email, username, password }
   ← generates confirmation_token and stores it in user

2. POST /v1/auth/confirm-email  { token }
   ← { message }

3. (If token expired) POST /v1/auth/resend-confirmation  { email }
   ← generates new token
```

## Usage Examples

```bash
# Register
curl -X POST http://localhost:4000/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"user123","password":"password123"}'

# Login
curl -X POST http://localhost:4000/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user123","password":"password123"}'

# Get profile
curl http://localhost:4000/user/me \
  -H "Authorization: Bearer <access_token>"

# Refresh token
curl -X POST http://localhost:4000/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<refresh_token>"}'
```

See more curl examples at [manual/authentication.sh](./manual/authentication.sh).

## Documentation

| Document | Description |
| -------- | ----------- |
| [Access Control Reference](docs/ACCESS_CONTROL.md) | Role-based access matrix, auth middleware chain, guest/user/admin rights |
| [JWT Lifecycle](docs/JWT_LIFECYCLE.md) | Token issuance, rotation, revocation, denylist cleanup |
| [Rate Limiting](docs/RATE_LIMITING.md) | Rate limit rules per endpoint, env var configuration |
| [Deployment Guide](docs/DEPLOYMENT.md) | Production setup with PM2 + Nginx, env config, health check |

## License

This project is licensed under the MIT License.
