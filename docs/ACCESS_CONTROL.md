# Access Control Reference
> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](ACCESS_CONTROL.vi.md)

This document describes the differences in access rights among three types of users in the system: **Guest**, **Regular User**, and **Admin**.

## Core Concepts

- **Role** is stored in the `role` column of the `users` table, type `string`, defaulting to `"user"`.
- Two valid values: `"user"` and `"admin"` (checked via the `isAdmin` getter in the `User` model).
- Authentication is based on **JWT** (via `hono/jwt`). The token is sent in the `Authorization: Bearer <token>` header.
- JWT is returned in the **response body** after a successful login (not in a response header).
- All `/users` and `/user/*` endpoints below are also available under `/v1` with the same behavior.

---

## Access Control Matrix

| Endpoint | Method | Guest | Regular User | Admin |
|---|---|---|---|---|
| `/` | GET | ✅ | ✅ | ✅ |
| `/health` | GET | ✅ | ✅ | ✅ |
| `/docs` | GET | ✅ | ✅ | ✅ |
| `/openapi.json` | GET | ✅ | ✅ | ✅ |
| `/users`, `/users/register`, `/users/sign_up` | POST | ✅ | ✅ | ✅ |
| `/users/login`, `/users/sign_in` | POST | ✅ | ✅ | ✅ |
| `/v1/auth/confirm-email` | POST | ✅ | ✅ | ✅ |
| `/v1/auth/forgot-password` | POST | ✅ | ✅ | ✅ |
| `/v1/auth/reset-password` | POST | ✅ | ✅ | ✅ |
| `/v1/auth/refresh` | POST | ✅ | ✅ | ✅ |
| `/v1/auth/resend-confirmation` | POST | ✅ | ✅ | ✅ |
| `/users/logout`, `/users/sign_out` | DELETE/POST | ❌ 401 | ✅ | ✅ |
| `/users/profile`, `/user/me`, `/user/whoami` | GET | ❌ 401 | ✅ (Self) | ✅ |
| `/users` | GET (List) | ❌ 401 | ❌ 403 | ✅ |
| `/users/create` | POST | ❌ 401 | ❌ 403 | ✅ |
| `/users/:id` | PUT/PATCH | ❌ 401 | ❌ 403 | ✅ Any |
| `/users/:id` | DELETE | ❌ 401 | ❌ 403 | ✅ Any |
| Change user `role` | PUT `/users/:id` | ❌ | ❌ (Admin only) | ✅ |

### Self-management endpoints (Regular User & Admin)

| Endpoint | Method | Description |
|---|---|---|
| `/users/profile`, `/user/me`, or `/user/whoami` | GET | View own profile |
| `/users` or `/users/profile` | PUT/PATCH | Update own profile |
| `DELETE /users` | DELETE | Delete own account |

---

## User Type Descriptions

### Guest

- No JWT or JWT is invalid/expired/revoked.
- `context.user` is `undefined`.
- Can only access public endpoints: home page, registration, login, email confirmation, password reset.
- Calling any authenticated endpoint returns `401 Unauthorized`.

### Regular User (`role = "user"`)

- Has a valid JWT.
- Can sign out (`DELETE/POST /users/sign_out` or `/users/logout`).
- Can view, update, and delete **their own account** via the self-management auth endpoints (`/user/me`, `PUT /users/profile`, `DELETE /users`).
- **Cannot** access admin user-management routes such as `GET /users`, `POST /users/create`, or `PUT/DELETE /users/:id` — gets `403 Forbidden`.
- The `role` field can only be changed by an admin.

### Admin (`role = "admin"`)

- All rights of a Regular User, plus:
- View the entire user list (`GET /users`).
- Update and delete **any user** (`PUT/DELETE /users/:id`).
- Create users directly via `POST /users/create`.
- **Change the `role`** of other users when calling `PUT /users/:id` with `{ "role": "admin" }`.

---

## Authorization Workflow

Admin-protected routes (`/users/*`) pass through the `authenticateMiddleware` + `checkPermissionMiddleware` Hono middleware chain (defined in `src/app/middleware/`):

```
Request → authenticateMiddleware (hono/jwt)
        │  ├─ Missing/Invalid/Expired token → 401 "Unauthorized"
        │  ├─ JTI found in jwt_denylist     → 401 "Token revoked"
        │  └─ User not found in DB          → 404 "User not found"
        ▼
        checkPermissionMiddleware
              ├─ context.user undefined?  → 404 "User not found"
              ├─ context.user.isAdmin     → ✅ Authorized
              └─ otherwise               → 403 "You must be an administrator to perform this action"
```

---

## Developer Notes

- **Promoting a user to admin:** Only an admin can do this via `PUT /users/:id` with the body `{ "role": "admin" }`. There is no self-service endpoint.
- **Creating the first admin:** Run `yarn seed` (reads `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` from `.env`).
- **Token Revocation:** After sign-out, the JTI is recorded in the `jwt_denylist` table. The cleanup job removes expired entries automatically every hour (configurable via `JWT_CLEANUP_INTERVAL_MS`).
- **Rate limiting:** Applied to all public auth endpoints (login, register, refresh, forgot/reset password, email confirmation). See [RATE_LIMITING.md](RATE_LIMITING.md) for defaults and configuration. No automatic IP safelist.
