# Local Postgres Backend

Postgres is the recommended owner-server database before sending invites to real testers.

The API still supports the local JSON database for quick dev, but any shared UAT run should use Postgres through `AIST_DATABASE_URL`.

## Why Postgres Now

- The owner machine is the shared server for testers.
- Multiple users can sign up, log in, play, publish, and autosave at the same time.
- The JSON file is easy to inspect, but it is not a durable multi-user database.
- Postgres gives transactional writes, safer concurrent access, backup tooling, and a better migration path to a hosted backend later.

## Local Setup

Install or run Postgres locally. Keep it bound to localhost. Do not expose Postgres through Cloudflare Tunnel or router port forwarding.

For owner-hosted UAT, this repo includes an app-owned local Postgres flow that does not need the Windows `postgres` admin password. It uses the installed Postgres binaries, creates a separate cluster under `.local-backend/postgres-data`, and listens only on `127.0.0.1:55432`.

Initialize/start it with:

```sh
npm.cmd run owner:postgres:init
```

After the first run, start/check it with:

```sh
npm.cmd run owner:postgres:start
npm.cmd run owner:postgres:status
```

The script stores the generated database password in ignored local state:

```text
.local-backend/postgres-password.txt
```

It also writes `AIST_DATABASE_URL` into ignored `.env`.

Example database URL:

```text
AIST_DATABASE_URL=postgres://aist_owner:<generated_password>@127.0.0.1:55432/aist_local
```

The API creates its own app tables on startup:

```text
aist_meta
aist_records
```

`aist_records` stores one row per backend domain record, keyed by collection and stable domain id. This preserves existing users, profiles, adventures, scenarios, policy decisions, restrictions, usage logs, admin actions, and platform settings while keeping the current API behavior intact.

## Profile Scenario Inserts

Use the API whenever possible. A profile scenario is not an adventure save. It is a reusable template made from:

- one `scenarioDrafts` record for profile metadata
- at least one `scenarioRevisions` record containing the playable setup payload

The normal creation flow is:

1. `POST /scenarios` with `title`, optional `description`, and optional `sourceAdventureId`.
2. `POST /scenarios/:scenarioId/revisions` with the scenario content.
3. Optional: `POST /scenario-revisions/:revisionId/publish` to list it in Explore.
4. `POST /scenario-revisions/:revisionId/fork` to start a private adventure from it.

Do not add a scenario by editing premade source files unless the user explicitly asks for a built-in scenario. Do not insert only a `scenarioDrafts` row; Profile can list it, but there is no playable setup without a matching revision.

When a direct Postgres repair is unavoidable, write to `aist_records` with these collections and domain fields:

```text
collection = scenarioDrafts
id = <scenario id>
data.ownerUserId = <profile user id>
data.title = <scenario title>
data.description = <short profile description>
data.sourceAdventureId = <optional source adventure id>
data.createdAt / data.updatedAt = ISO timestamps

collection = scenarioRevisions
id = <revision id>
data.scenarioId = <scenario id>
data.ownerUserId = <same profile user id>
data.version = 1 or next integer
data.title / data.description = user-facing revision metadata
data.content = scenario setup payload
data.status = draft | published | quarantined
data.createdAt = ISO timestamp
data.publishedAt = ISO timestamp only when status is published
```

The revision `content` is the template copied into a new adventure. Keep it to reusable setup surfaces such as `openingScene`, `metadata`, `components`, `storyCards`, `brains`, `triggerRules`, and optional `thumbnailImage`. Do not copy private adventure transcripts unless the user explicitly requests that export behavior.

Use `ownerUserId` and `scenarioId`; do not use ad hoc field names like `ownerId` or `scenarioDraftId`. After manual inserts, verify `GET /profile/me` shows the scenario and `POST /scenario-revisions/:revisionId/fork` creates an adventure.

## Migrate From JSON

Back up the JSON file first:

```text
.local-backend/aist-api-db.json
```

Set `AIST_DATABASE_URL` in `.env`, or run `npm.cmd run owner:postgres:init` to set it automatically, then run:

```sh
npm.cmd run api:db:migrate:dev
npm.cmd run api:postgres:import
```

The command refuses to overwrite a non-empty Postgres database. To intentionally replace Postgres data from the JSON file:

```sh
npm.cmd run api:postgres:import -- --force
```

The migration preserves existing IDs. Existing active sessions may still work because session records migrate too, but for a cleaner tester transition you can ask users to log in again.

## Start With Postgres

Use the owner-hosted server command:

```sh
npm.cmd run api:serve
```

Or use the owner watchdog, which starts the app-owned Postgres cluster before the API when `.env` points at `127.0.0.1:55432/aist_local`:

```sh
npm.cmd run owner:watch
```

Check the API mode:

```text
https://your-public-api-domain.example/health
```

The response should include:

```json
{
  "ok": true,
  "database": "postgres"
}
```

If it says `local-json`, the API did not see `AIST_DATABASE_URL`.

## Backups

Before schema changes or broad tester runs, back up Postgres with `pg_dump`.

Keep the original `.local-backend/aist-api-db.json` backup until the Postgres run is verified.
