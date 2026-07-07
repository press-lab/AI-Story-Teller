# Restart Owner Server

Use this after the owner PC restarts and testers need `story.storymodeai.com`
to reach the local backend again.

## Normal Restart

Open PowerShell in the repo root:

```powershell
cd "C:\Users\sethp\Documents\GitHub\AI Story Teller"
```

Start the app-owned local Postgres cluster:

```powershell
npm.cmd run owner:postgres:start
```

Start the owner watchdog in the background:

```powershell
npm.cmd run owner:watch:start
```

That is the normal reboot recovery path. The watchdog starts or repairs:

- the owner API on `http://127.0.0.1:8787`
- the Cloudflare Quick Tunnel to the owner API
- the GitHub Pages API URL variable when Cloudflare gives a new tunnel URL
- the Pages deploy on `backend-local-implementation` when the public API URL changes

## Foreground Mode

If you want to watch the recovery live instead of starting it hidden:

```powershell
npm.cmd run owner:watch
```

Leave that PowerShell window open. Closing it stops the watchdog loop.

For a single repair/check pass:

```powershell
npm.cmd run owner:watch:once
```

## Check Health

Confirm Postgres is running:

```powershell
npm.cmd run owner:postgres:status
```

Confirm the local API is healthy and using Postgres:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

Expected important fields:

```json
{
  "ok": true,
  "database": "postgres"
}
```

Check the current public Cloudflare URL:

```powershell
Get-Content .local-backend\pages-api-url.txt
```

Check the public API through Cloudflare:

```powershell
$url = (Get-Content .local-backend\pages-api-url.txt -Raw).Trim()
Invoke-RestMethod "$url/health"
```

If Cloudflare issued a new URL, the watchdog runs `pages:set-api` and triggers
the GitHub Pages deploy. Wait for the `Deploy to GitHub Pages` workflow to
finish, then reload `https://story.storymodeai.com/`.

Optional GitHub check:

```powershell
gh run list --workflow "Deploy to GitHub Pages" --limit 3
```

## Logs

Watchdog stdout:

```powershell
Get-Content .local-backend\owner-watch.out.log -Tail 80
```

Watchdog errors:

```powershell
Get-Content .local-backend\owner-watch.err.log -Tail 80
```

Owner API logs:

```powershell
Get-Content .local-backend\api-serve.out.log -Tail 80
Get-Content .local-backend\api-serve.err.log -Tail 80
```

Cloudflare logs:

```powershell
Get-Content .local-backend\cloudflared.out.log -Tail 80
Get-Content .local-backend\cloudflared.err.log -Tail 80
```

Cloudflare reset history:

```powershell
Get-Content .local-backend\cloudflare-reset-events.log -Tail 40
```

## First-Time Or Broken-Env Recovery

If Postgres was never initialized on this machine:

```powershell
npm.cmd run owner:postgres:init
npm.cmd run api:postgres:migrate
npm.cmd run owner:watch:start
```

`owner:postgres:init` creates `.local-backend\postgres-data`, stores the
generated local database password in `.local-backend\postgres-password.txt`,
and writes `AIST_DATABASE_URL` into `.env`.

If the API starts but `/health` says `"database": "local-json"`, the backend did
not see `AIST_DATABASE_URL`. Run:

```powershell
npm.cmd run owner:postgres:start
Select-String -Path .env -Pattern "AIST_DATABASE_URL"
npm.cmd run owner:watch:start
```

## Stop

Stop Postgres:

```powershell
npm.cmd run owner:postgres:stop
```

The watchdog and Cloudflare tunnel are background processes started by
`owner:watch:start`. If you need to stop them manually, use Task Manager or read
the PID files:

```powershell
Get-Content .local-backend\owner-watchdog.pid
Get-Content .local-backend\cloudflared.pid
```

Then stop only those PIDs if you are sure they belong to this repo.
