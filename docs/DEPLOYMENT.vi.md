# Hướng dẫn Triển khai
> 🌐 Language / Ngôn ngữ: [English](DEPLOYMENT.md) | **Tiếng Việt**

Hướng dẫn deploy ứng dụng lên server production.

## Yêu cầu

- Node.js 20+ và `yarn` (hoặc `npm`) trên server
- Server Linux với SSH access
- Domain/hostname trỏ về IP của server (cho SSL với Nginx)
- Dự án hỗ trợ cả SQLite và PostgreSQL. File `.env.sample` dùng SQLite để đơn giản hóa khởi tạo, còn PostgreSQL phù hợp hơn cho đa số môi trường production.

---

## Bước 1 — Clone repository và cài dependencies

```bash
git clone https://github.com/your-org/nodejs-api-authentication.git /opt/api
cd /opt/api
yarn install --frozen-lockfile
```

`yarn migrate` và `yarn seed` hiện dùng `sequelize-cli`, trong khi gói này đang nằm trong `devDependencies`, nên cài đặt kiểu production-only sẽ làm thiếu công cụ cần cho đúng flow triển khai trong tài liệu này.

---

## Bước 2 — Cấu hình biến môi trường

Copy file mẫu và điền đầy đủ giá trị:

```bash
cp .env.sample .env
nano .env
```

Các biến quan trọng nhất cho production:

| Biến | Bắt buộc | Mặc định | Ghi chú |
|---|---|---|---|
| `JWT_SECRET` | ✅ | — | Phải có ≥ 32 ký tự ngẫu nhiên. `openssl rand -base64 32` |
| `DB_NAME` | ✅ | — | Đường dẫn tới file SQLite, ví dụ `./storage/production.db` |
| `PORT` | Khuyến nghị | `4000` | Port server lắng nghe |
| `NODE_ENV` | Khuyến nghị | `development` | Đặt thành `production` |
| `DIALECT` | Tùy chọn | `sqlite` trong `.env.sample` | Đặt `postgres` khi dùng PostgreSQL. Nếu bỏ trống trong production, runtime sẽ fallback sang `postgres`. |
| `DB_HOST` | Có điều kiện | — | Bắt buộc khi `DIALECT=postgres` |
| `DB_USER` | Có điều kiện | — | Bắt buộc khi `DIALECT=postgres` |
| `DB_PASS` | Có điều kiện | — | Bắt buộc khi `DIALECT=postgres` |
| `APP_URL` | Tùy chọn | `http://localhost:4000` | Base URL dùng để tạo link đặt lại mật khẩu và xác nhận email |
| `LOGIN_RATE_LIMIT` | Tùy chọn | `5` | Số lần login tối đa / 60s / IP |
| `ALLOWED_ORIGINS` | Tùy chọn | `http://localhost:3000,...` | Danh sách CORS origins, cách nhau bởi dấu phẩy |
| `JWT_CLEANUP_INTERVAL_MS` | Tùy chọn | `3600000` | Chu kỳ cleanup (ms, 1 giờ) |
| `MAX_FAILED_ATTEMPTS` | Tùy chọn | `5` | Số lần login thất bại trước khi khóa tài khoản |
| `ACCOUNT_LOCK_DURATION_MS` | Tùy chọn | `1800000` | Thời gian khóa tài khoản (30 phút) |
| `LOG_FOLDER` | Tùy chọn | `./logs` | Thư mục chứa file log của Winston |
| `LOG_FILE` | Tùy chọn | `combined.log` | Tên file log của Winston |

---

## Bước 3 — Khởi tạo database

Chạy migrations để tạo tất cả các bảng:

```bash
yarn migrate
```

Seed user admin đầu tiên (đọc `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` từ `.env`):

```bash
yarn seed
```

---

## Bước 4 — Khởi động với PM2 (khuyến nghị)

Cài PM2 global:

```bash
npm install -g pm2
```

Khởi động ứng dụng:

```bash
# Một instance (khuyến nghị khi dùng SQLite)
NODE_ENV=production pm2 start src/server.js --name "api"

# Cluster mode (chỉ nên dùng khi sử dụng PostgreSQL hoặc shared DB khác)
NODE_ENV=production pm2 start src/server.js --name "api" -i max
```

Lưu danh sách process và bật tự khởi động khi reboot:

```bash
pm2 save
pm2 startup
# Làm theo hướng dẫn in ra từ lệnh trên
```

### Các lệnh PM2 thường dùng

```bash
# Xem logs realtime
pm2 logs api

# Restart sau khi cập nhật code
pm2 restart api

# Xem trạng thái
pm2 status

# Dừng ứng dụng
pm2 stop api
```

---

## Bước 5 — Cấu hình Nginx làm reverse proxy (tùy chọn nhưng khuyến nghị)

```nginx
server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Lấy SSL certificate với Certbot:

```bash
certbot --nginx -d api.your-domain.com
```

> **Lưu ý:** Sau khi cấu hình Nginx, đảm bảo `ALLOWED_ORIGINS` trong `.env` bao gồm domain frontend của bạn.

---

## Health Check

Ứng dụng cung cấp endpoint `/health`:

```bash
curl http://localhost:4000/health
# {"status":"ok","db":"ok","uptime":120,"version":"1.0.0"}
```

- Trả về `200 { "status": "ok" }` khi server và database hoạt động bình thường.
- Trả về `200 { "status": "degraded", "db": "error" }` nếu database không kết nối được.

Dùng endpoint này với load balancer hoặc uptime monitor.

---

## Cập nhật ứng dụng

```bash
cd /opt/api
git pull
yarn install --frozen-lockfile
yarn migrate      # chạy các migration mới
pm2 restart api
```

---

## SQLite và persistence

File database lưu tại đường dẫn được định nghĩa bởi `DB_NAME` (ví dụ `./storage/production.db`).

**Sao lưu:**

```bash
# Copy file DB ra ngoài
sqlite3 ./storage/production.db ".backup '/tmp/backup.db'"
scp /tmp/backup.db user@backup-server:/backups/
```

> Nếu dự án cần chạy nhiều server song song hoặc yêu cầu HA, hãy chuyển sang PostgreSQL bằng cách cập nhật `DIALECT`, `DB_HOST`, `DB_USER`, `DB_PASS`, và `DB_NAME` trong `.env`. SQLite chỉ phù hợp cho single-server deployment và nên chạy với một tiến trình PM2.

---

## Checklist trước deploy lần đầu

- [ ] `.env` — `JWT_SECRET` và `DB_NAME` đã được đặt
- [ ] `NODE_ENV=production` trong `.env`
- [ ] `DIALECT` đã được chọn rõ ràng (`sqlite` cho một instance hoặc `postgres` cho shared DB)
- [ ] Đã chạy database migrations (`yarn migrate`)
- [ ] Admin user đã được seed (`yarn seed`) hoặc tạo thủ công
- [ ] Port server (`PORT`) accessible hoặc Nginx đã cấu hình
- [ ] `ALLOWED_ORIGINS` bao gồm tất cả domain frontend
- [ ] PM2 startup script đã đăng ký (`pm2 startup && pm2 save`)
