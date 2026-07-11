# Render Free And No-Email Implementation Context

Implementation status: **code and repository contract completed July 10,
2026; live Render dashboard reconciliation and deployment validation remain.**

Use this file for the next hosted deployment adaptation while the owner does
not want to add Render billing or Resend. This is a temporary controlled-UAT
architecture, not the final public-production architecture.

The later target remains Render Starter with a pre-deploy migration and Resend
transactional email. Do not delete or weaken that target. This context defines
the safe interim mode needed to run the compiled API on Render Free without
pretending unavailable capabilities work.

## Owner Decisions

Recorded July 10, 2026:

- Keep Render on the Free instance type for now. Do not request, enter, or
  authorize payment information.
- Do not add Resend yet.
- Do not require a real mailbox merely to reserve a future sender address.
  When email is enabled later, a verified `storymodeai.com` domain can send from
  an address such as `accounts@storymodeai.com` even if that inbox does not
  receive mail.
- Preserve `pages_version` as the GitHub Pages branch.
- Use `backend-local-implementation` as the hosted Cloudflare/Render source
  branch until the owner explicitly changes the deployment branch policy.
- Keep the current owner/local API available as rollback until the Free Render
  mode passes end-to-end UAT.

## Verified Live Render Drift

The existing manually configured Render service does not currently match the
repository contract:

- Instance type: Free.
- Git branch: `main`.
- Build command: `npm ci --include=dev && npm run build`, which builds the Vite
  frontend but does not create `dist-api`.
- Start command: `npm run api:hosted`.
- Pre-deploy command: unavailable on Free.
- Health check: `/version`.
- Auto-deploy: on commit.
- The service lacks `RESEND_API_KEY`, `AIST_EMAIL_FROM`,
  `AIST_TRUST_PROXY_HOPS`, and `DATABASE_DIRECT_URL`.

The observed deploy failure is therefore expected: Render tries to run
`dist-api/apps/api/hostedServer.js`, but the configured build command never
creates it. Correcting only the build command is insufficient because hosted
startup currently refuses missing email delivery configuration.

Do not repeatedly redeploy this service until the interim mode below exists.
Render retains the older successful deployment when a new revision fails.

## Interim Topology

```text
pages_version --------------------------> GitHub Pages fallback

backend-local-implementation ----------> Cloudflare Pages frontend
                                      -> Render Free compiled Node API
                                           |
                                           +--> Neon Postgres

owner/local API + owner Postgres --------> rollback only
```

Neon is a database, not a branch deployment target. GitHub Actions must use
disposable Postgres containers and must never receive production Neon secrets.
Only the Render service receives the Neon connection string.

## Required No-Email Capability Model

Add one explicit hosted email capability setting. Recommended contract:

```text
AIST_EMAIL_DELIVERY_MODE=disabled | resend
```

Defaults and safety rules:

- Hosted production defaults to `resend`; missing Resend configuration remains
  a startup error in that mode.
- `disabled` must be explicitly configured. Do not infer it silently from
  missing secrets.
- `disabled` is allowed only for controlled UAT while policy remains
  `reviewOnly`.
- Browser-local and owner-local behavior must remain unchanged unless their
  configuration explicitly opts into the same mode.
- Never use fake API keys, dummy sender values, or a silent email sink.
- Never return verification or reset tokens through hosted HTTP responses.

When email delivery is disabled:

- Password signup must return a stable service-unavailable capability error
  before consuming an invite or creating a user, credential, verification
  token, or outbox record.
- Verification resend and password-reset request/completion must be visibly
  unavailable and must not mutate authentication state.
- The response must be identical for existing and nonexistent accounts where
  account enumeration would otherwise be possible.
- Existing verified users may continue to use password login.
- Existing sessions may continue to authenticate normally.
- The frontend must hide or disable unavailable signup, verification, resend,
  and reset controls and explain that account email is not enabled during UAT.
- The frontend must not discover this state by parsing error strings.

Expose server capabilities through a small typed runtime contract, either in a
dedicated authenticated/public-safe endpoint or as a safe extension of the
release/config response. At minimum expose:

```ts
{
  passwordLogin: boolean;
  passwordSignup: boolean;
  passwordReset: boolean;
  emailVerificationDelivery: boolean;
  googleOAuth: boolean;
}
```

Capabilities must be derived from effective server configuration. Do not send
secret values or provider details to the browser.

## Free Render Migration Contract

Free Render does not support a pre-deploy command. The interim service must use
a separate compiled startup entrypoint rather than pretending the paid
pre-deploy phase exists.

Recommended commands:

```text
Build Command: npm run api:render:build
Start Command: npm run api:hosted:free
Health Check Path: /readyz
```

`api:hosted:free` must:

1. Run the compiled migration entrypoint with Node.
2. Use `DATABASE_DIRECT_URL` when present, otherwise the configured Neon
   runtime URL.
3. Acquire a Postgres advisory lock before applying migrations so simultaneous
   cold starts cannot race.
4. Keep migrations repeat-safe and bounded by connection, statement, and lock
   timeouts.
5. Exit nonzero without starting HTTP if migration fails or the schema is
   newer than the application supports.
6. Start the same compiled hosted server only after migration succeeds.
7. Avoid `tsx` and all development dependencies after the Render build prune.

The normal `api:hosted` command remains the paid-mode start command after a
successful pre-deploy migration. Do not make every paid service rerun migrations
on every restart.

## Required Render Free Settings

After the interim code and tests exist, reconcile the live Render service to:

```text
Branch: backend-local-implementation
Root Directory: blank
Build Command: npm run api:render:build
Pre-Deploy Command: blank (unavailable on Free)
Start Command: npm run api:hosted:free
Health Check Path: /readyz
Auto-Deploy: only after linked CI checks pass, if the dashboard supports it
```

Required nonsecret environment settings include:

```text
NODE_VERSION=24
NODE_ENV=production
AIST_API_HOST=0.0.0.0
AIST_TRUST_PROXY_HOPS=1
AIST_API_ALLOW_LOCAL_GOOGLE_STUB=false
AIST_POLICY_MODE=reviewOnly
AIST_EMAIL_DELIVERY_MODE=disabled
```

Continue to require the Neon URL, explicit allowed origins, canonical web URL,
admin boundary, and provider key. Google OAuth capability must be false unless
both Google client credentials and a valid hosted redirect URI are configured.

Do not add `RESEND_API_KEY` or `AIST_EMAIL_FROM` until the owner chooses to set
up Resend. Do not expose either as a Vite/Cloudflare Pages variable.

## Repository Configuration Strategy

The checked-in deployment configuration must describe the architecture being
used. The next implementation must choose one of these explicit strategies:

1. Change `render.yaml` to the current Free/no-email UAT contract and preserve
   the paid settings in documentation for the later upgrade; or
2. Keep `render.yaml` as the paid-production target and add a separately named,
   tested Free-UAT configuration that cannot be mistaken for production.

Do not leave the live service as an undocumented dashboard-only override. CI
must validate whichever Free configuration the owner actually deploys.

## Required Tests

- Hosted `resend` mode still refuses to start without both Resend settings.
- Hosted `disabled` mode starts without Resend settings only when explicitly
  configured.
- Disabled signup does not consume an invite or write user/token records.
- Disabled reset and verification delivery do not mutate auth state.
- Existing verified password login and existing sessions still work.
- Runtime capabilities match effective server configuration.
- Frontend controls match capabilities without parsing error strings.
- The Free startup command migrates an empty disposable Postgres database,
  becomes ready, and shuts down cleanly.
- A failed, locked, or future-schema migration prevents HTTP startup.
- Two concurrent Free startup attempts serialize migration work safely.
- The production artifact runs after development dependencies are pruned.
- GitHub Actions never receives production Neon credentials.

Run the full repository validation set after implementation:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run smoke:prod
```

Also run the Postgres integration and Free Render deployment-parity suites.

## Launch Boundary

Completing this interim architecture permits controlled UAT for existing
accounts. It does not permit unrestricted public signup or reliable paid AI
traffic.

Keep public signup visibly disabled until Resend or another reviewed durable
email provider is configured. Do not mark transactional email, account
recovery, or the paid Render pre-deploy architecture complete based on the
Free/no-email path.

## Later Upgrade To Starter And Resend

When the owner is ready:

1. Add and verify `storymodeai.com` in Resend.
2. Create a sending-only Resend API key restricted to the verified domain.
3. Configure `RESEND_API_KEY` and a sender such as
   `AI Story Teller <accounts@storymodeai.com>` in Render.
4. Set `AIST_EMAIL_DELIVERY_MODE=resend`.
5. Upgrade Render to Starter or higher.
6. Restore `npm run api:db:migrate` as the pre-deploy command.
7. Restore `npm run api:hosted` as the start command.
8. Run signup, verification, reset, migration-failure, readiness, and rollback
   checks before enabling public signup.

The sender address does not require an inbox merely to send, but a monitored
reply path should be added before public launch.
