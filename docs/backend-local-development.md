# Local Backend Development

This is the owner-test local backend path for the `backend-local-implementation` branch.

## Start

```sh
npm.cmd install
npm.cmd run api:dev
```

Default API URL:

```text
http://127.0.0.1:8787
```

Default local database:

```text
.local-backend/aist-api-db.json
```

The frontend remains browser-local by default. In Settings -> Runtime, `Browser Local` keeps IndexedDB saves, browser provider settings, JSON backup/restore, AI Dungeon import, and GitHub saves independent from the backend.

## Backend Provider Config

Copy `.env.example` to `.env` and set:

```text
AIST_PROVIDER_API_KEY=...
AIST_PROVIDER_BASE_URL=...
AIST_PROVIDER_MODEL=...
```

Backend turns will fail clearly until `AIST_PROVIDER_API_KEY` is set. Browser-local generation still uses the existing localStorage provider presets.

## Policy Mode

```text
AIST_POLICY_MODE=reviewOnly
```

Logs reviewed harmful-category matches without enforcing those draft categories. Prompt injection and policy evasion still block because they attack the app boundary.

```text
AIST_POLICY_MODE=enforce
```

Enforces the draft rule pack for local owner testing.

Draft pack:

```text
apps/api/policy/rule-packs/manual-review-draft.json
```

Do not enable this pack for real users until the manual review gate in `docs/backend-implementation-plan.md` is complete.

## Smoke Endpoints

```text
GET /health
GET /version
POST /admin/invites
POST /auth/signup/password
POST /auth/email/verify
POST /auth/login/password
POST /auth/google/local
POST /adventures/import
GET /adventures/:id/context-preview
POST /adventures/:id/turn
POST /scenarios
POST /scenarios/:id/revisions
POST /scenario-revisions/:id/publish
GET /admin/account-safety-events
```

Admin invite creation is open in local dev if `AIST_API_ADMIN_KEY` is unset. Set `AIST_API_ADMIN_KEY` to require `X-Admin-Key`.
