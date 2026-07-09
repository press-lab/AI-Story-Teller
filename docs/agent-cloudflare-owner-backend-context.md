# Agent Context: Owner Backend, Cloudflare Tunnel, And Pages API URL

Read this first when working on owner-hosted backend, Cloudflare Quick Tunnel,
owner PC restart recovery, GitHub Pages API URL, `NetworkError when attempting
to fetch resource`, Cloudflare 502, Admin Console load failures, missing
backend API key errors, or backend adventure/scenario actions that appear to do
nothing.

## Why This Exists

The app still has browser-local paths, but public UAT is currently shaped around
a shared owner-hosted backend. Testers open the static GitHub Pages frontend at
`https://story.storymodeai.com/`; the frontend calls a local API running on the
owner machine through a Cloudflare Quick Tunnel.

Several failures look similar from the UI:

- `NetworkError when attempting to fetch resource.`
- Admin Console shows `Admin data could not load. Load failed`.
- Cloudflare returns a 502 page.
- New Adventure AI generation says `Missing API key`.
- Continue adventure, delete, upload local save, or scenario actions silently
  fail after a confirm dialog.

Do not assume these all have one cause. First identify which link in the chain
is down or misconfigured.

## Current UAT Architecture

- `story.storymodeai.com` serves the static Vite frontend from GitHub Pages.
- The owner API listens on `http://127.0.0.1:8787` on the owner's machine.
- Owner UAT data uses local Postgres on `127.0.0.1:55432` when
  `AIST_DATABASE_URL` is set.
- `cloudflared` exposes the local API through a temporary
  `https://*.trycloudflare.com` Quick Tunnel URL.
- The frontend build embeds `AIST_PUBLIC_API_BASE_URL` from the GitHub repo
  variable, set by `npm.cmd run pages:set-api`.
- Quick Tunnel URLs are temporary. Never treat a `trycloudflare.com` URL as
  permanent or hardcode it as stable documentation.

Use these sources for the current public API URL:

```powershell
Get-Content .local-backend\pages-api-url.txt
Select-String -Path .env -Pattern "AIST_PUBLIC_API_BASE_URL"
gh variable get AIST_PUBLIC_API_BASE_URL
```

## Start And Keep Alive

Normal owner-machine recovery:

```powershell
npm.cmd run owner:postgres:start
npm.cmd run owner:watch:start
```

For a full Windows restart, the short runbook is
[`docs/restart-owner-server.md`](./restart-owner-server.md). The key context is:

- Start or repair the app-owned Postgres cluster on `127.0.0.1:55432`.
- Start the owner watchdog. The watchdog owns the local API process on
  `127.0.0.1:8787`, the Cloudflare Quick Tunnel, the GitHub Pages API URL, and
  the Pages redeploy when Quick Tunnel gives a new public URL.
- Do not start a Vite dev server for tester recovery. Testers use
  `https://story.storymodeai.com/`; only the backend chain must come back on
  the owner machine.

The watchdog is the durable entrypoint. It should keep these pieces healthy:

- local Postgres
- local API on `127.0.0.1:8787`
- Cloudflare Quick Tunnel
- `.env` and GitHub variable values for the public API URL
- GitHub Pages redeploy when Cloudflare issues a new public URL

Use a single pass when you need an immediate repair/reload:

```powershell
npm.cmd run owner:watch:once
```

Gotcha: `owner:watch:once` can overwrite `.local-backend\owner-watchdog.pid`
with the one-shot process PID while the persistent watchdog is still running.
After a one-shot pass, confirm the persistent watchdog is still alive and repair
or restore the PID file if needed.

## Fast Triage Commands

Check logs:

```powershell
Get-Content .local-backend\owner-watch.out.log -Tail 80
Get-Content .local-backend\owner-watch.err.log -Tail 80
Get-Content .local-backend\api-serve.out.log -Tail 80
Get-Content .local-backend\api-serve.err.log -Tail 80
Get-Content .local-backend\cloudflared.err.log -Tail 120
Get-Content .local-backend\cloudflare-reset-events.log -Tail 40
```

Check local and public API health:

```powershell
curl.exe --noproxy "*" -sS http://127.0.0.1:8787/version
$url = (Get-Content .local-backend\pages-api-url.txt -Raw).Trim()
curl.exe --noproxy "*" -sS "$url/version"
```

If GitHub CLI is inheriting a dead proxy such as `127.0.0.1:9`, clear proxy
environment variables before running the command:

```powershell
$env:HTTP_PROXY = ""
$env:HTTPS_PROXY = ""
$env:ALL_PROXY = ""
$env:NO_PROXY = "*"
gh run list --workflow "Deploy to GitHub Pages" --limit 5 --json databaseId,status,conclusion,headSha,url,createdAt
```

## What Each Failure Usually Means

`NetworkError when attempting to fetch resource.`

- The browser fetch failed before the app got a useful backend response.
- Check the runtime API base URL, public `/version`, local `/version`, and
  browser `localStorage` for stale `*.trycloudflare.com` custom API URLs.
- CORS can matter, but only debug CORS after the public URL and local API are
  actually healthy.

Cloudflare 502 page:

- Cloudflare's edge and tunnel URL are reachable, but the local origin refused
  or failed the request.
- Check whether `127.0.0.1:8787/version` works on the owner machine.
- Check watchdog and API logs. A live `cloudflared` process is not enough if the
  API process died or did not bind.

Admin Console shows `Admin data could not load. Load failed`.

- Usually the `/admin/console` fetch failed.
- First prove `/version` works locally and through the tunnel.
- Then check auth/admin session state, `AIST_ADMIN_EMAILS`, and admin endpoint
  errors.
- Recent screenshot context: mobile Safari showed this on the Admin tab with
  frontend build label `5e060f5`.

`Missing API key` on New Adventure generation:

- In backend mode, user-initiated scenario/adventure generation should use the
  server platform provider key, not the browser-local preset.
- Check `POST /ai/adventure-generation` for setup generation and
  `POST /adventures/:id/turn` for continue/regenerate.
- Make sure frontend backend provider override is not passing an empty personal
  provider preset when platform mode should be used.

Delete -> popup -> confirm -> nothing happens:

- This can be a local backup/server conflict or a failed backend delete request.
- Check `src/runtime/adventureStore.ts` conflict handling and backend delete
  endpoints before changing UI state optimistically.

## Files That Usually Matter

- `scripts/owner-tunnel-watchdog.ps1`
- `scripts/start-owner-watchdog.ps1`
- `scripts/set-pages-api-url.mjs`
- `src/runtime/runtimeConfig.ts`
- `src/runtime/runtimeConfig.test.ts`
- `src/runtime/adventureStore.ts`
- `src/runtime/backendApi.ts`
- `src/App.tsx`
- `src/pages/AdventuresPage.tsx`
- `apps/api/server.ts`
- `apps/api/adventureStore.ts`
- `apps/api/platformSettings.ts`
- `docs/restart-owner-server.md`
- `docs/owner-local-server-deployment.md`
- `docs/backend-local-development.md`

## Incident Fixes To Preserve

- `17eeddf618e4dc6b39d732ca64f6bcfe1d653852`: fixed delete-confirm local
  backup conflict behavior.
- `349929d4d9ab3026069462fdd620b5e72530ccca`: initial owner tunnel watchdog
  crash/autorecovery hardening.
- `4e80043f62995a751a29d17b4c02cc093db6a2c7`: migrated browser startup away
  from stale stored `*.trycloudflare.com` API URLs when the deployed backend
  default changes.
- `28cfc272b7db9d21390035455c834e73ff085e52`: fixed watchdog behavior for
  Cloudflare 502 caused by a live tunnel with a dead local API origin.
- `feb26928e336c35db6971cc07b8202e51cb0c6c6`: routed New Adventure AI setup
  generation through the backend platform provider key and avoided empty
  personal-provider overrides for backend turns.

## When Finishing Related Work

- Run the validation from `AGENTS.md` when feasible:
  `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run smoke:prod`.
- Verify local and public `/version` if the work changes backend, watchdog,
  Cloudflare, or runtime URL selection.
- If Pages should receive a new URL or frontend bundle, check the
  `Deploy to GitHub Pages` workflow and the deployed build label.
- Stage only scoped files, commit, push the current branch, and report the full
  commit hash.
