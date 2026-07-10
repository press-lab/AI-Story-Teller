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

Status: **Not started**

- Add bounded queries for sessions, users, profiles, admin status, adventures,
  usage, and audit records.
- Routine authentication and adventure routes must not call broad `db.read()`.
- Add a monotonically increasing adventure revision.
- Require expected revision for updates and return stable `409` conflicts.
- Remove the global advisory lock and collection-wide delete/reinsert behavior
  from ordinary requests.
- Provider/network calls must occur outside database transactions.
- Keep bulk read/write only for named import, export, backup, and migration tools.

### H4. Durable idempotency and usage reservation

Status: **Not started**

- Require an idempotency key for every provider-backed mutation.
- Persist user, operation, key, canonical request hash, state, response, and
  expiry.
- Same key/same body returns the stored response without another provider call.
- Same key/different body returns `409`.
- Reserve quota before provider dispatch and commit transcript, usage, and
  operation completion atomically.
- Frontend retries must reuse the original operation ID.

### H5. Adventure-scoped asynchronous frontend operations

Status: **Not started**

- Capture `adventureId`, base revision, and operation ID for every async action.
- Queue background work per adventure, not in one global queue.
- Verify origin adventure/revision before applying a result.
- Cancel or discard safely on adventure switch when routing back is impossible.
- Roll back only state created by the failed operation.
- Add deferred-promise tests for switching adventures and overlapping work.
- Prevent out-of-order autosaves from overwriting newer revisions.

### H6. Typed HTTP boundary and runtime request validation

Status: **Not started**

- Validate every request body at runtime; TypeScript generics are not validation.
- Add typed API errors with safe public codes/messages and internal causes.
- Correctly distinguish `400`, `401`, `403`, `404`, `409`, `413`, `422`, `429`,
  `500`, `502`, and `504`.
- Return a trace ID and redact secrets/provider payloads/SQL from logs and
  responses.
- Reject or omit CORS permission for disallowed origins and validate preflights.

### H7. Shared rate limiting and trusted proxy handling

Status: **Not started**

- Replace the module-global limiter with a shared atomic store.
- Configure the exact trusted Render proxy boundary.
- Key auth limits by trusted client-IP hash, normalized-email hash where
  applicable, and route.
- Do not use User-Agent as an identity boundary.
- Return stable `429` responses with `Retry-After` and bounded retention.

### H8. Production API artifact and process lifecycle

Status: **Completed July 10, 2026**

- Add a dedicated API build that emits production JavaScript.
- Production start must use `node`, not `tsx` or dev dependencies.
- Align the Node major in package metadata, CI, Cloudflare, and Render.
- Handle `SIGTERM`/`SIGINT`, stop accepting requests, close HTTP and Postgres,
  and fail nonzero on unsuccessful shutdown.
- CI must start and probe the exact production command.

### H9. Production policy approval and enforcement

Status: **Awaiting owner policy review**

- Finish manual review of the versioned policy pack, thresholds, refusal copy,
  retention, restriction transitions, appeal/export behavior, and fixtures.
- Keep `reviewOnly` for owner/UAT evaluation.
- Do not treat policy categories as blocked in public production until the
  reviewed pack is deployed with `AIST_POLICY_MODE=enforce`.

## P1 Architecture And Operations

### A1. OAuth exchange and browser session hardening

- Replace long-lived session data in OAuth fragments with a five-minute,
  one-use exchange code.
- Prefer an HttpOnly, Secure, SameSite session cookie; if bearer tokens remain,
  return them only from the POST exchange response.
- Add server-side logout/revocation and CSRF protections appropriate to the
  final cookie strategy.

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

- Rewrite README and AGENTS around explicit Hosted Production, Owner/UAT
  Rollback, and Browser Local modes.
- Document every environment variable, owner, secrecy, and deployment location.
- Remove committed Vite logs and ignore runtime log artifacts.
- Disable GitHub Pages production deployment only after Cloudflare cutover is
  verified; keep the workflow available as rollback until then.

## Validation Baseline

Verified before hardening began on July 10, 2026:

- `npm.cmd test`: 55 files, 408 tests passed.
- `npm.cmd run build`: passed with a large-chunk warning.
- `npm.cmd run smoke:prod`: passed.

Latest completed workstream validation:

- H1 targeted tests: passed.
- `npm.cmd test`: 56 files, 414 tests passed.
- `npm.cmd run build`: passed with the existing large-chunk warning.
- `npm.cmd run smoke:prod`: passed.
