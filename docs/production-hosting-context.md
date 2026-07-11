# Production Hosting Context

This is the current cost-minimized hosting decision for moving AI Story Teller
off GitHub Pages and off the owner's local machine.

Use this when the task is production hosting, managed backend deployment,
domain routing, database migration, or replacing the Cloudflare Quick Tunnel /
owner-PC UAT path. For local owner-backend repair, use
`docs/agent-cloudflare-owner-backend-context.md` instead.

## Decision

For the next productionizing step, use:

- Source control: private GitHub repository.
- DNS and TLS: Cloudflare.
- Frontend: Cloudflare Pages for the Vite static build.
- Backend API: Render Web Service for the existing Node API.
- Database: Neon Postgres.
- Transactional email: Resend.
- Monitoring: Sentry free tier plus Render logs at first.

This stack gets the public app off GitHub Pages and moves backend persistence,
auth, model calls, admin tools, policy decisions, and scenario publishing off
the owner's local machine while minimizing fixed monthly cost.

Current owner constraint: Render billing and Resend are deferred. The immediate
architecture is therefore controlled UAT on Render Free and Neon. Existing
accounts can log in, and a valid invite link may create an active unverified
account and session. Signup without an invite, mailbox verification delivery,
and password recovery remain unavailable. See
`docs/render-free-no-email-context.md`. Do not present this temporary mode as
public production.

## Cost-Minimized Starting Stack

| Need | Service | Starting plan | Notes |
| --- | --- | --- | --- |
| Web app | Cloudflare Pages | Free | Builds React/Vite with `npm run build`, serves `dist`, supports custom domains and preview deploys. |
| API | Render Web Service | Free first | Good for UAT and low-traffic testing. Free service cold-starts after idle time, so upgrade when testers hit latency. |
| Database | Neon Postgres | Free first | Better early persistence than Render free Postgres because Render free Postgres expires; Neon scales to zero and has no monthly minimum on paid usage. |
| Email | Deferred | None for current UAT | Trusted-invite account creation works without claiming mailbox verification; verification delivery and password recovery remain unavailable. |
| DNS | Cloudflare | Free | Use `story.storymodeai.com` for web and `api.storymodeai.com` for API. |
| Error tracking | Sentry | Free first | Add frontend and backend error capture before public testers depend on the service. |

Expected fixed cost at first: `0 USD/month` plus provider/model usage and the
domain. The first likely paid upgrade is Render API compute.

## Upgrade Ladder

1. Start with Cloudflare Pages Free, Render Web Service Free, Neon Free, Resend
   Free, and Sentry Free.
2. Upgrade Render API to a paid always-on instance when cold starts become a
   product problem. This is the first spend that makes sense.
3. Upgrade Neon when user saves become production-critical enough to require
   more storage, longer restore windows, or predictable production support.
4. Add Cloudflare R2 when scenario thumbnails, export bundles, attachments, or
   replay/support bundles need object storage.
5. Add Redis or a managed queue only when background memory/audit/import jobs
   need to continue outside request lifetimes.
6. Add Stripe only after server-side usage metering, model cost controls, and
   entitlement checks are verified.

## Why Not AWS Right Now

AWS is a valid later target, but it is not the best first production move for
this app if cost and operational simplicity matter.

The AWS equivalent would be:

- Frontend: Amplify Hosting or S3 plus CloudFront.
- API: Elastic Beanstalk or ECS/Fargate.
- Database: RDS Postgres.
- Secrets: Secrets Manager.
- Logs: CloudWatch.
- Storage: S3.

That stack is more durable at scale, but it introduces IAM, VPC/security group,
deployment, observability, and cost surface before the product needs that level
of control. The current risk is not hyperscale. The current risk is local-machine
dependency, public GitHub Pages deployment, provider secrets, durable saves, and
testable rollback.

## Why Not Use Render For Everything

Render is a good fit for the API, but Neon is a better cheap first database.

Render free Postgres databases are temporary and expire. That is not acceptable
for user save data, even during early productionizing. Render paid Postgres is
a reasonable later consolidation choice, but Neon is the lower-cost starting
point for durable Postgres.

## Why Not Vercel For The API

Vercel is good for frontend and serverless apps, but this backend is a normal
long-running Node API with auth, sessions, provider calls, admin tools, policy
gates, imports, and later workers. Serverless function limits and duration
constraints are not the natural shape for the current API.

## Domain Layout

Use:

- `https://story.storymodeai.com` -> Cloudflare Pages frontend.
- `https://api.storymodeai.com` -> Render Web Service backend.

The Cloudflare Pages frontend build should set Vite-visible variables:

```text
VITE_AIST_RUNTIME_MODE=hostedBackend
VITE_AIST_API_BASE_URL=https://api.storymodeai.com
```

The backend should allow only the real frontend origins in CORS:

```text
AIST_API_ALLOWED_ORIGINS=https://story.storymodeai.com,<preview origins as needed>
```

Do not use `*.trycloudflare.com` URLs in production. They are temporary UAT
plumbing only.

## Required Repo Changes

Before deploying to Render, make the API hostable as a managed web service:

1. Add or update a production API start command.
2. Make the API bind to `0.0.0.0` in hosted mode.
3. Make the API listen on `process.env.PORT` when provided.
4. Keep local owner mode bound to `127.0.0.1` unless explicitly overridden.
5. Confirm Postgres uses `DATABASE_URL` / `AIST_DATABASE_URL`.
6. Confirm frontend hosted mode reads `AIST_PUBLIC_API_BASE_URL`.
7. Set secure session cookie behavior for HTTPS production.
8. Lock CORS to `story.storymodeai.com` plus explicit preview origins.
9. Make Google OAuth redirect URLs point at the hosted API callback.
10. Add deployment docs for Cloudflare Pages, Render, Neon, and Resend.

## Initial Environment Variables

Render API:

```text
NODE_ENV=production
AIST_API_HOST=0.0.0.0
AIST_DATABASE_URL=<Neon pooled or direct connection URL>
AIST_API_ALLOWED_ORIGINS=https://story.storymodeai.com
AIST_WEB_APP_URL=https://story.storymodeai.com/
AIST_PUBLIC_API_BASE_URL=https://api.storymodeai.com
AIST_ADMIN_EMAILS=<owner/admin emails>
AIST_PROVIDER_NAME=<provider id>
AIST_PROVIDER_BASE_URL=<provider base URL>
AIST_PROVIDER_MODEL=<model>
AIST_PROVIDER_API_KEY=<secret>
AIST_POLICY_MODE=reviewOnly
AIST_PASSWORD_SIGNUP_MODE=emailVerification
AIST_EMAIL_DELIVERY_MODE=resend
AIST_GOOGLE_CLIENT_ID=<secret>
AIST_GOOGLE_CLIENT_SECRET=<secret>
AIST_GOOGLE_REDIRECT_URI=https://api.storymodeai.com/auth/google/callback
```

Cloudflare Pages:

```text
VITE_AIST_RUNTIME_MODE=hostedBackend
VITE_AIST_API_BASE_URL=https://api.storymodeai.com
```

Resend:

```text
RESEND_API_KEY=<secret>
AIST_EMAIL_FROM=<verified sender>
```

Use exact variable names already supported by the code where possible. If adding
new variables, document them in `.env.example`.

## Migration Order

1. Make the GitHub repository private.
2. Prepare the API for Render hosting.
3. Create the Neon Postgres database.
4. Run migrations against Neon.
5. Export or migrate owner UAT data from the local Postgres database.
6. Deploy the Render API and verify `GET /version`.
7. Configure `api.storymodeai.com`.
8. Configure Google OAuth hosted redirect URI.
9. Configure Cloudflare Pages for the frontend.
10. Set `VITE_AIST_RUNTIME_MODE=hostedBackend` and
    `VITE_AIST_API_BASE_URL=https://api.storymodeai.com`.
11. Deploy Cloudflare Pages to `story.storymodeai.com`.
12. Smoke test auth, Profile, Explore, adventure save/load, generation, Context
    Preview, Admin Console, publish/fork, and policy logging.
13. Keep the owner local backend/tunnel path available as rollback for a short
    window.
14. Retire GitHub Pages and the Quick Tunnel/watchdog production path after the
    hosted path proves stable.

## Acceptance Checks

Minimum checks before treating the hosted stack as the live path:

- `https://story.storymodeai.com` serves the Cloudflare Pages build.
- `https://api.storymodeai.com/version` returns the API version.
- Browser network traffic never calls `localhost`, `127.0.0.1`, or
  `*.trycloudflare.com`.
- Password account creation rejects missing or invalid invites. The configured
  invite path (`trustedInvite` during no-email UAT or `emailVerification` after
  Resend) creates an account with the documented verification state:
  `trustedInvite` starts its session immediately, while `emailVerification`
  remains pending until the one-use email link is completed.
- Password recovery and verification delivery match the effective capability
  settings, and unverified accounts do not receive admin access from the email
  allowlist.
- Backend adventure save/load persists through Neon after browser refresh.
- Server-side generation works without browser provider keys.
- Admin Console loads through the hosted API.
- Context Preview works through the hosted API.
- Public scenario Explore and fork flows work through the hosted API.
- Policy decisions and safety events persist to hosted Postgres.
- CORS blocks unexpected origins.
- Provider keys and OAuth secrets are not present in the frontend bundle.

## Rollback

Keep the current owner-hosted local path until the hosted path has passed live
smoke testing.

Rollback should be DNS/config based:

- Point the frontend API URL back to the current owner-hosted public API only if
  absolutely needed.
- Do not migrate user data in a way that prevents exporting from Neon back to a
  local Postgres or JSON recovery path.
- Do not delete local owner backend data until hosted backups and exports have
  been verified.

## Sources

These sources were used for the July 2026 hosting decision and should be
rechecked before buying paid plans:

- Cloudflare Pages React deployment docs:
  https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
- Cloudflare Pages limits:
  https://developers.cloudflare.com/pages/platform/limits/
- Render web services docs:
  https://render.com/docs/web-services
- Render free service docs:
  https://render.com/docs/free
- Render pricing:
  https://render.com/pricing
- Neon pricing:
  https://neon.com/pricing
- Resend pricing:
  https://resend.com/pricing
