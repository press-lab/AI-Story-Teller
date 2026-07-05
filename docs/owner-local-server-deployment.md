# Owner-Hosted Local Server Deployment

This is the intended UAT shape while the backend is hosted locally:

```text
tester browser -> GitHub Pages frontend -> HTTPS tunnel/domain -> owner machine -> local API -> .local-backend/aist-api-db.json
```

Non-technical users should not run the backend. They only open the GitHub Pages app, sign in, and play. The owner machine is the server. Accounts, profiles, invites, adventures, scenarios, policy decisions, safety events, usage logs, and admin settings live in the owner's local backend database.

## Requirements

- Keep the owner machine awake and online while testers use the app.
- Run the API from this repo.
- Expose the API through an HTTPS public URL.
- Point the GitHub Pages build at that HTTPS URL.

GitHub Pages is served over HTTPS. Browser security will block calls from `https://press-lab.github.io` to a plain `http://` public backend. Use an HTTPS tunnel or an HTTPS reverse proxy in front of the local API.

Good local-server exposure options:

- Cloudflare Tunnel with a stable hostname.
- ngrok with a reserved HTTPS domain.
- A router port forward plus a real domain, TLS certificate, and reverse proxy.

Avoid a raw public `http://` IP address for Pages UAT. It will fail in normal browsers because of mixed-content blocking.

## Start The Owner Server

Copy `.env.example` to `.env`, then set the provider, admin, Google OAuth, and policy values.

For owner-hosted UAT, these values matter most:

```text
AIST_API_HOST=0.0.0.0
AIST_API_PORT=8787
AIST_API_DATA_FILE=.local-backend/aist-api-db.json
AIST_API_ALLOWED_ORIGINS=https://press-lab.github.io,http://localhost:5173,http://127.0.0.1:5173
AIST_WEB_APP_URL=https://press-lab.github.io/AI-Story-Teller/
AIST_PUBLIC_API_BASE_URL=https://your-public-api-domain.example
```

Start the shared backend:

```sh
npm.cmd run api:serve
```

The API still stores data locally by default:

```text
.local-backend/aist-api-db.json
```

Back this file up before major schema or database changes.

## Expose It Publicly

Point your HTTPS tunnel/domain at:

```text
http://127.0.0.1:8787
```

Then verify from a device that is not the server:

```text
https://your-public-api-domain.example/health
```

The response should include `ok: true`.

## Point GitHub Pages At The Owner Server

After the public HTTPS API URL exists, run:

```sh
npm.cmd run pages:set-api -- https://your-public-api-domain.example
```

That command:

1. Sets the GitHub repo variable `AIST_PUBLIC_API_BASE_URL`.
2. Triggers the `Deploy to GitHub Pages` workflow on `backend-local-implementation`.
3. Causes the built frontend to default to the owner server instead of `127.0.0.1`.

Existing users who previously loaded the old `127.0.0.1` default will be migrated to the configured owner-server URL on app startup. A custom URL a user typed manually is not overwritten.

## Google OAuth

For Google login, the Google Cloud redirect URI must use the public HTTPS backend URL:

```text
https://your-public-api-domain.example/auth/google/callback
```

Set the backend environment to the same value:

```text
AIST_GOOGLE_REDIRECT_URI=https://your-public-api-domain.example/auth/google/callback
AIST_WEB_APP_URL=https://press-lab.github.io/AI-Story-Teller/
```

Email/password login can work before Google OAuth is fully configured.

## Tester Flow

The tester flow is:

1. Open `https://press-lab.github.io/AI-Story-Teller/`.
2. Enter invite code.
3. Create account with email/password or Google.
4. Use Profile, Explore, Library, and Play.

The tester does not install Node, run Postgres, run the API, or configure provider keys.

## Migration Safety

When moving from the JSON database to Postgres, preserve users and data by migrating from:

```text
.local-backend/aist-api-db.json
```

Do not delete that file. The migration should preserve stable IDs for users, profiles, identities, adventures, scenarios, policy decisions, restrictions, usage logs, and admin actions. Active sessions can be dropped so users sign in again after migration.
