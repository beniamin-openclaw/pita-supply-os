# Railway Deploy Runbook — Supply OS backend

Migrate the FastAPI backend off the DigitalOcean droplet onto **Railway**
(auto-deploy from `main`), keeping Google Sheets as the datastore behind
`_choose_backend()`. Frontend stays on Vercel; only the `/api/*` rewrite target
changes.

> **Roles.** The agent prepares the repo artifacts (done: `railway.toml`, the
> base64 credential support, the `vercel.json` edit, this runbook, the smoke
> script). **You** run every step below — they touch production secrets and the
> live cutover, which stay with you. The agent never sets a Railway variable or
> pushes.

> **Safety.** The smoke checks here are read-only (GET). Do **not** run a real
> captain submit / manager dispatch against production as a test — that places a
> real supplier order.

---

## 0. Prerequisites

- Railway account (premium covers the always-on service) + CLI:
  `npm i -g @railway/cli` then `railway login`.
- The production secret values — they are the same as the droplet's
  `/opt/pitabros/supply-os/.env` (see the env checklist in §3).
- The repo on `main` (Railway deploys from git). This change's branch must be
  merged to `main` before Railway auto-deploys it; for the first manual `railway
  up` you can deploy the branch directly.

## 1. Create + link the service

```sh
cd supply-os-v1
railway init            # create a new project, OR:
railway link            # link to an existing project/service
```

**Set the service Root Directory to `supply-os-v1`** (Railway dashboard →
service → Settings → Root Directory). This is required so Railway finds the
`Procfile`, `pyproject.toml`, and `railway.toml` in this subfolder — the repo
root is a monorepo. `railway.toml` already pins the builder (RAILPACK — now
Railway's default; Nixpacks is legacy) and the `/health` healthcheck; the
`Procfile` owns the start command (`uvicorn app.main:app --host 0.0.0.0 --port
$PORT`). Note: Railway reads `railway.toml` by **absolute path from the repo
root** (`/supply-os-v1/railway.toml`) — it does NOT follow the Root Directory
setting.

## 2. Encode the service-account JSON as base64

Railway env handling differs from systemd's `EnvironmentFile`; a base64 single
line is CLI-safe and avoids the `\n`-in-JSON footgun. From wherever the
service-account JSON file lives (NOT the repo):

```sh
base64 -i sa.json | tr -d '\n'        # macOS / BSD
# base64 -w0 sa.json                  # GNU/Linux equivalent
```

Copy the single-line output — it becomes `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_B64`
below. The backend decodes it at startup via the shared credential resolver (used
by the Sheets backend, and by Drive if it is ever re-enabled).

## 3. Set the environment variables

Set each via `railway variables --set 'KEY=value'` (or the dashboard). Required:

```sh
railway variables \
  --set 'SUPPLY_OS_ENV=prod' \
  --set 'SUPPLY_OS_DATA_BACKEND=sheet' \
  --set 'SUPPLY_OS_GOOGLE_SHEET_ID=<sheet id>' \
  --set 'SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_B64=<base64 from §2>' \
  --set 'SUPPLY_OS_CAPTAIN_TOKENS=WOLA:<token>' \
  --set 'SUPPLY_OS_MANAGER_TOKEN=<token>' \
  --set 'SUPPLY_OS_CORS_ALLOW_ORIGINS=https://pita-supply-os.vercel.app'
```

Optional (analytics / error tracking):

```sh
railway variables \
  --set 'SUPPLY_OS_POSTHOG_API_KEY=<key>' \
  --set 'SUPPLY_OS_POSTHOG_HOST=https://eu.i.posthog.com'
```

**Do NOT set `SUPPLY_OS_SEED_DIR`** — there is no seed dir on Railway; sheet mode
does not need it. **Do NOT set `SUPPLY_OS_GDRIVE_WZ_FOLDER_ID`** — WZ photo upload
is disabled: the Google Drive path is a structural dead end (a service account
has no Drive storage quota → 403), so photos return later via Supabase Storage as
a separate change. Leaving it unset keeps `drive.is_configured()` False, so
receiving still works (the receipt persists, flagged `received_with_missing_wz`)
— just without photos. **Never commit any of these values** — only `.env.example`
lives in the repo.

**Token rotation:** the Captain + Manager tokens were exposed earlier — this
cutover is the moment to rotate them. Generate fresh values
(`python3 -c "import secrets; print(secrets.token_urlsafe(24))"`), set them on
Railway here, and hand the new codes to the Captain/Manager.

**Cost safety (dashboard):** keep **App Sleeping OFF** so the pilot never
cold-starts a 502, and set a **hard spend cap of $10–20** + email alerts at
75/90/100% (Hobby is always-on by default; spend caps are NOT on by default).

Env checklist (sheet mode, photos disabled): `SUPPLY_OS_ENV`,
`SUPPLY_OS_DATA_BACKEND`, `SUPPLY_OS_GOOGLE_SHEET_ID`,
`SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_B64`, `SUPPLY_OS_CAPTAIN_TOKENS`,
`SUPPLY_OS_MANAGER_TOKEN`, `SUPPLY_OS_CORS_ALLOW_ORIGINS`, (optional)
`SUPPLY_OS_POSTHOG_API_KEY`, `SUPPLY_OS_POSTHOG_HOST`.

## 4. First deploy + smoke (Railway URL directly)

```sh
railway up                      # build + deploy from the current dir
railway logs                    # confirm a clean uvicorn boot, no traceback
railway domain                  # note the public *.up.railway.app URL
```

Smoke the Railway URL **before** touching Vercel (read-only — no order placed):

```sh
BASE_URL=https://<app>.up.railway.app \
MANAGER_TOKEN=<token> CAPTAIN_TOKEN=<WOLA token> \
bash supply-os-v1/scripts/smoke_railway.sh
```

Expect: `/health` 200, **`/health/internal` data_backend=sheet** (proves it is
serving the live Sheet, not a silent seed fallback), `/api/products` >0 items,
orderable + manager queue 200.

If the Railway health check flakes (Railway's private network is IPv6-only and
uvicorn can't dual-stack bind from the CLI — `--host 0.0.0.0 --port $PORT` is
fine for the public HTTP the pilot needs, so try uvicorn first), fall back to
**Hypercorn**: change the `Procfile` to
`web: hypercorn app.main:app --bind 0.0.0.0:$PORT` and add `hypercorn` to
`pyproject.toml` deps.

## 5. Enable auto-deploy on `main`

Railway dashboard → service → Settings → connect the GitHub repo, production
branch = `main`. After this, every push to `main` auto-deploys (no CI YAML — the
existing `ci.yml` stays tests-only). This is the one-time dashboard step that
makes git the deployable source of truth.

## 6. Cutover (flip the Vercel rewrite)

The agent prepared the `frontend/vercel.json` edit on the branch, pointing
`/api/*` at the Railway URL. Fill in the exact Railway host (from §4), then:

```sh
# confirm vercel.json destination is the Railway URL, not nip.io
grep -A2 '"/api/:path\*"' frontend/vercel.json
git push                    # merge/push to main → Vercel redeploys the frontend
```

Verify through the **Vercel domain** (traffic now flows Vercel → Railway):

```sh
curl -s https://pita-supply-os.vercel.app/api/health
```

Then, via the app UI (still no real order): a back-out captain submit, the
manager queue loads it, and a GR-01 goods-receipt confirms a delivery (WZ photo
upload stays **disabled** by design — returning via Supabase Storage as a
separate change).

## 7. Rollback rehearsal (do this BEFORE the first real order)

Rollback is at the proxy layer — one commit:

```sh
git revert <vercel.json cutover commit>   # destination back to the droplet
git push                                  # Vercel redeploys → traffic to droplet (~1 min)
```

The droplet service stays running and untouched through cutover, so reverting
restores the previous working backend immediately. (Railway-side: `railway
redeploy` rolls forward to a prior image; `railway logs --build` for build
issues.) Re-apply the cutover commit once verified.

## 8. Decommission (Phase 4 — only after one green pilot cycle)

After a full Wola×Bukat cycle runs cleanly on Railway, on the droplet:

```sh
systemctl stop jarvis-supply-os
systemctl disable jarvis-supply-os
```

Leave `/opt/pitabros/supply-os/` code + venv in place as a cold fallback; the
Caddy block may be left or removed. Then update `context/foundation/roadmap.md`
to record Railway as the backend host with auto-deploy.

---

## Notes / gotchas

- **`$PORT`** is injected by Railway; the `Procfile` already binds it. Do not
  hardcode 8001.
- **Builder pin**: `railway.toml` pins RAILPACK (Railway's current default;
  Nixpacks is legacy) so a redeploy can't silently flip builders and change env
  parsing. `railway.toml` is read by absolute path from the repo root, not the
  Root Directory.
- **WZ photos disabled**: the Google Drive path is a structural dead end (a
  service account has no Drive storage quota → 403). Photos return via Supabase
  Storage as a separate change; for now `SUPPLY_OS_GDRIVE_WZ_FOLDER_ID` stays
  unset and receiving works without photos.
- **App Sleeping OFF + spend cap**: keep App Sleeping off (no pilot cold-starts);
  set a $10–20 hard spend cap + 75/90/100% email alerts (not on by default).
  Watch the long-lived uvicorn process for RAM creep against the cap.
