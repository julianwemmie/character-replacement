# Setup & Wiring Instructions

## Environment Variables

Create a `.env` file in `site/backend/` with all of the following:

```
PORT=3001
CORS_ORIGIN=http://localhost:5173

# Turso
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=<token>

# Better Auth + Google OAuth
BETTER_AUTH_SECRET=<random 32+ char string>
BETTER_AUTH_URL=http://localhost:3001
GOOGLE_CLIENT_ID=<client_id>
GOOGLE_CLIENT_SECRET=<client_secret>

# Modal
MODAL_TOKEN_ID=<modal_token_id>
MODAL_TOKEN_SECRET=<modal_token_secret>
MODAL_SERVE_ENDPOINT=https://<workspace>--character-replacement-site-serve-file.modal.run

# Resend (Email)
RESEND_API_KEY=<key>
EMAIL_FROM=notifications@yourdomain.com

# Webhook
WEBHOOK_SECRET=<random secret>
```

---

## 1. Turso Database

1. Create account at https://turso.tech
2. Create database (e.g., `character-replacement`)
3. Generate auth token
4. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
5. Schema auto-creates on first backend start, or run `npm run seed` in `site/backend/`

## 2. Google OAuth (for Better Auth)

1. Go to https://console.cloud.google.com, create project
2. Enable Google+ API
3. Create OAuth 2.0 Client ID (Web application)
   - **Authorized JS origins**: `http://localhost:3001`, `http://localhost:5173`, production domain
   - **Redirect URIs**: `http://localhost:3001/api/auth/callback/google`, production equivalent
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
5. Generate a random 32+ character string for `BETTER_AUTH_SECRET`
6. Set `BETTER_AUTH_URL` to your backend URL

## 3. Modal (GPU Platform)

1. Create account at https://modal.com
2. Create API token -> set `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`
3. Download model weights (first time only, ~56GB):
   ```bash
   modal run wan-modal/app.py::download_model
   ```
4. Deploy both Modal apps:
   ```bash
   modal deploy wan-modal/app.py
   modal deploy site/modal/app.py
   ```
5. Note the serve endpoint URL from `site/modal` deployment, set `MODAL_SERVE_ENDPOINT`

## 4. Resend (Email Notifications)

1. Create account at https://resend.com
2. Generate API key
3. Verify sender domain (or use `noreply@resend.dev` for testing)
4. Set `RESEND_API_KEY` and `EMAIL_FROM`

Note: Email sending is optional. If `RESEND_API_KEY` is not set, emails are skipped gracefully.

## 5. Webhook Secret

1. Generate a random secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Set `WEBHOOK_SECRET`

---

## Install & Run (Development)

```bash
# Install dependencies
cd site/shared && npm install
cd site/backend && npm install
cd site/frontend && npm install

# Start dev servers (two terminals)
cd site/backend && npm run dev    # Express API on :3001
cd site/frontend && npm run dev   # Vite dev server on :5173
```

The frontend proxies `/api` requests to the backend automatically.

## Build & Run (Production)

```bash
# Build frontend
cd site/frontend && npm run build

# Build backend
cd site/backend && npm run build

# Start (Express serves both API and frontend static files)
cd site/backend && npm start
```

## Production Deployment (Railway)

- Deploy `site/backend/` with built frontend in `site/frontend/dist/`
- Set all environment variables in Railway dashboard
- Update `BETTER_AUTH_URL` and `CORS_ORIGIN` to production domain
- Update Google OAuth redirect URIs in Google Cloud Console to production domain
