# Xác thực API Node.js với JWT
> 🌐 Language / Ngôn ngữ: [English](README.md) | **Tiếng Việt**

Một REST API sẵn sàng cho production dành cho xác thực và quản lý người dùng, được xây dựng bằng **Hono**, **Sequelize**, **bcryptjs**, **JWT**, và **SQLite** (dev) / **Postgres** (prod).

## Tính năng

- **Đăng ký người dùng** — email + username + mật khẩu; tạo token xác nhận email khi đăng ký
- **Xác thực JWT** — access token 1 giờ + refresh token 7 ngày với cơ chế xoay vòng đầy đủ
- **Làm mới token** — `POST /v1/auth/refresh` xoay refresh token và cấp access token mới
- **Đăng xuất** — thêm `jti` vào danh sách từ chối và (tuỳ chọn) thu hồi refresh token
- **Đặt lại mật khẩu** — quy trình quên mật khẩu → link email → đặt lại mật khẩu
- **Xác nhận email** — endpoint confirm-email + resend-confirmation
- **Khóa tài khoản** — khóa sau N lần đăng nhập thất bại (có thể cấu hình)
- **Giới hạn tần suất (Rate Limiting)** — giới hạn theo IP cho tất cả endpoint xác thực công khai (đăng nhập, đăng ký, làm mới token, quên/đặt lại mật khẩu, xác nhận email)
- **CRUD Admin** — tạo / cập nhật / xoá / liệt kê người dùng (yêu cầu role admin)
- **Swagger UI** — tài liệu API tương tác tại `GET /docs`
- **Kiểm tra sức khỏe (Health Check)** — `GET /health` trả về trạng thái DB, uptime và version
- **Phiên bản API** — tất cả route dưới `/users` và `/user/*` đều có bản mirror dưới `/v1`; vẫn giữ đường dẫn cũ để tương thích ngược và nhóm `/v1/auth/*` chỉ tồn tại ở bản versioned
- **Bảo mật** — `hono/secure-headers`, CORS, kiểm tra biến môi trường, ẩn dữ liệu nhạy cảm trong log
- **Dọn dẹp định kỳ** — job chạy mỗi giờ xoá JWT denylist hết hạn và refresh token cũ
- **Bộ test** — 167 test integration + unit (14 test file) với Vitest

## Công nghệ sử dụng

| Package | Mục đích |
|---------|---------|
| [Hono](https://hono.dev/) | Framework web |
| [@hono/node-server](https://github.com/honojs/node-server) | Adapter Node.js |
| [@hono/swagger-ui](https://github.com/honojs/middleware/tree/main/packages/swagger-ui) | Middleware Swagger UI |
| [Sequelize](https://sequelize.org/) | ORM (SQLite / Postgres) |
| [bcryptjs](https://www.npmjs.com/package/bcryptjs) | Băm mật khẩu |
| [jsonwebtoken (qua hono/jwt)](https://hono.dev/middleware/builtin/jwt) | Ký & xác minh token |
| [winston](https://www.npmjs.com/package/winston) | Logging có cấu trúc |
| [vitest](https://vitest.dev/) | Test runner |

## Cài đặt

```bash
git clone <repository-url>
cd Nodejs-API-Authentication
yarn install
cp .env.sample .env   # chỉnh sửa .env — tối thiểu cần set JWT_SECRET và DB_NAME
```

## Chạy ứng dụng

```bash
# Development (hot-reload)
yarn dev

# Production
yarn migrate          # chạy migration trước
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
yarn seed             # chạy tất cả seeder
yarn seed:undo        # hoàn tác seeder cuối
yarn migrate-seed     # migrate + seed cùng lúc
```

## Biến môi trường

Xem [.env.sample](.env.sample) để biết đầy đủ danh sách. Các biến chính:

| Biến                       | Bắt buộc | Mặc định                | Mô tả                                      |
| -------------------------- | -------- | ----------------------- | ------------------------------------------ |
| `JWT_SECRET`               | ✅        | —                                              | Phải ≥ 32 ký tự                            |
| `DB_NAME`                  | ✅        | —                                              | Đường dẫn file SQLite hoặc tên DB Postgres |
| `PORT`                     |          | `4000`                                         | Cổng server                                |
| `APP_URL`                  |          | `http://localhost:4000`                        | Base URL cho link email                    |
| `DIALECT`                  |          | `sqlite` trong `.env.sample`                   | Loại database (`sqlite` hoặc `postgres`); nếu không đặt trong production thì code sẽ fallback sang `postgres` |
| `LOGIN_RATE_LIMIT`         |          | `5`                                            | Số lần đăng nhập tối đa / phút / IP        |
| `REGISTER_RATE_LIMIT`      |          | `10`                                           | Số lần đăng ký tối đa / giờ / IP           |
| `REFRESH_RATE_LIMIT`       |          | `30`                                           | Số lần làm mới token tối đa / phút / IP    |
| `FORGOT_PASSWORD_RATE_LIMIT` |        | `5`                                            | Số lần quên mật khẩu tối đa / giờ / IP     |
| `RESET_PASSWORD_RATE_LIMIT` |         | `10`                                           | Số lần đặt lại mật khẩu tối đa / giờ / IP |
| `CONFIRM_EMAIL_RATE_LIMIT` |          | `10`                                           | Số lần xác nhận email tối đa / giờ / IP    |
| `RESEND_CONFIRMATION_RATE_LIMIT` |    | `5`                                            | Số lần gửi lại xác nhận tối đa / giờ / IP  |
| `MAX_FAILED_ATTEMPTS`      |          | `5`                                            | Số lần sai trước khi bị khóa               |
| `ACCOUNT_LOCK_DURATION_MS` |          | `1800000`                                      | Thời gian khóa (30 phút)                   |
| `HASH_SALT`                |          | `12`                                           | Bcrypt salt rounds                         |
| `ALLOWED_ORIGINS`          |          | `http://localhost:3000,http://localhost:4000`  | CORS origins cho phép (phân tách bởi `,`)  |
| `JWT_CLEANUP_INTERVAL_MS`  |          | `3600000`                                      | Chu kỳ dọn dẹp (1 giờ)                     |
| `LOG_FOLDER`               |          | `./logs`                                       | Thư mục lưu file log                       |
| `LOG_FILE`                 |          | `combined.log`                                 | Tên file log                               |

## API Endpoints

> Tất cả route dưới `/users` và `/user/*` liệt kê bên dưới đều có bản tương đương dưới `/v1` (ví dụ `/v1/users/login`, `/v1/user/me`).
> Các endpoint hệ thống vẫn ở root, còn nhóm `/v1/auth/*` chỉ tồn tại ở bản versioned.
> Tài liệu tương tác: **`GET /docs`** — OpenAPI spec: **`GET /openapi.json`**

### Hệ thống

| Method | Path            | Auth | Mô tả                                                  |
| ------ | --------------- | ---- | ------------------------------------------------------ |
| `GET`  | `/`             | —    | Thông báo chào mừng                                    |
| `GET`  | `/health`       | —    | Trạng thái hệ thống: `{ status, db, uptime, version }` |
| `GET`  | `/docs`         | —    | Swagger UI                                             |
| `GET`  | `/openapi.json` | —    | OpenAPI 3.0 spec                                       |

### Xác thực

| Method              | Path                                        | Auth | Mô tả                                        |
| ------------------- | ------------------------------------------- | ---- | -------------------------------------------- |
| `POST`              | `/users/register` `/users` `/users/sign_up` | —    | Đăng ký người dùng                           |
| `POST`              | `/users/login` `/users/sign_in`             | —    | Đăng nhập — trả về `token` + `refresh_token` |
| `POST` / `DELETE`   | `/users/logout` `/users/sign_out`           | JWT  | Đăng xuất — thu hồi access + refresh token   |
| `POST`              | `/v1/auth/refresh`                          | —    | Xoay refresh token, lấy access token mới     |
| `POST`              | `/v1/auth/forgot-password`                  | —    | Yêu cầu link đặt lại mật khẩu                |
| `POST`              | `/v1/auth/reset-password`                   | —    | Đặt lại mật khẩu bằng token                  |
| `POST`              | `/v1/auth/confirm-email`                    | —    | Xác nhận email bằng token                    |
| `POST`              | `/v1/auth/resend-confirmation`              | —    | Gửi lại email xác nhận                       |

### Hồ sơ (người dùng đã xác thực)

| Method   | Path                                       | Auth | Mô tả                 |
| -------- | ------------------------------------------ | ---- | --------------------- |
| `GET`    | `/users/profile` `/user/me` `/user/whoami` | JWT  | Lấy thông tin cá nhân |
| `DELETE` | `/users`                                   | JWT  | Xóa tài khoản         |

### Admin (yêu cầu role admin)

| Method        | Path                                            | Auth        | Mô tả                                 |
| ------------- | ----------------------------------------------- | ----------- | ------------------------------------- |
| `GET`         | `/users` `/users/all`                           | JWT + Admin | Danh sách user (phân trang, tìm kiếm) |
| `POST`        | `/users/create`                                 | JWT + Admin | Tạo user                              |
| `PATCH`/`PUT` | `/users/:id`                                    | JWT + Admin | Cập nhật user                         |
| `DELETE`      | `/users/:id` `/users/:id/delete` `/users/:id/destroy` | JWT + Admin | Xóa user                       |

## Luồng xác thực

```
1. POST /users/login
   ← { token, refresh_token, user }

2. Dùng token trong header Authorization: Bearer <token>

3. Khi token hết hạn (1 giờ):
   POST /v1/auth/refresh  { refresh_token }
   ← { token, refresh_token }   ← refresh token cũ bị thay thế

4. Đăng xuất:
   DELETE /users/logout  Authorization: Bearer <token>
   Body (tuỳ chọn): { refresh_token }
```

## Luồng đặt lại mật khẩu

```
1. POST /v1/auth/forgot-password  { email }
   ← { message }  (+ debug_token trong môi trường dev/test)

2. POST /v1/auth/reset-password  { token, password }
   ← { message }
```

> Trong production, bước 1 sẽ gửi email chứa link reset. Tích hợp provider email (nodemailer, SendGrid, Resend, ...) và dùng `APP_URL` + token để tạo link.

## Luồng xác nhận email

```
1. POST /users/register  { email, username, password }
   ← tạo confirmation_token và lưu vào user

2. POST /v1/auth/confirm-email  { token }
   ← { message }

3. (Nếu token hết hạn) POST /v1/auth/resend-confirmation  { email }
   ← tạo token mới
```

## Ví dụ sử dụng

```bash
# Đăng ký
curl -X POST http://localhost:4000/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"user123","password":"password123"}'

# Đăng nhập
curl -X POST http://localhost:4000/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user123","password":"password123"}'

# Lấy profile
curl http://localhost:4000/user/me \
  -H "Authorization: Bearer <access_token>"

# Refresh token
curl -X POST http://localhost:4000/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<refresh_token>"}'
```

Xem thêm ví dụ curl tại [manual/authentication.sh](./manual/authentication.sh).

## Tài liệu tham khảo

| Tài liệu | Mô tả |
| -------- | ----- |
| [Kiểm soát truy cập](docs/ACCESS_CONTROL.vi.md) | Ma trận quyền theo role, middleware chain, quyền của guest/user/admin |
| [Vòng đời JWT](docs/JWT_LIFECYCLE.vi.md) | Phát hành token, xoay vòng, thu hồi, dọn dẹp denylist |
| [Giới hạn tần suất](docs/RATE_LIMITING.vi.md) | Quy tắc rate limit theo endpoint, cấu hình qua biến môi trường |
| [Hướng dẫn triển khai](docs/DEPLOYMENT.vi.md) | Cài đặt production với PM2 + Nginx, cấu hình env, health check |

## Giấy phép

Dự án này được cấp phép theo MIT License.
