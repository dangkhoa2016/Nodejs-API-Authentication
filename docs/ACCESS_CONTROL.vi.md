# Tra cứu về Kiểm soát truy cập
> 🌐 Language / Ngôn ngữ: [English](ACCESS_CONTROL.md) | **Tiếng Việt**

Tài liệu này mô tả sự khác biệt về quyền truy cập giữa ba loại người dùng trong hệ thống: **Khách (Guest)**, **User thường**, và **Admin**.

## Khái niệm cốt lõi

- **Role** được lưu trong cột `role` của bảng `users`, kiểu `string`, mặc định `"user"`.
- Hai giá trị hợp lệ: `"user"` và `"admin"` (kiểm tra qua getter `isAdmin` trong `User` model).
- Xác thực dựa trên **JWT** (via `hono/jwt`). Token được gửi trong header `Authorization: Bearer <token>`.
- JWT được trả về trong **body của response** sau khi đăng nhập thành công (không phải trong header).
- Tất cả endpoint dưới `/users` và `/user/*` bên dưới đều có bản tương đương dưới `/v1` với cùng hành vi.

---

## Ma trận quyền truy cập

| Endpoint | Method | Khách | User thường | Admin |
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
| `/users/profile`, `/user/me`, `/user/whoami` | GET | ❌ 401 | ✅ (bản thân) | ✅ |
| `/users` | GET (danh sách) | ❌ 401 | ❌ 403 | ✅ |
| `/users/create` | POST | ❌ 401 | ❌ 403 | ✅ |
| `/users/:id` | PUT/PATCH | ❌ 401 | ❌ 403 | ✅ bất kỳ |
| `/users/:id` | DELETE | ❌ 401 | ❌ 403 | ✅ bất kỳ |
| Thay đổi `role` của user | PUT `/users/:id` | ❌ | ❌ (Chỉ admin) | ✅ |

### Endpoint tự quản lý (User thường & Admin)

| Endpoint | Method | Mô tả |
|---|---|---|
| `/users/profile`, `/user/me` hoặc `/user/whoami` | GET | Xem profile của chính mình |
| `/users` hoặc `/users/profile` | PUT/PATCH | Cập nhật profile của chính mình |
| `DELETE /users` | DELETE | Xóa tài khoản của chính mình |

---

## Mô tả từng loại người dùng

### Khách (Guest)

- Không có JWT hoặc JWT không hợp lệ/hết hạn/đã thu hồi.
- `context.user` là `undefined`.
- Chỉ được truy cập các endpoint công khai: trang chủ, đăng ký, đăng nhập, xác nhận email, đặt lại mật khẩu.
- Gọi bất kỳ endpoint yêu cầu xác thực sẽ nhận `401 Unauthorized`.

### User thường (`role = "user"`)

- Có JWT hợp lệ.
- Có thể đăng xuất (`DELETE/POST /users/sign_out` hoặc `/users/logout`).
- Có thể xem, cập nhật, xóa **tài khoản của chính mình** qua các endpoint tự quản lý (`/user/me`, `PUT /users/profile`, `DELETE /users`).
- **Không thể** truy cập các route quản trị user như `GET /users`, `POST /users/create`, hoặc `PUT/DELETE /users/:id` — sẽ nhận `403 Forbidden`.
- Trường `role` chỉ có thể thay đổi bởi admin.

### Admin (`role = "admin"`)

- Mọi quyền của User thường, cộng thêm:
- Xem danh sách toàn bộ user (`GET /users`).
- Cập nhật và xóa **bất kỳ user nào** (`PUT/DELETE /users/:id`).
- Tạo user trực tiếp qua `POST /users/create`.
- **Thay đổi `role`** của user khác khi gọi `PUT /users/:id` với `{ "role": "admin" }`.

---

## Luồng xử lý phân quyền

Các route admin-protected (`/users/*`) chạy qua middleware chain `authenticateMiddleware` + `checkPermissionMiddleware` của Hono (định nghĩa trong `src/app/middleware/`):

```
Request → authenticateMiddleware (hono/jwt)
        │  ├─ Token thiếu/không hợp lệ/hết hạn → 401 "Unauthorized"
        │  ├─ JTI có trong jwt_denylist          → 401 "Token revoked"
        │  └─ User không tìm thấy trong DB       → 404 "User not found"
        ▼
        checkPermissionMiddleware
              ├─ context.user undefined?  → 404 "User not found"
              ├─ context.user.isAdmin     → ✅ cho qua
              └─ còn lại                 → 403 "You must be an administrator to perform this action"
```

---

## Ghi chú cho lập trình viên

- **Nâng quyền user lên admin:** Chỉ admin mới làm được qua `PUT /users/:id` với body `{ "role": "admin" }`. Không có endpoint tự phục vụ.
- **Tạo admin đầu tiên:** Chạy `yarn seed` (đọc `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` từ `.env`).
- **Token bị thu hồi** sau khi đăng xuất — JTI được ghi vào bảng `jwt_denylist`. Cleanup job tự động xóa các entry đã hết hạn mỗi giờ (cấu hình qua `JWT_CLEANUP_INTERVAL_MS`).
- **Rate limiting:** Áp dụng cho tất cả endpoint xác thực công khai (đăng nhập, đăng ký, làm mới token, quên/đặt lại mật khẩu, xác nhận email). Xem [RATE_LIMITING.vi.md](RATE_LIMITING.vi.md) để biết mặc định và cách cấu hình. Không có IP safelist tự động.
