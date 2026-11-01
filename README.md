# RealTrading

RealTrading is a React trading dashboard with a Node/Hono API, a persistent trading-bot scheduler, and MySQL-compatible storage.

## Local setup

1. Install Node.js 22 and a MySQL-compatible database.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `APP_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH`.
3. Generate a password hash with `node scripts/hash-password.mjs`.
4. Apply the schema with `npm run db:push`.
5. Run `npm ci`, `npm run build`, then `npm start`.

The admin login is provisioned from environment variables; the app has no public registration. Exchange API credentials are entered in the protected bot settings and encrypted at rest using the configured application secret.

## Production hosting

Run the included Docker image on a host that keeps a Node process running continuously. The bot scheduler runs in that process and is not suitable for a static-only or short-lived serverless deployment. Configure the required environment variables on the host; never commit `.env` or exchange credentials.
