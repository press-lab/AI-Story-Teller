# Local Backend Development

This is the owner-test local backend path for the `backend-local-implementation` branch. For public UAT, the intended model is one shared owner-hosted local server: testers open GitHub Pages, while accounts and data stay on the owner's machine. See [Owner-Hosted Local Server Deployment](./owner-local-server-deployment.md).

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

For shared tester access, use Postgres instead. See [Local Postgres Backend](./postgres-local-development.md). Set `AIST_DATABASE_URL` and run `npm.cmd run api:postgres:migrate` before starting `api:serve`.

The frontend now opens on an account-required welcome page. Profile is the combined home and adventure library. Browser Local remains an owner/testing runtime and keeps IndexedDB saves, browser provider settings, JSON backup/restore, AI Dungeon import, and GitHub saves independent from backend adventure storage.

For shared tester access, use:

```sh
npm.cmd run api:serve
```

Then expose `http://127.0.0.1:8787` through an HTTPS tunnel/domain and set the GitHub Pages API URL with:

```sh
npm.cmd run pages:set-api -- https://your-public-api-domain.example
```

To use backend mode from the frontend:

1. Start the API with `npm.cmd run api:dev`.
2. Create an invite from Admin Console, then sign up and verify or log in.
3. Use Profile -> Adventure Library to create/open backend adventures or import existing JSON.
4. Use Profile to review your scenarios and private adventures.

For the high-level tester path, start with [New User Guide](./new-user-guide.md).

In backend mode, Play submit/continue/regenerate and Context Preview use the local API. GitHub saves and cloud sync remain Browser Local only.

## Backend Provider Config

Copy `.env.example` to `.env` and set:

```text
AIST_PROVIDER_API_KEY=...
AIST_PROVIDER_BASE_URL=...
AIST_PROVIDER_MODEL=...
```

Backend turns will fail clearly until `AIST_PROVIDER_API_KEY` is set. Browser-local generation still uses the existing localStorage provider presets.

Provider secrets live only in `.env` or environment variables. Admin-editable platform settings live in the local backend database and can override non-secret platform-wide defaults such as provider name, base URL, model, sampling values, background cadence, and scenario publishing. The provider API key is never stored in the platform settings record.

Admin routes are available locally when both `AIST_API_ADMIN_KEY` and `AIST_ADMIN_EMAILS` are empty. For a stricter local run, set `AIST_API_ADMIN_KEY` and send `X-Admin-Key`, or set `AIST_ADMIN_EMAILS` so matching signed-in accounts receive the admin role.

`npm.cmd run api:serve` is stricter than `api:dev`: it refuses to start without `AIST_ADMIN_EMAILS` or `AIST_API_ADMIN_KEY`, disables the local Google stub, and binds to `127.0.0.1` by default so it can be exposed through an HTTPS tunnel without opening a raw inbound port.

The frontend Admin Console appears only when the signed-in backend session returns `user.role === "admin"`. There is no frontend control to promote a user to admin. Mark admin accounts through backend configuration (`AIST_ADMIN_EMAILS`) or backend data only.

## Google OAuth

The local backend supports real Google OAuth/OIDC without NextAuth. This app is a static Vite frontend plus a custom Node API, so introducing NextAuth would require migrating the app to Next.js.

Create a Google OAuth client and set:

```text
AIST_GOOGLE_CLIENT_ID=...
AIST_GOOGLE_CLIENT_SECRET=...
AIST_GOOGLE_REDIRECT_URI=http://127.0.0.1:8787/auth/google/callback
AIST_WEB_APP_URL=http://localhost:5173/
```

The Google redirect URI configured in Google Cloud must exactly match `AIST_GOOGLE_REDIRECT_URI`. For GitHub Pages UAT, set `AIST_WEB_APP_URL` to the Pages URL and add that origin to `AIST_API_ALLOWED_ORIGINS`.

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
POST /auth/google/start
GET /auth/google/callback
POST /auth/google/local
GET /profile/me
GET /explore/scenarios
POST /adventures/import
GET /adventures/:id/context-preview
POST /adventures/:id/turn
POST /scenarios
POST /scenarios/:id/revisions
POST /scenario-revisions/:id/publish
POST /scenario-revisions/:id/fork
GET /admin/account-safety-events
GET /admin/console
PATCH /admin/users/:id/status
POST /admin/users/:id/restrictions
PATCH /admin/account-safety-events/:id
GET /admin/platform-settings
PUT /admin/platform-settings
```

Admin invite creation is open in local dev only when both `AIST_API_ADMIN_KEY` and `AIST_ADMIN_EMAILS` are unset. Set either value to require backend admin authorization.

## Admin Console

The Admin tab is available only in backend mode for backend admin sessions.

It provides:

- platform totals for users, adventures, scenarios, safety events, policy decisions, usage logs, and context builds
- user lookup with account status and current restriction
- manual account status changes (`pending_verification`, `active`, `disabled`)
- manual account restrictions (`none`, `watched`, `restricted`, `generation_hold`, `banned`)
- account safety event review/dismiss/reopen actions
- invite, adventure, scenario, policy decision, usage, context-build, and admin-audit summaries

It intentionally does not expose raw invite tokens, provider API keys, OAuth secrets, full context payloads, or a role-promotion button.

## Invite Prep Checklist

Before generating tester invite codes:

- Set `AIST_ADMIN_EMAILS` to the backend admin account email.
- Keep `AIST_API_HOST=127.0.0.1` unless you intentionally need LAN binding; do not port-forward raw `8787` to the internet.
- Set provider environment values, especially `AIST_PROVIDER_API_KEY`, `AIST_PROVIDER_BASE_URL`, and `AIST_PROVIDER_MODEL`.
- Set Google OAuth values and make sure the Google Cloud redirect URI matches `AIST_GOOGLE_REDIRECT_URI`.
- Add the GitHub Pages origin to `AIST_API_ALLOWED_ORIGINS`.
- Choose `AIST_POLICY_MODE=reviewOnly` for friendly UAT or `AIST_POLICY_MODE=enforce` for local hard-block testing.
- Confirm GitHub Pages is pointed at `backend-local-implementation`.
- Confirm testers can reach the owner-hosted backend URL. `127.0.0.1` means each tester's own machine, so GitHub Pages UAT must point at the owner's HTTPS tunnel/domain, not raw localhost.
- Smoke test signup, login, import, Profile -> Publish Scenario, Explore -> Start Adventure, autosave, and Admin Console review before sending invites.

## Profile Library

Profile is the backend account library.

It separates:

- Scenarios: reusable setup packages that can be published to Explore.
- Adventures: private playthroughs with actions to open, edit, or publish reusable setup as a scenario.

Publishing from an adventure creates a scenario draft, creates an immutable revision, runs the share gate, publishes the revision, and refreshes Profile and Explore. The published payload includes reusable setup surfaces such as opening scene, components, story cards, brains, trigger rules, and thumbnail. It excludes transcript messages and private runtime state.

## Explore Scenario Starts

Explore contains built-in premade scenarios and backend-published community scenarios.

Starting a backend-published scenario calls `POST /scenario-revisions/:id/fork` and creates a fresh adventure owned by the current user. The fork includes the published setup content, opening scene, story cards, components, and setup metadata. It does not copy the creator's private transcript.

The current implementation has no user-variable substitution. Explore warns the tester before starting that they should edit the new adventure if they do not want to use the premade player character.
