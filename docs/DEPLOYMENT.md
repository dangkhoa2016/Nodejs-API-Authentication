# Deployment Guide
> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](DEPLOYMENT.vi.md)

This guide explains how to deploy the application to a production server.

## Requirements

- Node.js 20+ and `yarn` (or `npm`) on the server
- A Linux server with SSH access
- A domain/hostname pointing to the server's IP (for SSL with Nginx)
- SQLite and PostgreSQL are both supported. The sample `.env.sample` uses SQLite for simplicity, while PostgreSQL is recommended for most production deployments.

---

## Step 1 — Clone the repository and install dependencies

```bash
git clone https://github.com/your-org/nodejs-api-authentication.git /opt/api
cd /opt/api
yarn install --frozen-lockfile
```

`yarn migrate` and `yarn seed` use `sequelize-cli`, which is currently defined in `devDependencies`, so a production-only install would omit the tooling needed by the documented setup flow.

---

## Step 2 — Configure environment variables

Copy the sample file and fill in all required values:

```bash
cp .env.sample .env
nano .env
```

Key variables for production:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `JWT_SECRET` | ✅ | — | Must be ≥ 32 random characters. `openssl rand -base64 32` |
| `DB_NAME` | ✅ | — | Path to the SQLite file, e.g. `./storage/production.db` |
| `PORT` | Recommended | `4000` | Port the server listens on |
| `NODE_ENV` | Recommended | `development` | Set to `production` |
| `DIALECT` | Optional | `sqlite` in `.env.sample` | Set `postgres` for PostgreSQL. If unset in production, runtime falls back to `postgres`. |
| `DB_HOST` | Conditional | — | Required when `DIALECT=postgres` |
| `DB_USER` | Conditional | — | Required when `DIALECT=postgres` |
| `DB_PASS` | Conditional | — | Required when `DIALECT=postgres` |
| `APP_URL` | Optional | `http://localhost:4000` | Base URL used for password reset and email confirmation links |
| `LOGIN_RATE_LIMIT` | Optional | `5` | Max login attempts per 60s per IP |
| `ALLOWED_ORIGINS` | Optional | `http://localhost:3000,...` | Comma-separated CORS origins |
| `JWT_CLEANUP_INTERVAL_MS` | Optional | `3600000` | Cleanup interval in ms (1 hour) |
| `MAX_FAILED_ATTEMPTS` | Optional | `5` | Max failed logins before account lock |
| `ACCOUNT_LOCK_DURATION_MS` | Optional | `1800000` | Account lock duration (30 minutes) |
| `LOG_FOLDER` | Optional | `./logs` | Directory for Winston file logs |
| `LOG_FILE` | Optional | `combined.log` | Winston log filename |

---

## Step 3 — Set up the database

Run migrations to create all tables:

```bash
yarn migrate
```

Seed the initial admin user (reads `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` from `.env`):

```bash
yarn seed
```

---

## Step 4 — Start with PM2 (recommended)

Install PM2 globally:

```bash
npm install -g pm2
```

Start the application:

```bash
# Single instance (recommended for SQLite)
NODE_ENV=production pm2 start src/server.js --name "api"

# Cluster mode (recommended only when using PostgreSQL or another shared DB)
NODE_ENV=production pm2 start src/server.js --name "api" -i max
```

Save the process list and enable autostart on reboot:

```bash
pm2 save
pm2 startup
# Follow the instructions printed by the command above
```

### Common PM2 commands

```bash
# View real-time logs
pm2 logs api

# Restart after code update
pm2 restart api

# View status
pm2 status

# Stop the app
pm2 stop api
```

---

## Step 5 — Configure Nginx as a reverse proxy (optional but recommended)

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

Obtain an SSL certificate with Certbot:

```bash
certbot --nginx -d api.your-domain.com
```

> **Important:** After configuring Nginx, ensure `ALLOWED_ORIGINS` in `.env` includes your frontend domain.

---

## Health Check

The application exposes a `/health` endpoint:

```bash
curl http://localhost:4000/health
# {"status":"ok","db":"ok","uptime":120,"version":"1.0.0"}
```

- Returns `200 { "status": "ok" }` when the server and database are healthy.
- Returns `200 { "status": "degraded", "db": "error" }` if the database is unreachable.

Use this endpoint with your load balancer or uptime monitor.

---

## Updating the application

```bash
cd /opt/api
git pull
yarn install --frozen-lockfile
yarn migrate      # run any new migrations
pm2 restart api
```

---

## SQLite and persistence

The database file is stored at the path defined by `DB_NAME` (e.g. `./storage/production.db`).

**Backup:**

```bash
# Copy the DB file to a backup location
sqlite3 ./storage/production.db ".backup '/tmp/backup.db'"
scp /tmp/backup.db user@backup-server:/backups/
```

> If the project requires multi-server deployment or high availability (HA), switch to PostgreSQL by updating `DIALECT`, `DB_HOST`, `DB_USER`, `DB_PASS`, and `DB_NAME` in `.env`. SQLite is suitable only for single-server setups and should run as a single PM2 instance.

---

## Pre-deployment checklist (first time)

- [ ] `.env` — `JWT_SECRET` and `DB_NAME` are set
- [ ] `NODE_ENV=production` in `.env`
- [ ] `DIALECT` is chosen explicitly (`sqlite` for single-instance or `postgres` for shared DB)
- [ ] Database migrations run (`yarn migrate`)
- [ ] Admin user seeded (`yarn seed`) or created manually
- [ ] Server port (`PORT`) is accessible or Nginx is configured
- [ ] `ALLOWED_ORIGINS` includes all frontend domains
- [ ] PM2 startup script registered (`pm2 startup && pm2 save`)
