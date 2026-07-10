# Render, Cloudflare Pages, And Neon Runbook

Use this runbook after Cloudflare DNS is active, Neon has a Postgres connection
string, and Render is waiting for service configuration.

## Render Web Service

Create a Render **Web Service** from the private GitHub repository.

Recommended fields:

```text
Name: storymode-api
Runtime: Node
Branch: backend-local-implementation
Region: closest available region to the Neon project
Build Command: npm ci --include=dev && npm run build
Start Command: npm run api:hosted
Health Check Path: /version
Instance Type: Free for first UAT, paid Starter when cold starts become a problem
```

Do not use `npm.cmd` in Render. Render runs Linux, so use `npm`.

Render environment variables:

```text
NODE_VERSION=24
NODE_ENV=production
AIST_API_HOST=0.0.0.0
AIST_DATABASE_URL=<Neon connection string>
AIST_API_ALLOWED_ORIGINS=https://story.storymodeai.com
AIST_WEB_APP_URL=https://story.storymodeai.com/
AIST_PUBLIC_API_BASE_URL=https://api.storymodeai.com
AIST_ADMIN_EMAILS=<owner admin email>
AIST_PROVIDER_NAME=deepseek
AIST_PROVIDER_BASE_URL=https://api.deepseek.com
AIST_PROVIDER_MODEL=deepseek-chat
AIST_PROVIDER_API_KEY=<provider secret>
AIST_POLICY_MODE=reviewOnly
AIST_API_ALLOW_LOCAL_GOOGLE_STUB=false
AIST_GOOGLE_CLIENT_ID=<Google OAuth client id>
AIST_GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
AIST_GOOGLE_REDIRECT_URI=https://api.storymodeai.com/auth/google/callback
```

Leave `AIST_API_PORT` unset on Render. Render provides `PORT`, and
`api:hosted` uses it.

After Render deploys, verify the temporary Render URL first:

```text
https://<render-service>.onrender.com/version
```

Then add the custom domain in Render:

```text
api.storymodeai.com
```

Render will show the DNS target to add in Cloudflare. Add exactly that record in
Cloudflare DNS. Keep API records DNS-only if Render's instructions require it;
otherwise follow Render's Cloudflare-specific guidance.

## Cloudflare Pages

Create a Cloudflare Pages project from the GitHub repository.

Recommended fields:

```text
Project name: storymode-web
Production branch: backend-local-implementation
Framework preset: Vite or None
Build command: npm run build
Build output directory: dist
Root directory: /
```

Cloudflare Pages environment variables:

```text
VITE_AIST_RUNTIME_MODE=hostedBackend
VITE_AIST_API_BASE_URL=https://api.storymodeai.com
```

Use the temporary Render URL for `VITE_AIST_API_BASE_URL` only if
`api.storymodeai.com` is not ready yet. Replace it with the final API URL before
inviting testers.

After the first successful Pages deploy, add the custom domain:

```text
story.storymodeai.com
```

## Google OAuth

In Google Cloud Console, configure the hosted web OAuth client:

```text
Authorized JavaScript origin:
https://story.storymodeai.com

Authorized redirect URI:
https://api.storymodeai.com/auth/google/callback
```

The redirect URI must exactly match `AIST_GOOGLE_REDIRECT_URI` on Render.

## Current Product Posture

Launch settings:

```text
Invite-only: yes
AIST_POLICY_MODE=reviewOnly
Production traffic: hosted Render API + Neon Postgres
Owner local backend/watchdog: rollback only until hosted path is stable
Browser Local / personal models: keep available as the existing fallback path
```

The owner watchdog is no longer part of production once:

- Cloudflare Pages serves `story.storymodeai.com`.
- Render serves `api.storymodeai.com`.
- Neon is the active backend database.
- Browser traffic no longer calls `localhost`, `127.0.0.1`, GitHub Pages API
  variables, or `*.trycloudflare.com`.

Keep the watchdog temporarily as rollback until hosted save/load/generation have
been smoke tested.
