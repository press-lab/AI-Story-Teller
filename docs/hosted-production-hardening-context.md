# Hosted Production Hardening Context

Use this file for work that prepares the Cloudflare Pages + Render + Neon
deployment for traffic beyond controlled owner/UAT testing. It records the
verified gaps, their dependencies, acceptance criteria, and implementation
status. Preserve Browser Local, the owner backend, and GitHub Pages as rollback
paths until the hosted stack has passed cutover testing.

## Current Verdict

- Keep Cloudflare Pages for the Vite frontend.
- Keep Render for the Node API; removing it would require a backend runtime
  migration to Workers or Pages Functions.
- Keep Neon for hosted Postgres.
- The current branch is acceptable for controlled UAT, not unrestricted public
  traffic.
- Do not remove the owner/local fallback or GitHub Pages workflow until hosted
  save/load, generation, auth, policy, and rollback checks have passed.

## Required Finish Rule

Complete one coherent workstream at a time. Each workstream must include its
tests, documentation/config updates, full validation when feasible, a scoped
commit, and a push. Update the status ledger below in the same commit.

## P0 Workstreams

### H1. Secure verification, password reset, and session lifecycle

Status: **Completed July 10, 2026**

Scope:

- `apps/api/auth.ts`
- `apps/api/server.ts`
- `apps/api/emailDelivery.ts`
- hosted configuration and frontend auth flows
- auth tests

Required outcomes:

- Hosted signup never returns a verification token.
- Password-reset request always returns the same generic `202` response.
- Hosted reset requests never return reset tokens.
- Verification/reset tokens remain hash-only at rest, expire, and are one-use.
- Password reset revokes every active session and invalidates every other reset
  token for that user.
- Verification and reset messages use an injectable email-delivery interface.
- Production delivery uses Resend configuration.
- Tests retrieve tokens from a fake delivery adapter, not HTTP responses.
- Any token echo/debug facility must be explicitly test-only and must refuse to
  run under `NODE_ENV=production`.

Acceptance checks:

- Existing and nonexistent reset emails have identical status and body.
- No hosted auth response contains `verificationToken` or `resetToken`.
- Verification and reset links work through the frontend.
- Reset invalidates old bearer sessions; replay and expired tokens fail.

Implemented evidence:

- `apps/api/emailDelivery.ts` provides the injectable delivery boundary and
  Resend adapter.
- Signup and reset HTTP responses no longer expose delivery tokens.
- The frontend consumes one-use verification/reset links and provides the
  password-reset request and completion screens.
- API tests use a fake delivery adapter and cover generic reset responses,
  session revocation, sibling-token invalidation, replay, and expiry.

### H2. Versioned SQL migrations, readiness, and real Postgres CI

Status: **Completed July 10, 2026**

- Add ordered, repeat-safe SQL migrations and `schema_migrations`.
- Rename the JSON-to-Postgres bulk importer so it is not called a schema
  migration.
- Use pooled `DATABASE_URL` at runtime and `DATABASE_DIRECT_URL` for migrations.
- Add bounded pool/query/transaction timeouts.
- Add `/livez` and schema-aware `/readyz`; Render must check `/readyz`.
- Refuse startup against an incompatible schema.
- Run real Postgres integration tests in CI, including empty-database migration,
  previous-schema migration, ownership, concurrency, and readiness failure.

### H3. Targeted repositories and revisioned adventure writes

Status: **Completed July 10, 2026**

- Add bounded queries for sessions, users, profiles, admin status, adventures,
  usage, and audit records.
- Routine authentication and adventure routes must not call broad `db.read()`.
- Add a monotonically increasing adventure revision.
- Require expected revision for updates and return stable `409` conflicts.
- Remove the global advisory lock and collection-wide delete/reinsert behavior
  from ordinary requests.
- Provider/network calls must occur outside database transactions.
- Keep bulk read/write only for named import, export, backup, and migration tools.

Implemented evidence:

- Session resolution, restrictions, profile/explore reads, and adventure
  list/get/save/delete use bounded repository methods in Postgres.
- Adventure writes carry `metadata.serverRevision`; stale writes return
  `409 stale_adventure_revision`.
- Provider work runs between short workspace load/commit phases, outside a
  database transaction. Ordinary broad mutations use record diffs rather than
  collection replacement and no longer take the global advisory lock.
- Postgres integration coverage races two writers against one revision.

### H4. Durable idempotency and usage reservation

Status: **Completed July 10, 2026**

- Require an idempotency key for every provider-backed mutation.
- Persist user, operation, key, canonical request hash, state, response, and
  expiry.
- Same key/same body returns the stored response without another provider call.
- Same key/different body returns `409`.
- Reserve quota before provider dispatch and commit transcript, usage, and
  operation completion atomically.
- Frontend retries must reuse the original operation ID.

Implemented evidence:

- Every provider-backed route requires `Idempotency-Key`; the durable Postgres
  claim stores the canonical request hash, state, response, timestamps, and
  expiry before provider dispatch.
- Same-key replays return the stored response, body mismatches return stable
  `409`, and pending/failed operations have explicit conflict behavior.
- The pending claim is the durable request/usage reservation. Transcript and
  usage commit through the revisioned adventure workspace; a crash cannot
  cause an automatic duplicate provider dispatch because the claim remains
  pending.
- Client operations generate one UUID per POST. Turn recovery reads the saved
  adventure rather than issuing a second paid POST.

### H5. Adventure-scoped asynchronous frontend operations

Status: **Completed July 10, 2026**

- Capture `adventureId`, base revision, and operation ID for every async action.
- Queue background work per adventure, not in one global queue.
- Verify origin adventure/revision before applying a result.
- Cancel or discard safely on adventure switch when routing back is impossible.
- Roll back only state created by the failed operation.
- Add deferred-promise tests for switching adventures and overlapping work.
- Prevent out-of-order autosaves from overwriting newer revisions.

Implemented evidence:

- Background queues carry their originating adventure id and never apply an
  Adventure A update to the currently visible Adventure B.
- Backend whole-adventure results, recovery, continue/regenerate, memory,
  semantic, arc, builder, and audit flows verify the origin before UI apply.
- Autosave reads the latest adventure through a ref and serializes writes;
  the backend adapter also serializes per-adventure saves and advances the
  expected server revision.
- Deferred-promise and fake-timer tests cover adventure switching and latest
  autosave selection.

### H6. Typed HTTP boundary and runtime request validation

Status: **Completed July 10, 2026**

- Validate every request body at runtime; TypeScript generics are not validation.
- Add typed API errors with safe public codes/messages and internal causes.
- Correctly distinguish `400`, `401`, `403`, `404`, `409`, `413`, `422`, `429`,
  `500`, `502`, and `504`.
- Return a trace ID and redact secrets/provider payloads/SQL from logs and
  responses.
- Reject or omit CORS permission for disallowed origins and validate preflights.

Implemented evidence:

- `ApiError` owns stable public status/code/message values and keeps internal
  causes server-side. Error responses include a trace id and never echo raw
  provider/SQL details.
- JSON shape and required auth/adventure/provider fields are runtime-checked;
  payload, auth, authorization, not-found, revision, policy, rate, internal,
  provider, and timeout failures map to their explicit statuses.
- Exact-origin CORS omits permission for unknown origins and rejects unknown
  preflights. `Idempotency-Key` is allowed.

### H7. Shared rate limiting and trusted proxy handling

Status: **Completed July 10, 2026**

- Replace the module-global limiter with a shared atomic store.
- Configure the exact trusted Render proxy boundary.
- Key auth limits by trusted client-IP hash, normalized-email hash where
  applicable, and route.
- Do not use User-Agent as an identity boundary.
- Return stable `429` responses with `Retry-After` and bounded retention.

Implemented evidence:

- Hosted counters are atomic Postgres rows shared by instances and cleaned at
  expiry. Local JSON mode uses its own development-only fallback.
- Buckets use route plus hashed trusted client IP and normalized identity; User
  Agent is not part of the boundary.
- Render is configured with exactly one trusted proxy hop. Tests prove spoofed
  forwarding headers are ignored when no proxy is trusted and verify stable
  `429` plus `Retry-After`.

### H8. Production API artifact and process lifecycle

Status: **Implemented July 10, 2026; awaiting deployment-parity CI**

Implementation context:

- `docs/render-deployment-contract-context.md`

- Add a dedicated API build that emits production JavaScript.
- Production start must use `node`, not `tsx` or dev dependencies.
- Align the Node major in package metadata, CI, Cloudflare, and Render.
- Handle `SIGTERM`/`SIGINT`, stop accepting requests, close HTTP and Postgres,
  and fail nonzero on unsuccessful shutdown.
- CI must start and probe the exact production command.

Implemented evidence:

- `render.yaml` uses a paid Starter service, `autoDeployTrigger: checksPass`,
  `/readyz`, and the canonical `api:render:build` entrypoint.
- The Render build explicitly includes build dependencies, emits both hosted
  server and migration entrypoints, copies SQL migrations, then prunes
  development dependencies.
- Production migration and startup execute compiled `dist-api` JavaScript with
  Node; local development retains the explicit `api:db:migrate:dev` command.
- `scripts/api-deployment-parity.mjs` creates disposable databases and verifies
  empty migration, repeat migration, schema version, readiness, graceful
  shutdown, and rejection of an incompatible future schema before startup.
- `.github/workflows/ci.yml` runs that exact clean-build and parity sequence on
  Node 24 with Postgres 16.

### H9. Production policy approval and enforcement

Status: **Awaiting owner policy review**

- Finish manual review of the versioned policy pack, thresholds, refusal copy,
  retention, restriction transitions, appeal/export behavior, and fixtures.
- Keep `reviewOnly` for owner/UAT evaluation.
- Do not treat policy categories as blocked in public production until the
  reviewed pack is deployed with `AIST_POLICY_MODE=enforce`.

## P1 Architecture And Operations

### A1. OAuth exchange and browser session hardening

Status: **Completed July 10, 2026**

- Replace long-lived session data in OAuth fragments with a five-minute,
  one-use exchange code.
- Prefer an HttpOnly, Secure, SameSite session cookie; if bearer tokens remain,
  return them only from the POST exchange response.
- Add server-side logout/revocation and CSRF protections appropriate to the
  final cookie strategy.

The current bearer-token strategy is retained. The callback now redirects with
only a hash-stored, five-minute, one-use exchange code; the SPA removes it from
the URL before POSTing it for a bearer session. Google network calls occur
outside database transactions. Tests cover replay, expiry, and URL leakage.

### A2. Module and shared-contract boundaries

- Split `src/App.tsx`, `src/hooks/useAdventureRuntime.ts`,
  `apps/api/server.ts`, and `apps/api/adventureStore.ts` by domain.
- Move reducer/context/memory/trigger code used by both runtimes into a clean
  shared engine package without React or browser dependencies.
- Use one set of runtime-validated request/response contracts on client and API.

### A3. Frontend delivery performance

- Add route/page-level dynamic imports and intentional chunk boundaries.
- Establish a bundle budget; the July 10 build emitted one roughly 1.23 MB
  minified JavaScript bundle (about 456 KB gzip).

### A4. Observability, retention, recovery, and deletion

- Add frontend/backend error capture, structured logs, alerting, and trace
  correlation.
- Define raw prompt/output, policy, usage, and audit retention.
- Add account export/deletion and server-session management.
- Configure Neon backup/restore expectations and rehearse a recovery.

### A5. Documentation and cutover cleanup

Status: **Completed July 10, 2026**

- Rewrite README and AGENTS around explicit Hosted Production, Owner/UAT
  Rollback, and Browser Local modes.
- Document every environment variable, owner, secrecy, and deployment location.
- Remove committed Vite logs and ignore runtime log artifacts.
- Disable GitHub Pages production deployment only after Cloudflare cutover is
  verified; keep the workflow available as rollback until then.

README and AGENTS now define Hosted Production, Owner/UAT Rollback, and Browser
Local separately. `render.yaml` and the hosted runbook document Render,
Cloudflare Pages, Neon, secrets, variables, migrations, probes, and rollback.
GitHub Pages is manual-only, and committed Vite logs were removed and ignored.

## ChatGPT Pro Recommendation Completion Map

1. Render production build/process: **implemented; CI confirmation pending (H8)**
2. Verification/reset disclosure: **complete (H1)**
3. Targeted session authorization: **complete (H3)**
4. Revisioned targeted adventure writes: **complete (H3)**
5. Paid-operation idempotency: **complete (H4)**
6. Shared rate limiter: **complete (H7)**
7. SQL migrations/readiness: **complete (H2)**
8. Adventure-scoped async work/autosave: **complete (H5)**
9. One-use OAuth exchange: **complete (A1)**
10. Typed errors/runtime validation/CORS: **complete (H6)**
11. Deployment documentation/config cleanup: **complete (A5)**

The separate A2-A4 entries below are additional architecture improvements from
the repo review, not part of the Pro review's numbered eleven.

## Validation Baseline

Verified before hardening began on July 10, 2026:

- `npm.cmd test`: 55 files, 408 tests passed.
- `npm.cmd run build`: passed with a large-chunk warning.
- `npm.cmd run smoke:prod`: passed.

Latest completed workstream validation:

- Focused hardening suite: 66 tests passed.
- `npm.cmd test`: 59 files passed, 1 Postgres-only file skipped; 428 tests
  passed and 5 skipped.
- Real local Postgres integration: 5 tests passed, including shared limiter,
  durable idempotency, migrations/readiness, and same-revision concurrency.
- `npm.cmd run build`: passed with the existing large-chunk warning.
- `npm.cmd run api:build`: passed.
- `npm.cmd run api:smoke`: passed against the compiled hosted entrypoint and
  Postgres-aware `/readyz`.
- `npm.cmd run smoke:prod`: passed.
