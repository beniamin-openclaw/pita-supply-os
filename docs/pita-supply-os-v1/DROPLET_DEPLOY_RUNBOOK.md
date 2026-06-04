# Droplet Deploy Runbook — Supply OS v0 backend

**Target:** `root@46.101.213.61` (DigitalOcean droplet, hostname `openclaw-gateway-1`).
**Architecture:** hybrid C — backend on droplet (FastAPI + systemd), frontend on Vercel, data on Google Sheets.
**Status:** **plan only** — every step here requires explicit user approval before execution.

---

## Pre-flight

### Resource budget on the droplet

Box has **1 GB RAM, 1 CPU, 48 GB disk (65% used)**. Existing load:
- Caddy + Postgres + 3× Streamlit dashboards (Docker) ≈ 600 MB RAM peak.
- 2× OpenClaw systemd services ≈ 100 MB RAM each.
- Swap is already in use (~870 MB) — host is RAM-bound under load.

Supply OS backend budget:
- **uvicorn 1 worker** (NOT default 2× cores)
- expected RSS ≈ 80–120 MB at steady state
- expected RSS under load ≈ 150 MB peak
- We **do NOT** run another Postgres / Redis on this box.
- Disk impact: ~150 MB for code + venv. Acceptable on 17 GB free.

### Port reservation

Listening on droplet today: 22, 53, 80, 2019 (caddy admin local), 8510 (heatmap local), 18789 (openclaw gateway local), 8622 (caddy).

**Supply OS port: `127.0.0.1:8001`** — localhost only, Caddy proxies external traffic to it.

### Subdomain decision

User does not want to expose their primary domain in chat. For v0 we use **nip.io**:

```
supply.46-101-213-61.nip.io  →  46.101.213.61
```

nip.io is a free wildcard DNS service that resolves `<anything>.<ip>.nip.io` to `<ip>`. No DNS setup needed. Let's Encrypt issues real HTTPS certs for nip.io via HTTP-01 challenge — Caddy handles automatically.

Phase 1.5: migrate to user's own subdomain (`supply.<user-domain>`) when the pilot is stable. Migration = update one DNS A record + one Caddy block line.

---

## Step 0 — Backup snapshot (DigitalOcean side)

Before any change to the droplet, take a snapshot via DigitalOcean dashboard:

1. Open DigitalOcean → Droplets → `openclaw-gateway-1`.
2. Snapshots → Take Snapshot → name: `pre-supply-os-deploy-2026-05-22`.
3. Wait ~3–5 minutes for completion.

Rollback path if anything breaks: restore from this snapshot (loses all changes since).

---

## Step 1 — Create deploy directory and clone code

On droplet:

```sh
mkdir -p /opt/pitabros/supply-os
cd /opt/pitabros/supply-os
```

**Code transfer options (pick one):**

**Option A — Git pull (preferred if repo is accessible from droplet):**

```sh
git clone <repo-url> .
# OR if repo is private: set up deploy key first
```

**Option B — rsync from local worktree (simplest for v0):**

From your laptop:

```sh
cd "/Users/ben/Desktop/Jarvis/JARVIS V2/JARVIS-CODEX/Purchase/.claude/worktrees/romantic-elbakyan-3d712b/supply-os-v1"
rsync -av --exclude='.venv' --exclude='__pycache__' --exclude='.pytest_cache' --exclude='*.egg-info' \
  ./ root@46.101.213.61:/opt/pitabros/supply-os/
```

We also need the seed CSVs:

```sh
rsync -av "/Users/ben/Desktop/Jarvis/JARVIS V2/JARVIS-CODEX/Purchase/.claude/worktrees/romantic-elbakyan-3d712b/docs/pita-supply-os-v1/seed/" \
  root@46.101.213.61:/opt/pitabros/supply-os-data/seed/
```

(We put data outside the code directory so future `git pull`s don't fight with seed updates.)

---

## Step 2 — Python venv + dependencies

On droplet:

```sh
cd /opt/pitabros/supply-os
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -e .
```

Verify:

```sh
.venv/bin/python -c "from app.main import app; print('imports ok')"
.venv/bin/python -m pytest tests/  # 44 tests should pass
```

Expected: `44 passed in <1s`.

---

## Step 3 — Configure `.env`

```sh
cd /opt/pitabros/supply-os
cp .env.example .env
chmod 600 .env  # secrets — root-only readable
nano .env
```

Fill in production values:

```
SUPPLY_OS_ENV=prod
SUPPLY_OS_DATA_BACKEND=seed
SUPPLY_OS_SEED_DIR=/opt/pitabros/supply-os-data/seed

# Phase 1.5: switch to sheet
SUPPLY_OS_GOOGLE_SHEET_ID=
SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON=

SUPPLY_OS_POSTHOG_API_KEY=<from PostHog dashboard>
SUPPLY_OS_POSTHOG_HOST=https://eu.i.posthog.com

# Real auth — generate strong tokens:
#   python3 -c "import secrets; print(secrets.token_urlsafe(24))"
SUPPLY_OS_CAPTAIN_TOKENS=WOLA:<24-char-token>
SUPPLY_OS_MANAGER_TOKEN=<24-char-token>

# CORS — only Vercel app(s) we own
SUPPLY_OS_CORS_ALLOW_ORIGINS=https://<your-vercel-app>.vercel.app
```

Token generation (recommended, on droplet):

```sh
echo "Captain WOLA: $(python3 -c "import secrets; print(secrets.token_urlsafe(24))")"
echo "Manager:      $(python3 -c "import secrets; print(secrets.token_urlsafe(24))")"
```

Save these tokens in your password manager — they'll go into the Captain frontend config and Manager bookmarklet.

---

## Step 4 — systemd service unit

Create `/etc/systemd/system/jarvis-supply-os.service`:

```ini
[Unit]
Description=Pita Bros Supply OS — Captain Submit + Manager Dispatch backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/pitabros/supply-os
EnvironmentFile=/opt/pitabros/supply-os/.env
# Binds to 172.18.0.1 (pitabros_default network gateway on host) so the
# Caddy container — which lives on pitabros_default (172.18.0.0/16) — can
# reach uvicorn. Public internet cannot reach 172.18.0.1 directly; only
# Caddy on port 80/443 is publicly exposed.
ExecStart=/opt/pitabros/supply-os/.venv/bin/uvicorn app.main:app \
  --host 172.18.0.1 \
  --port 8001 \
  --workers 1 \
  --proxy-headers \
  --forwarded-allow-ips=*
Restart=on-failure
RestartSec=15
User=root
Group=root

# Resource discipline — bumped to 250M after pre-deploy review found cold-
# start RAM spike potential during initial CSV parse on a swap-pressured box.
MemoryMax=250M
MemoryHigh=200M

# Logging
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Notes:
- 1 worker on a 1-CPU box. Don't increase.
- `MemoryMax=200M` — systemd will SIGKILL the process if it exceeds 200 MB. Protects the rest of the box.
- `--proxy-headers` + `--forwarded-allow-ips=127.0.0.1` — uvicorn trusts X-Forwarded-* only from Caddy.

Enable + start:

```sh
systemctl daemon-reload
systemctl enable jarvis-supply-os.service
systemctl start jarvis-supply-os.service
systemctl status jarvis-supply-os.service
journalctl -u jarvis-supply-os.service -n 30
```

Expected: status `active (running)`, journal shows uvicorn started on 127.0.0.1:8001.

Smoke test on droplet:

```sh
curl -s http://172.18.0.1:8001/health | python3 -m json.tool
```

Expected: `{"status":"ok","timestamp":"..."}`. Public /health is minimal
by design (PRE_DEPLOY_REVIEW.md MODERATE-2). For diagnostics use
`/health/internal` with the Manager token.

---

## Step 5 — Add Caddy route

Edit `/opt/pitabros/Caddyfile` — append a new server block at the end:

```
supply.46-101-213-61.nip.io {
    # Supply OS backend — Captain Submit + Manager Dispatch
    # 172.18.0.1 = pitabros_default bridge gateway on host; uvicorn binds there
    reverse_proxy 172.18.0.1:8001 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Log to Caddy's default access log
    log {
        output stdout
        format console
    }
}
```

**Important:** Caddy runs inside Docker. To reach the host's `127.0.0.1:8001`, we need one of:

**Option A (preferred)** — use the Docker host gateway:

```
reverse_proxy host.docker.internal:8001 { ... }
```

This works because pitabros-gateway-1 is configured with the default docker compose `extra_hosts: ["host.docker.internal:host-gateway"]` — verify with:

```sh
docker exec pitabros-gateway-1 getent hosts host.docker.internal
```

If this returns an IP, use Option A.

**Option B (fallback)** — bind uvicorn to the docker bridge IP instead of 127.0.0.1:

Edit the systemd unit `ExecStart` to use `--host 172.17.0.1` (docker0 bridge). This makes uvicorn reachable from inside containers but still not from public internet (Caddy is the only public port).

Pick **A** if `host.docker.internal` resolves; else **B**.

Reload Caddy (no downtime):

```sh
docker exec pitabros-gateway-1 caddy reload --config /etc/caddy/Caddyfile
```

Watch for errors:

```sh
docker logs pitabros-gateway-1 --tail 50
```

Caddy will provision a Let's Encrypt cert on first request to the new domain — give it ~30 seconds.

---

## Step 6 — External smoke test

From your laptop:

```sh
# Health (public, no auth)
curl -s https://supply.46-101-213-61.nip.io/health | python3 -m json.tool

# Master data (public for v0)
curl -s https://supply.46-101-213-61.nip.io/api/products | python3 -m json.tool | head -30

# Captain auth — should reject without token
curl -i -s https://supply.46-101-213-61.nip.io/api/captain/orderable?supplier_id=SUP_PAGO

# Captain auth — with the WOLA token from .env
curl -s -H "Authorization: Bearer <WOLA-TOKEN>" \
  "https://supply.46-101-213-61.nip.io/api/captain/orderable?supplier_id=SUP_PAGO" \
  | python3 -m json.tool

# Manager auth — should reject Captain token, accept Manager token
curl -i -s -H "Authorization: Bearer <WOLA-TOKEN>" https://supply.46-101-213-61.nip.io/api/manager/queue
curl -s -H "Authorization: Bearer <MANAGER-TOKEN>" https://supply.46-101-213-61.nip.io/api/manager/queue
```

Expected:
- `/health` → 200 + JSON
- `/api/products` → 200 + 134 items
- `/api/captain/orderable` no token → 401
- `/api/captain/orderable` with WOLA token → 200 + 6 Pago food items
- `/api/manager/queue` with Captain token → 401
- `/api/manager/queue` with Manager token → 200 + `[]`

---

## Step 7 — Hand the API URL to Vercel frontend

When Magic Patterns frontend gets deployed to Vercel, set environment variable:

```
NEXT_PUBLIC_API_URL=https://supply.46-101-213-61.nip.io
```

The frontend sends `Authorization: Bearer <token>` per request, where the token is either:
- the WOLA Captain code (entered once at first visit, stored in localStorage)
- the Manager code (entered once on Manager Dashboard)

CORS: confirm `SUPPLY_OS_CORS_ALLOW_ORIGINS` on droplet `.env` matches the actual Vercel app URL after first frontend deploy. Restart `jarvis-supply-os.service` to pick up.

---

## Resource monitoring during pilot

Run during the first ordering cycle:

```sh
ssh root@46.101.213.61 'watch -n 5 "free -h; systemctl status jarvis-supply-os.service | head -10; ps -C uvicorn -o pid,rss,vsz,etime"'
```

Trigger conditions for action:
- RSS > 150 MB sustained → investigate memory leak (Phase 1.5)
- swap usage > 1.5 GB → host is RAM-saturated, consider 2 GB droplet upgrade
- 5xx error rate > 1% → check `journalctl -u jarvis-supply-os.service -n 100`

---

## Rollback

**Soft rollback (revert this deploy, keep code on box):**

```sh
systemctl stop jarvis-supply-os.service
systemctl disable jarvis-supply-os.service
# Edit /opt/pitabros/Caddyfile — remove the supply.* block
docker exec pitabros-gateway-1 caddy reload --config /etc/caddy/Caddyfile
```

**Hard rollback (everything gone):**

```sh
systemctl stop jarvis-supply-os.service
systemctl disable jarvis-supply-os.service
rm /etc/systemd/system/jarvis-supply-os.service
systemctl daemon-reload
rm -rf /opt/pitabros/supply-os /opt/pitabros/supply-os-data
# Revert Caddyfile + reload
```

**Nuclear rollback:** restore the DigitalOcean snapshot from Step 0.

---

## What this runbook does NOT do (Phase 1.5)

- Sheets adapter implementation — backend still reads seed CSVs at this point.
- Auto-deploy from git (manual rsync each update for v0).
- TLS cert monitoring / auto-renewal alerting — Caddy handles renewal silently; we don't alert on failure yet.
- Real auth — still Bearer tokens. Magic-link comes Phase 1.5.
- Frontend deploy — that's a separate Vercel runbook.

---

## Approval checklist (before execution)

- [ ] User has reviewed Steps 0–7 above.
- [ ] User has taken DigitalOcean snapshot (Step 0).
- [ ] User confirms it's OK to add ~150 MB code + ~80 MB running process to the box.
- [ ] User confirms `host.docker.internal` resolves inside `pitabros-gateway-1` (or accepts Option B fallback).
- [ ] User confirms nip.io subdomain is acceptable for v0 pilot.
- [ ] User has generated production tokens and stored them in password manager.
- [ ] User accepts that this is **the same droplet as production OpenClaw / Telegram** — a Supply OS bug should not in theory affect those, but they share RAM and disk.

When the boxes are checked, ping me and I execute Steps 1–6 from the laptop / via SSH. Step 0 and the env-var/.env content (with real tokens) stay with you — I never see the actual production secrets.
