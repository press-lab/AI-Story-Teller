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

Do not open port `8787` directly to the internet. The safer setup is an outbound HTTPS tunnel:

```text
internet -> tunnel provider HTTPS edge -> outbound tunnel process on your machine -> 127.0.0.1:8787
```

With that shape, your router does not need inbound port forwarding for the API. Leave Windows Firewall closed to inbound public traffic.

If the owner has a Cloudflare account but no domain, use a Quick Tunnel for temporary UAT:

```sh
cloudflared tunnel --url http://127.0.0.1:8787
```

Cloudflare prints a random `https://....trycloudflare.com` URL. Use that as `AIST_PUBLIC_API_BASE_URL`:

```sh
npm.cmd run pages:set-api -- https://random-name.trycloudflare.com
```

Quick Tunnel URLs are not stable. If the tunnel restarts and the URL changes, rerun `pages:set-api` with the new URL and wait for GitHub Pages to redeploy.

Cloudflare does not publish a fixed rotation schedule for Quick Tunnel URLs. In practice, treat the generated URL as valid only while that `cloudflared` process stays alive and Cloudflare keeps the free test tunnel available. Expect the URL to change when:

- the owner machine reboots, sleeps long enough to kill the process, or loses network;
- `cloudflared` exits, crashes, or is manually restarted;
- Cloudflare interrupts the free Quick Tunnel service.

Cloudflare documents Quick Tunnels as testing/development only, says they generate a random `trycloudflare.com` subdomain, and says there is no SLA or uptime guarantee. This is why Quick Tunnels are acceptable for UAT but not a stable production hostname.

## Keep Quick Tunnel UAT Alive

The local owner machine must fix the local pieces. A GitHub-hosted Action cannot restart `cloudflared`, restart the API, or wake the owner machine by itself.

Use the local watchdog:

```sh
npm.cmd run owner:watch
```

For a single check/recovery pass:

```sh
npm.cmd run owner:watch:once
```

The watchdog:

1. Starts the local API if `http://127.0.0.1:8787/version` is not healthy.
2. Downloads `cloudflared.exe` into `.local-backend/tools/` if it is missing.
3. Starts or restarts the Cloudflare Quick Tunnel when the public URL is missing or unhealthy.
4. Reads the new `https://....trycloudflare.com` URL from the Cloudflare logs.
5. Updates `.env` with `AIST_PUBLIC_API_BASE_URL` and `AIST_GOOGLE_REDIRECT_URI`.
6. Runs `npm.cmd run pages:set-api -- <new-url> backend-local-implementation` only when the URL changes, which triggers the existing GitHub Pages workflow.

This gives the right failure behavior:

- API died, tunnel URL unchanged: restart local API, no Pages deploy needed.
- Tunnel died and came back with the same URL: no Pages deploy needed.
- Tunnel died and Cloudflare issued a new URL: local watchdog updates GitHub variable and triggers a Pages deploy.

For a truly stable URL, replace Quick Tunnel with a named Cloudflare Tunnel on a real domain. Then GitHub Pages can point at the same hostname forever, and the watchdog no longer needs to redeploy Pages for tunnel URL changes.

## Start The Owner Server

Copy `.env.example` to `.env`, then set the provider, admin, Google OAuth, and policy values.

For owner-hosted UAT, these values matter most:

```text
AIST_API_HOST=127.0.0.1
AIST_API_PORT=8787
AIST_API_DATA_FILE=.local-backend/aist-api-db.json
AIST_DATABASE_URL=postgres://aist_user:a_strong_password@127.0.0.1:5432/aist_local
AIST_API_ALLOWED_ORIGINS=https://press-lab.github.io,http://localhost:5173,http://127.0.0.1:5173
AIST_WEB_APP_URL=https://press-lab.github.io/AI-Story-Teller/
AIST_PUBLIC_API_BASE_URL=https://your-public-api-domain.example
AIST_ADMIN_EMAILS=owner@example.com
AIST_API_ALLOW_LOCAL_GOOGLE_STUB=false
```

`npm.cmd run api:serve` refuses to start unless `AIST_ADMIN_EMAILS` or `AIST_API_ADMIN_KEY` is set. That prevents accidentally exposing the local-dev open admin routes.

`npm.cmd run api:serve` also binds to `127.0.0.1` by default. If you intentionally bind to `0.0.0.0`, you must set:

```text
AIST_ALLOW_PUBLIC_BIND=true
```

Do that only behind a firewall/reverse proxy you understand.

Start the shared backend:

```sh
npm.cmd run api:serve
```

The API still stores data locally by default:

```text
.local-backend/aist-api-db.json
```

For tester UAT, set `AIST_DATABASE_URL` so the API uses local Postgres instead. Back up both the original JSON file and the Postgres database before major schema changes.

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
