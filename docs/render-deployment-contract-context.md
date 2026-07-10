# Render Deployment Contract Context

Use this file for the next hosted-production implementation: make the Render
API deployable from a clean checkout against an empty Neon database, using the
same commands and runtime artifact that CI verifies.

Implementation status: **implemented and locally validated July 10, 2026;
awaiting the first successful `render-deployment-parity` GitHub Actions run.**

This is a deployment-integrity workstream. Do not combine it with telemetry,
authentication, adventure-revision, quota, or persistence refactors. Those
remain separate workstreams in `docs/hosted-production-hardening-context.md`.

## Current Decision

- Keep Cloudflare Pages for the Vite frontend.
- Keep Render for the compiled Node API.
- Keep Neon for hosted Postgres.
- Retain the pre-deploy migration step and use a paid Render web-service plan
  that supports it. `starter` is the default target unless the owner selects a
  higher plan.
- Changing the Blueprint does not authorize purchasing or applying a paid
  Render plan automatically. The owner must approve the resulting Render
  billing change when the Blueprint is synced.
- Keep `AIST_POLICY_MODE=reviewOnly`. Policy enforcement is a different public
  launch gate and must not be silently enabled by this workstream.
- Keep the owner/local backend and GitHub Pages paths intact as rollback paths.

## Verified Gaps At The Starting Commit

Starting commit: `54210cee02a3b400b399c5ee716e8a55eb5ca256` on
`backend-local-implementation`.

1. `render.yaml` combines `plan: free` with `preDeployCommand`. Render exposes
   pre-deploy commands only for paid web services, private services, and
   background workers.
2. `render.yaml` uses deprecated `autoDeploy: true`. The current field is
   `autoDeployTrigger`; production should use `checksPass` so a commit deploys
   only after its linked CI checks pass.
3. Render sets `NODE_ENV=production`, while `npm ci` omits development
   dependencies in that mode unless they are explicitly included.
4. The API build needs development-time type packages, and the migration
   command still invokes the development-only `tsx` binary.
5. `tsconfig.api.json` compiles `apps/api/hostedServer.ts` and its dependency
   graph, but does not include the independent `apps/api/migrateSchema.ts`
   entrypoint.
6. `@types/node` targets Node 25 while package metadata, CI, and Render target
   Node 24.
7. CI builds and smokes the hosted API, but it does not reproduce the clean
   production dependency installation, migrate an isolated empty database with
   the Render migration command, or prove a failed migration blocks startup.

Official platform references:

- Render deploy steps and paid pre-deploy availability:
  https://render.com/docs/deploys
- Render Blueprint fields and `autoDeployTrigger`:
  https://render.com/docs/blueprint-spec
- npm production omission and explicit inclusion behavior:
  https://docs.npmjs.com/cli/commands/npm-ci/

## Files In Scope

- `render.yaml`
- `package.json`
- `package-lock.json`
- `tsconfig.api.json`
- `scripts/prepare-api-dist.mjs`, only if artifact preparation needs adjustment
- `.github/workflows/ci.yml`
- a narrowly scoped deployment-parity test or script, if needed
- hosted deployment documentation affected by the final command contract

Do not change application routes, authentication, provider behavior, database
domain logic, frontend behavior, or production policy rules in this workstream.

## Required Implementation

### 1. Make The Blueprint Internally Valid

- Change the API service from `plan: free` to `plan: starter` or higher while
  retaining `preDeployCommand`.
- Replace `autoDeploy` with `autoDeployTrigger: checksPass`.
- Keep `/readyz` as the Render health check.
- Preserve the existing secret and environment-variable boundaries.
- Do not add secrets or concrete connection strings to the repository.

### 2. Produce A Complete Compiled API Artifact

- Compile both `apps/api/hostedServer.ts` and `apps/api/migrateSchema.ts` into
  `dist-api`.
- Keep copied SQL migration files available at the path resolved by the
  compiled migration program.
- Change the production migration command to execute compiled JavaScript with
  `node`.
- No Render build, migration, or start command may invoke `tsx`.
- Runtime startup and migration execution must not require development
  dependencies after the artifact has been built.

Local development commands may continue to use `tsx`; this restriction applies
to the Render production command path.

### 3. Make Dependency Installation Explicit

- The Render build must explicitly install the development dependencies needed
  to compile the artifact even with `NODE_ENV=production`.
- After compilation, development dependencies may be pruned if the migration
  and start commands still pass using only the production installation and
  `dist-api`.
- Align `@types/node` to the Node 24 runtime line and update the lockfile.
- Avoid moving build-only type or test packages into production dependencies
  merely to hide an installation mismatch.

Prefer one canonical build entrypoint shared by Render and CI over duplicating
a fragile command sequence in multiple places.

### 4. Add Deployment-Parity CI

CI must exercise the production path in an isolated job or equivalent clean
phase:

1. Set up Node 24 and `NODE_ENV=production`.
2. Perform the exact dependency-install/build entrypoint used by Render.
3. Start with an isolated empty Postgres database.
4. Run the exact compiled migration command used by `preDeployCommand`.
5. Verify the expected schema version exists.
6. Run the exact production start command.
7. Poll `/readyz` until it succeeds or a bounded deadline expires.
8. Send `SIGTERM` and require a successful graceful exit.
9. Exercise a deliberately incompatible or failed migration case and prove the
   deploy path fails before the service is treated as ready.

The failure test must not corrupt or reuse the database used by the ordinary
Postgres integration suite.

### 5. Keep Release Identity And Policy Honest

- Do not change `/version` in this workstream; accurate release identity is a
  separate small follow-up.
- Do not describe `reviewOnly` policy mode as public-production enforcement.
- Do not claim this workstream makes the application ready for public signup or
  paid traffic. It fixes the deployment contract only.

## Required Tests

At minimum, add automated coverage for:

- `migrateSchema.js` exists in `dist-api` after the API build.
- The compiled migration succeeds against an empty Postgres database.
- Re-running the migration is safe.
- The compiled hosted server becomes ready after migration.
- The server shuts down cleanly on `SIGTERM`.
- A failed or incompatible migration returns nonzero and prevents the startup
  phase in the deployment-parity path.
- Production commands work after development dependencies are unavailable or
  pruned.
- The Blueprint uses `autoDeployTrigger: checksPass`, a paid plan, and only
  compiled Node entrypoints for migration and startup.

## Acceptance Criteria

This workstream is complete only when all of the following are true:

- Every command referenced by `render.yaml` succeeds from a clean checkout.
- A new empty Neon-compatible Postgres database is migrated before startup.
- A migration failure fails the deployment path and the new service revision
  never becomes ready.
- Render migration and startup use `node` with compiled files, not `tsx`.
- Runtime migration/start do not require development dependencies.
- Render auto-deploy waits for CI checks to pass.
- Node runtime and Node type definitions use the same major version.
- Existing browser-local, owner-local, GitHub Pages, and Cloudflare Pages paths
  remain functional.
- The full repository validation set passes.

## Validation And Finish Workflow

Run the deployment-parity job locally where feasible, followed by:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run smoke:prod
```

Also run the API/Postgres validation introduced or affected by the change. Then:

1. Inspect `git status --short`.
2. Stage only this workstream's files.
3. Update H8 and the completion map in
   `docs/hosted-production-hardening-context.md` with verified evidence.
4. Commit the scoped change.
5. Push `backend-local-implementation`.
6. Report the full commit hash and any remaining external Render action.

Do not mark H8 complete merely because the YAML parses or the API builds on a
developer machine. Completion requires clean production-install, empty-database
migration, readiness, failed-migration, and shutdown evidence.

## External Handoff After Merge

Repository changes alone do not apply the paid Render plan. After merge and
before syncing the Blueprint, the owner must:

1. Review and approve the Render Starter-or-higher billing impact.
2. Confirm `DATABASE_DIRECT_URL` reaches the migration-safe Neon endpoint.
3. Sync the Blueprint and observe the pre-deploy migration logs.
4. Confirm the deployed SHA and `/readyz` on the new service revision.
5. Keep public signup and paid AI traffic disabled until the remaining P0
   integrity workstreams are complete.
