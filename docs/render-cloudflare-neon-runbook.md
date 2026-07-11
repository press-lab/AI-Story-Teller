# Render, Cloudflare Pages, And Neon Runbook

Use this runbook after Cloudflare DNS is active, Neon has a Postgres connection
string, and Render is waiting for service configuration.

## Current Free/No-Email Constraint

The owner is not adding Render billing or Resend yet. Read
`docs/render-free-no-email-context.md` before changing or redeploying the live
Render service.

The Starter + Resend configuration below remains the later production target.
The current controlled-UAT repository contract is now implemented as:

```text
Plan: Free
Branch: backend-local-implementation
Build Command: npm run api:render:build
Pre-Deploy Command: blank
Start Command: npm run api:hosted:free
Health Check Path: /readyz
AIST_EMAIL_DELIVERY_MODE=disabled
AIST_PASSWORD_SIGNUP_MODE=trustedInvite
AIST_POLICY_MODE=reviewOnly
```

`api:hosted:free` serializes compiled migrations before listening. The live
dashboard was reconciled to these values on July 10, 2026; keep it aligned and
keep account creation impossible without a valid invite. `trustedInvite`
creates an active, unverified account and session; password recovery and email
verification delivery remain disabled. Do not use fake email credentials.

## Render Web Service

Create a Render **Web Service** from the private GitHub repository.

Recommended fields:

```text
Name: storymode-api
Runtime: Node
Branch: backend-local-implementation
Region: closest available region to the Neon project
Build Command: npm run api:render:build
Start Command: npm run api:hosted
Pre-Deploy Command: npm run api:db:migrate
Health Check Path: /readyz
Instance Type: Starter or higher (pre-deploy migrations require a paid service)
```

Do not use `npm.cmd` in Render. Render runs Linux, so use `npm`.
The Render build explicitly installs build dependencies, compiles the hosted
server and migration entrypoints, and prunes development dependencies. Both the
pre-deploy migration and start commands then execute compiled JavaScript with
Node.

Render environment variables:

```text
NODE_VERSION=24
NODE_ENV=production
AIST_API_HOST=0.0.0.0
AIST_DATABASE_URL=<Neon connection string>
DATABASE_DIRECT_URL=<Neon direct connection string for migrations>
AIST_TRUST_PROXY_HOPS=1
AIST_API_ALLOWED_ORIGINS=https://story.storymodeai.com
AIST_WEB_APP_URL=https://story.storymodeai.com/
AIST_PUBLIC_API_BASE_URL=https://api.storymodeai.com
AIST_ADMIN_EMAILS=<owner admin email>
AIST_PROVIDER_NAME=deepseek
AIST_PROVIDER_BASE_URL=https://api.deepseek.com
AIST_PROVIDER_MODEL=deepseek-chat
AIST_PROVIDER_API_KEY=<provider secret>
AIST_POLICY_MODE=reviewOnly
AIST_PASSWORD_SIGNUP_MODE=emailVerification
AIST_EMAIL_DELIVERY_MODE=resend
AIST_API_ALLOW_LOCAL_GOOGLE_STUB=false
AIST_GOOGLE_CLIENT_ID=<Google OAuth client id>
AIST_GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
AIST_GOOGLE_REDIRECT_URI=https://api.storymodeai.com/auth/google/callback
RESEND_API_KEY=<Resend API key>
AIST_EMAIL_FROM=AI Story Teller <accounts@storymodeai.com>
```

`AIST_TRUST_PROXY_HOPS=1` trusts exactly Render's final reverse-proxy hop. Do
not increase it to accept arbitrary client-supplied forwarding chains.

### API environment-variable ownership

| Variable | Owner/location | Secret | Required / default |
| --- | --- | --- | --- |
| `NODE_ENV` | Render | No | Required: `production` |
| `NODE_VERSION` | Render | No | Required: `24` |
| `PORT` | Render platform | No | Injected by Render |
| `AIST_API_HOST` | Render | No | `0.0.0.0` |
| `AIST_API_PORT` | Local only | No | Leave unset on Render |
| `AIST_API_DATA_FILE` | Local only | No | JSON fallback path; unused with Neon |
| `AIST_DATABASE_URL` or `DATABASE_URL` | Render/Neon | Yes | Neon pooled runtime URL; one is required |
| `DATABASE_DIRECT_URL` | Render/Neon | Yes | Neon direct migration URL; required for pre-deploy migrations |
| `AIST_DATABASE_POOL_MAX` | Render | No | Optional, default `10` |
| `AIST_DATABASE_CONNECTION_TIMEOUT_MS` | Render | No | Optional, default `5000` |
| `AIST_DATABASE_IDLE_TIMEOUT_MS` | Render | No | Optional, default `30000` |
| `AIST_DATABASE_STATEMENT_TIMEOUT_MS` | Render | No | Optional, default `30000` |
| `AIST_DATABASE_LOCK_TIMEOUT_MS` | Render | No | Optional, default `5000` |
| `AIST_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS` | Render | No | Optional, default `15000` |
| `AIST_TRUST_PROXY_HOPS` | Render | No | Required: `1` |
| `AIST_API_ALLOWED_ORIGINS` | Render | No | Required exact comma-separated Pages origins; no wildcards |
| `AIST_WEB_APP_URL` | Render | No | Required canonical Pages URL for auth links/redirects |
| `AIST_API_ADMIN_KEY` | Render | Yes | Optional break-glass admin credential |
| `AIST_ADMIN_EMAILS` | Render | Sensitive | Optional bootstrap/repair admin email list. Durable admin roles live in backend data (`users.role`) and can be managed from Admin Console. |
| `AIST_API_ALLOW_LOCAL_GOOGLE_STUB` | Render | No | Required: `false` |
| `AIST_GOOGLE_CLIENT_ID` | Render/Google | Sensitive | Required for Google sign-in |
| `AIST_GOOGLE_CLIENT_SECRET` | Render/Google | Yes | Required for Google sign-in |
| `AIST_GOOGLE_REDIRECT_URI` | Render/Google | No | Required exact hosted API callback |
| `AIST_GOOGLE_AUTH_URL` | Render | No | Optional Google default |
| `AIST_GOOGLE_TOKEN_URL` | Render | No | Optional Google default |
| `AIST_GOOGLE_TOKEN_INFO_URL` | Render | No | Optional Google default |
| `AIST_PROVIDER_NAME` | Render | No | Required provider label |
| `AIST_PROVIDER_BASE_URL` | Render | No | Required HTTPS provider endpoint |
| `AIST_PROVIDER_MODEL` | Render | No | Required model identifier |
| `AIST_PROVIDER_API_KEY` | Render/provider | Yes | Required hosted generation credential |
| `AIST_PROVIDER_TEMPERATURE` | Render | No | Optional, default `0.7` |
| `AIST_PROVIDER_MAX_OUTPUT_TOKENS` | Render | No | Optional, default `1200` |
| `AIST_PROVIDER_TOP_P` | Render | No | Optional, default `0.95` |
| `AIST_PROVIDER_PRESENCE_PENALTY` | Render | No | Optional, default `0.8` |
| `AIST_PROVIDER_FREQUENCY_PENALTY` | Render | No | Optional, default `0` |
| `AIST_PROVIDER_PROMPT_CACHING` | Render | No | Optional, default `true` |
| `AIST_PROVIDER_OPENROUTER_SORT` | Render | No | Optional: `price`, `latency`, or `throughput` |
| `AIST_PROVIDER_OPENROUTER_DATA_COLLECTION` | Render | No | Optional: `allow` or `deny` |
| `AIST_POLICY_MODE` | Render | No | `reviewOnly` until owner approval, then `enforce` |
| `AIST_EMAIL_DELIVERY_MODE` | Render | No | Current UAT: `disabled`; later production: `resend` |
| `AIST_PASSWORD_SIGNUP_MODE` | Render | No | `disabled`, `emailVerification` (default), or current UAT `trustedInvite`; every mode requires an invite |
| `RESEND_API_KEY` | Render/Resend | Yes | Required for hosted verification/reset email |
| `AIST_EMAIL_FROM` | Render/Resend | No | Required verified sender |

Cloudflare Pages owns only `VITE_AIST_RUNTIME_MODE` (set to
`hostedBackend`) and `VITE_AIST_API_BASE_URL` (the public Render API URL).
Production and preview Pages origins must also be listed explicitly in
`AIST_API_ALLOWED_ORIGINS` on Render.

Leave `AIST_API_PORT` unset on Render. Render provides `PORT`, and
`api:hosted` uses it.

`AIST_EMAIL_FROM` must use a sender/domain verified in Resend. Hosted
`emailVerification` signup refuses to run without complete Resend delivery
configuration because tokens are never exposed through HTTP responses.
`trustedInvite` is valid only with disabled email and `reviewOnly`; it leaves
recovery and verification delivery unavailable. Configured or database-stored
bootstrap admin emails grant admin only after the account email has been
verified. Once granted, `users.role` is the durable source of truth; removing an
email from configuration must not silently demote an existing admin.

After Render deploys, verify the temporary Render URL first:

```text
https://<render-service>.onrender.com/readyz
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
AIST_EMAIL_DELIVERY_MODE=disabled
AIST_PASSWORD_SIGNUP_MODE=trustedInvite
Password recovery and email verification delivery: unavailable
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
