# Vòng đời của JWT
> 🌐 Language / Ngôn ngữ: [English](JWT_LIFECYCLE.md) | **Tiếng Việt**

Tài liệu này giải thích vòng đời đầy đủ của một JWT trong hệ thống — từ lúc được tạo ra đến lúc bị thu hồi và dọn dẹp khỏi database.

Tất cả route xác thực/profile dưới `/users` và `/user/*` được mô tả ở đây đều có bản tương đương dưới `/v1`; còn nhóm `/v1/auth/*` chỉ tồn tại ở bản versioned.

## Tổng quan

```
[POST /users/sign_in  hoặc  /users/login]
        │
        ▼
  Ứng dụng xác thực username + password (bcrypt)
        │
        ▼
  JWT access token được tạo ra qua hono/jwt (HS256)
  Payload: { id, username, exp (1 giờ từ lúc login), jti }
  Refresh token được tạo (thời hạn 7 ngày) → lưu vào bảng refresh_tokens
        │
        ▼
  Response body: { token, refresh_token, user }
        │
        ▼
  Client lưu token, gửi kèm mọi request tiếp theo:
  Authorization: Bearer <token>
        │
        ▼
  authenticateMiddleware (hono/jwt)
  → Decode token (verify signature + exp)
  → Kiểm tra JTI trong bảng jwt_denylist (token đã thu hồi chưa?)
  → Nếu hợp lệ: load user từ DB → set context.user
        │
        ▼
  [DELETE hoặc POST /users/sign_out  hoặc  /users/logout]
  → Ghi JTI của access token vào bảng jwt_denylist
  → Tùy chọn: thu hồi refresh token nếu được cung cấp trong body
  → Token không thể dùng lại dù chưa hết hạn
        │
        ▼
  [Cleanup tự động — startJwtCleanupJob]
  → Chạy khi khởi động và theo chu kỳ JWT_CLEANUP_INTERVAL_MS (mặc định: 1 giờ)
  → Xóa các row trong jwt_denylist có exp < now
  → Xóa các row trong refresh_tokens đã hết hạn hoặc đã thu hồi
```

---

## JWT Payload

Token được ký bằng thuật toán HS256 (qua `hono/jwt`). Payload bao gồm:

| Field | Ý nghĩa |
|---|---|
| `id` | ID của user (integer) |
| `username` | Username (string) |
| `exp` | Expiration — Unix timestamp (seconds), 1 giờ sau khi login |
| `jti` | JWT ID — định dạng `userId.timestamp` khi login và `userId.timestamp.randomHex` khi refresh token; dùng để thu hồi |

Thời hạn access token mặc định là **1 giờ**. Để thay đổi, sửa phép tính `exp` trong `src/app/controllers/auth.js`.

Thời hạn refresh token là **7 ngày** và được lưu trong bảng `refresh_tokens`.

---

## Khóa ký (Signing Key)

JWT được ký bằng biến môi trường `JWT_SECRET`:

- **Bắt buộc** — phải có ít nhất 32 ký tự.
- Được kiểm tra khi khởi động bởi `src/config/validate-env.js`; server sẽ không khởi động nếu thiếu hoặc quá ngắn.
- Tạo khóa bảo mật: `openssl rand -base64 32`

> **Lưu ý production:** Giữ bí mật `JWT_SECRET` và chỉ rotate khi thực sự cần thiết, vì rotation sẽ làm mất hiệu lực ngay lập tức tất cả token hiện có.

---

## Revocation — Bảng `jwt_denylist`

Khi user sign out, `jti` của token được ghi vào bảng `jwt_denylist`:

```
jwt_denylist
┌────────┬──────────────────┬─────────────────────┐
│ id     │ jti              │ exp                 │
├────────┼──────────────────┼─────────────────────┤
│ 1      │ 1.1714003200     │ 2026-04-24 11:00:00 │
│ 2      │ 2.1714003100     │ 2026-04-23 09:30:00 │
└────────┴──────────────────┴─────────────────────┘
```

Mỗi lần request đến với JWT, `authenticateMiddleware` kiểm tra `jti` có tồn tại trong bảng này không. Nếu có → từ chối request với `401 Token revoked`, dù token chưa hết hạn `exp`.

---

## Rotation của Refresh Token

Khi access token hết hạn, client có thể lấy cặp access + refresh token mới mà không cần đăng nhập lại:

```
POST /v1/auth/refresh
Body: { "refresh_token": "<current_refresh_token>" }

→ Kiểm tra refresh token hợp lệ (chưa hết hạn, chưa bị thu hồi)
→ Tạo access token mới (1h) + refresh token mới (7 ngày)
→ Đánh dấu refresh token cũ là đã thu hồi (replaced_by = token mới)
→ Trả về: { token, refresh_token }
```

Sau khi refresh token được dùng (rotated), nó bị vô hiệu hóa ngay lập tức. Dùng lại sẽ trả về `401 Invalid or expired refresh token`.

---

## Cleanup — Dọn dẹp bảng denylist và refresh token

Cleanup job chạy tự động khi khởi động và theo chu kỳ cấu hình.

### Những gì bị xóa

- **Row trong `jwt_denylist`** có `exp < now` — access token đã hết hạn nên không cần giữ.
- **Row trong `refresh_tokens`** có `expires_at < now` HOẶC `revoked_at` được set.

### Cấu hình

```bash
# .env — mặc định: 3600000 (1 giờ)
JWT_CLEANUP_INTERVAL_MS=3600000
```

### Kích hoạt thủ công (Node.js REPL)

```js
// Từ thư mục gốc của dự án
node -e "
require('dotenv').config();
const { sequelize, JwtDenylist, RefreshToken } = require('./src/app/models');
const { startJwtCleanupJob } = require('./src/app/jobs/jwt-cleanup');
sequelize.sync().then(() => startJwtCleanupJob(JwtDenylist, 0, RefreshToken));
"
```

---

## `GET /user/me` — Profile và trạng thái token

Endpoint này trả về profile của user đã xác thực. **Không** trả về token metadata. Cùng dữ liệu này cũng có tại `GET /users/profile`, `GET /user/whoami`, và các bản mirror dưới `/v1`.

| Tình huống | Status | Response |
|---|---|---|
| Token hợp lệ | 200 | `{ id, username, email, role, ... }` |
| Token thiếu / không hợp lệ / hết hạn | 401 | `{ "error": "Unauthorized", "message": "..." }` |
| Token bị thu hồi | 401 | `{ "error": "Token revoked" }` |
| User đã bị xóa khỏi DB | 404 | `{ "error": "User not found" }` |

---

## Các file liên quan

| File | Vai trò |
|---|---|
| `src/app/models/jwt_denylist.js` | Sequelize model cho bảng `jwt_denylist` |
| `src/app/models/refresh_token.js` | Sequelize model cho bảng `refresh_tokens` |
| `src/app/models/user.js` | Getter `isAdmin`, `validPassword`, `isLocked` |
| `src/app/controllers/auth.js` | Login (tạo token + refresh token), logout (ghi denylist), profile |
| `src/app/controllers/auth-extra.js` | Rotation refresh token, forgot-password, reset-password, xác nhận email |
| `src/app/middleware/authenticate.js` | Xác thực JWT, kiểm tra denylist, load user |
| `src/app/jobs/jwt-cleanup.js` | Background job dọn dẹp JWT và refresh token hết hạn |
| `src/config/validate-env.js` | Kiểm tra `JWT_SECRET` đủ độ dài khi khởi động |
