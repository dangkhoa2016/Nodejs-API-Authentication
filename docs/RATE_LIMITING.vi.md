# Kiểm soát Tần suất Truy cập
> 🌐 Language / Ngôn ngữ: [English](RATE_LIMITING.md) | **Tiếng Việt**

Tài liệu này mô tả cơ chế rate limiting của ứng dụng, các ngưỡng giới hạn hiện tại, cách điều chỉnh, và những lưu ý khi deploy sau reverse proxy.

## Tổng quan

Rate limiting được triển khai bằng **middleware `createRateLimiter` tùy chỉnh dùng bộ nhớ trong** (nằm tại `src/app/middleware/rate-limit.js`) — một Hono middleware chạy trước controller, dùng bộ đếm theo cửa sổ thời gian cố định cho từng key để quyết định có cho request đi tiếp hay không.

Tất cả route xác thực/profile dưới `/users` và `/user/*` bên dưới đều có bản mirror dưới `/v1`; bảng liệt kê cả path gốc và path versioned nơi limiter thực sự được áp dụng.

**Storage backend:**
- **In-memory `Map`** — không cần Redis, không cần database.
- Mỗi tiến trình Node.js có store đếm riêng. Trong môi trường multi-process hoặc multi-instance, counter không được chia sẻ giữa các process.
- Entry hết hạn được dọn dẹp tự động theo chu kỳ của mỗi cửa sổ rate-limit.

---

## Các ngưỡng giới hạn hiện tại

| Rule | Endpoint | Method | Giới hạn | Cửa sổ | Key | Env var |
|---|---|---|---|---|---|---|
| `loginRateLimiter` | `/users/sign_in`, `/users/login`, `/v1/users/sign_in`, `/v1/users/login` | POST | 5 request | 60 giây | IP | `LOGIN_RATE_LIMIT` |
| `registerRateLimiter` | `/users`, `/users/register`, `/users/sign_up`, `/v1/users`, `/v1/users/register`, `/v1/users/sign_up` | POST | 10 request | 1 giờ | IP | `REGISTER_RATE_LIMIT` |
| `forgotPasswordRateLimiter` | `/v1/auth/forgot-password` | POST | 5 request | 1 giờ | IP | `FORGOT_PASSWORD_RATE_LIMIT` |
| `resetPasswordRateLimiter` | `/v1/auth/reset-password` | POST | 10 request | 1 giờ | IP | `RESET_PASSWORD_RATE_LIMIT` |
| `confirmEmailRateLimiter` | `/v1/auth/confirm-email` | POST | 10 request | 1 giờ | IP | `CONFIRM_EMAIL_RATE_LIMIT` |
| `resendConfirmationRateLimiter` | `/v1/auth/resend-confirmation` | POST | 5 request | 1 giờ | IP | `RESEND_CONFIRMATION_RATE_LIMIT` |
| `refreshRateLimiter` | `/v1/auth/refresh` | POST | 30 request | 60 giây | IP | `REFRESH_RATE_LIMIT` |

---

## Response khi bị throttle

HTTP **429 Too Many Requests**, kèm header `Retry-After` và các header rate-limit:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 38
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 38

{"error":"Too many login attempts, please try again in 1 minute"}
```

Response này nhất quán với error contract của toàn ứng dụng: `{ "error": "..." }` (singular key).

---

## Tại sao dùng IP rate limiting cho login

`loginRateLimiter` (5 req/60s per IP) bảo vệ chống brute-force từ một IP tấn công nhiều tài khoản khác nhau. Key được lấy từ header `x-forwarded-for` (giá trị đầu tiên) nếu có, nếu không thì từ `connectionInfo.remote.address` do `loggerMiddleware` gán.

```js
// src/app/middleware/rate-limit.js — default keyFn
const getKey = (context) => {
  const forwarded = context.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return context.connectionInfo?.remote?.address || 'unknown';
};
```

---

## Điều chỉnh ngưỡng

**Qua biến môi trường** (cho các limiter nhạy cảm nhất với tấn công):

```bash
# .env
LOGIN_RATE_LIMIT=10                  # login: nới lỏng lên 10 lần / 60s
REGISTER_RATE_LIMIT=5                # đăng ký: thắt chặt xuống 5 lần / giờ
FORGOT_PASSWORD_RATE_LIMIT=3         # forgot-password: thắt chặt xuống 3 lần / giờ
RESET_PASSWORD_RATE_LIMIT=5          # reset-password: thắt chặt xuống 5 lần / giờ
CONFIRM_EMAIL_RATE_LIMIT=5           # confirm-email: thắt chặt xuống 5 lần / giờ
RESEND_CONFIRMATION_RATE_LIMIT=3     # resend-confirmation: thắt chặt xuống 3 lần / giờ
REFRESH_RATE_LIMIT=60                # token refresh: nới lỏng lên 60 lần / phút
```

**Qua code** — sửa lời gọi `createRateLimiter` trong `src/app/controllers/auth.js` và `src/app/controllers/auth-extra.js`:

```js
// Ví dụ: thắt chặt đăng ký xuống 5 lần / 1 giờ
const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts, please try again in 1 hour',
});
```

Sau khi thay đổi, chạy lại tests để xác nhận:

```bash
yarn test test/integration/auth.test.js
```

> Nếu thay đổi `max`, nhớ cập nhật test tương ứng trong `test/integration/`.

---

## Test thủ công

Với server đang chạy local, dùng vòng lặp để trigger throttle:

```bash
# Trigger loginRateLimiter (6 lần, lần 6 phải nhận 429)
for i in $(seq 1 6); do
  echo "--- Request $i ---"
  curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/users/sign_in \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
  echo
done
```

Expected output: `400 400 400 400 400 429`

> 5 lần đầu nhận `400 Invalid credentials` (sai mật khẩu). Lần 6 vượt giới hạn và nhận `429`.

---

## Lưu ý khi deploy sau reverse proxy / load balancer

**Vấn đề:** Nếu ứng dụng chỉ nhìn vào địa chỉ TCP peer trực tiếp khi đứng sau Nginx, Cloudflare, hay load balancer, giá trị đó thường sẽ là IP của proxy — **tất cả request sẽ dùng chung một counter** và người dùng hợp lệ có thể bị chặn oan.

**Cách middleware này xử lý:** Default `keyFn` đã đọc giá trị đầu tiên từ header `X-Forwarded-For` nếu có. Bạn chỉ cần đảm bảo proxy thiết lập đúng header này — không cần thêm cấu hình nào trong ứng dụng.

```js
// Đã tích hợp sẵn trong default keyFn của rate-limit.js
const forwarded = context.req.header('x-forwarded-for');
if (forwarded) return forwarded.split(',')[0].trim();
```

> **Cảnh báo bảo mật:** Chỉ tin tưởng `X-Forwarded-For` từ các proxy bạn kiểm soát. Nếu proxy không strip hoặc validate header này, attacker có thể giả mạo IP bằng cách tự thêm vào request.

---

## Disable tạm thời (chỉ dùng khi debug)

In-memory rate limiter không có toggle runtime toàn cục. Trong test, mock hoặc bỏ qua middleware:

```js
// Trong Vitest — mock module để trả về pass-through middleware
vi.mock('../../src/app/middleware/rate-limit.js', () => ({
  createRateLimiter: () => async (_ctx, next) => next(),
}));
```

Test suite của dự án đã tắt tất cả rate limiter bằng cách đặt tất cả biến `*_RATE_LIMIT` thành `1000` trong `test/setup.js`. Đây là cách chuẩn — khi thêm limiter mới, nhớ thêm env var tương ứng vào file đó.

---

## Các file liên quan

| File | Vai trò |
|---|---|
| `src/app/middleware/rate-limit.js` | Factory `createRateLimiter` — triển khai bộ đếm in-memory theo cửa sổ thời gian cố định |
| `src/app/controllers/auth.js` | `loginRateLimiter`, `registerRateLimiter` |
| `src/app/controllers/auth-extra.js` | `refreshRateLimiter`, `forgotPasswordRateLimiter`, `resetPasswordRateLimiter`, `confirmEmailRateLimiter`, `resendConfirmationRateLimiter` |
| `test/unit/middleware/rate-limit.test.js` | Unit tests bao phủ tất cả các trường hợp của rate-limiter |
