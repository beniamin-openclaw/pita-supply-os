---
date: 2026-06-10T10:12:22Z
researcher: Claude (Sonnet 4.6)
git_commit: 0d7ff14394890ce72d93a7e8bcf8b5b4b9186db6
branch: claude/exciting-curie-e20933
repository: beniamin-openclaw/pita-supply-os
topic: "Repair the broken droplet backend deploy pipeline — SSH + git-based deploy, Railway migration decision"
tags: [research, deploy, droplet, railway, ssh, github-actions, ci-cd]
status: complete
last_updated: 2026-06-10
last_updated_by: Claude (Sonnet 4.6)
---

# Research: Repair the broken droplet backend deploy pipeline

**Date**: 2026-06-10T10:12:22Z
**Researcher**: Claude (Sonnet 4.6)
**Git Commit**: 0d7ff14
**Branch**: claude/exciting-curie-e20933
**Repository**: beniamin-openclaw/pita-supply-os

## Research Question

How to repair the broken DigitalOcean droplet backend deploy pipeline for Pita Supply OS so that:
- The agent (Claude Code) can SSH to the droplet and trigger deploys reliably
- Deploys are git-based, repeatable, not manual rsync/shallow-clone
- The approach aligns with the scale and agent-operability triggers already lit per `infrastructure.md`

## Summary

Three viable paths exist, ordered by alignment with the triggers already lit in `infrastructure.md`:

1. **Railway migration (recommended for this change)** — Decision Triggers #1 (scale) and #3 (agent-owned deploys) are both lit. The `Procfile` is already correct (`web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`). Migration is ~2–4h work. Agent operates Railway via `railway` CLI with no bespoke SSH maintenance. Auto-deploy on `git push main`.

2. **Fix the droplet with SSH key + deploy script** — keep the droplet, repair git state, add a `deploy.sh` + GitHub Actions job. Fully viable if Railway migration feels risky mid-pilot. Agent SSH to droplet works, but remains bespoke shell maintenance.

3. **Hybrid: fix droplet short-term, Railway as the next change** — safest during an active pilot cycle but defers the scale problem that is already in the 2-3 week window.

The recommendation is **path 1 (Railway)** if the pilot can tolerate a 30-min cutover window, **path 2 (droplet fix)** if it cannot. Path 3 is the fallback if neither window is available now.

---

## Detailed Findings

### Finding 1: The broken state is fully characterized

**Source**: `prod-deploy-pipeline-broken.md` memory + `docs/pita-supply-os-v1/DROPLET_DEPLOY_RUNBOOK.md`

- Running code: `/opt/pitabros/supply-os/app/` = flat rsync copy of `supply-os-v1/app/`, **not** a git checkout.
- Git object store on droplet: **corrupted** — `git ls-tree origin/main` returns empty; `git checkout FETCH_HEAD -- supply-os-v1` fails `pathspec did not match`. Cause: the repo was migrated from `jarvis-codex`; a partial `git fetch` downloaded the remote objects but they couldn't be materialized into a local tree.
- `systemd` unit `jarvis-supply-os.service` WorkingDirectory: `/opt/pitabros/supply-os/`, uvicorn binds `172.18.0.1:8001`.
- Python venv: `/opt/pitabros/supply-os/.venv/` — already populated.
- The D-01 "deploy" added a git remote + `git reset --hard origin/main` that never updated the running `app/` because they are in different directories.

### Finding 2: The repo is already Railway-ready (Procfile is correct)

**Source**: `supply-os-v1/Procfile:1`, `supply-os-v1/app/config.py`

```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

- `$PORT` is injected by Railway automatically. No hardcoded port in config.py.
- `config.py` has zero host/port settings — entirely delegate to the process manager.
- `supply-os-v1/.gitignore` already contains `.railway/` — Railway was considered and partially used before.
- `pyproject.toml` deps (`fastapi`, `uvicorn[standard]`, `pydantic`, `gspread`, `google-auth`) are all standard pip packages — no native binaries that break Railway's Nixpacks builder.

**Railway reads the `Procfile` from the repo root by default.** The `Procfile` is in `supply-os-v1/`, not the repo root — this requires setting `RAILWAY_DEPLOY_ROOT=supply-os-v1` or pointing the Railway service at the `supply-os-v1/` subdirectory.

### Finding 3: No deploy scripts or deploy CI job exist in the repo

**Source**: Explore agent findings, `.github/workflows/ci.yml`

- `.github/workflows/ci.yml` has two jobs: **backend** (ruff + pytest) and **frontend** (build + lint + test). **No deploy job.**
- Zero deploy scripts anywhere in the repo (no `Makefile`, no `deploy.sh`, no `scripts/`).
- Zero systemd unit files checked in (the one on the droplet was set up manually per the runbook).
- CI is test-only; a push to `main` runs tests but triggers no deployment.

This means: **every production deploy since launch has been manual**. The gap is not a broken automation — there was never automation.

### Finding 4: Both Railway decision triggers are lit simultaneously

**Source**: `context/foundation/infrastructure.md`, user context

Per `infrastructure.md`, the backend upgrade to Railway triggers when **any one** of these fires:

| Trigger | Status |
|---------|--------|
| #1 Scale arrives (beyond single pilot) | **LIT** — owner expects company-wide in ~2–3 weeks |
| #2 Ops toil becomes real | Potential — the broken deploy pipeline IS ops toil |
| #3 Agent-owned deploys desired | **LIT** — user explicitly wants "agent SSH, not shallow clone" |

`infrastructure.md` explicitly notes: *"The 'scale arrives' trigger is now near. The Railway upgrade should be treated as near-term and likely, not hypothetical."*

### Finding 5: Railway migration effort is low — not a multi-day project

**Source**: `context/foundation/infrastructure.md` Railway runbook, `supply-os-v1/pyproject.toml`, `frontend/vercel.json`

Steps required (estimated total: 2–4 hours for owner execution, <1h for agent-prepared commands):

1. **Install Railway CLI + auth** — `npm i -g @railway/cli && railway login` (5 min)
2. **Link repo to Railway** — `railway init` or `railway link` from `supply-os-v1/`, set root path (10 min)
3. **Pin builder** — create `supply-os-v1/railway.toml` to avoid Nixpacks→Railpack churn (5 min)
4. **Set secrets** — `railway variables --set` for: `SUPPLY_OS_DATA_BACKEND`, `SUPPLY_OS_CAPTAIN_TOKENS`, `SUPPLY_OS_MANAGER_TOKEN`, `SUPPLY_OS_GOOGLE_SHEET_ID`, `SUPPLY_OS_CORS_ALLOW_ORIGINS`, `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE` (the file-path approach, not inline JSON — avoids `\n` corruption) (20 min)
5. **First deploy + smoke** — `railway up`, hit `/health`, run a back-out captain submit (30 min)
6. **Cut over vercel.json** — change `destination` in `frontend/vercel.json` from `https://supply.46-101-213-61.nip.io/api/:path*` to the Railway URL, push frontend (10 min)
7. **Keep droplet warm** for one pilot cycle, then decommission (0 dev time)

**Google SA JSON footgun**: the `\n`-in-JSON corruption risk via systemd `EnvironmentFile` does NOT apply to Railway (Railway injects env vars directly, not via a shell-parsed file). BUT the recommended approach is still to use `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE` with a Railway volume or to base64-encode the JSON — this avoids any platform-specific edge case and matches the documented safe pattern in `sheets.py`.

### Finding 6: SSH deploy on the droplet — viable but more moving parts

**Source**: `DROPLET_DEPLOY_RUNBOOK.md`, prod-deploy-pipeline-broken.md memory

If staying on the droplet, the repair involves:

**One-time droplet repair (owner runs once):**
```bash
# Backup current working code
cp -a /opt/pitabros/supply-os/app /opt/pitabros/supply-os/app.bak.$(date +%Y%m%d)

# Remove corrupted git state
cd /opt/pitabros && rm -rf supply-os-git

# Fresh clone at a stable path (public repo, no auth needed)
git clone https://github.com/beniamin-openclaw/pita-supply-os.git supply-os-git

# Verify the checkout is correct
ls supply-os-git/supply-os-v1/app/
```

**Deploy script `deploy.sh` (checked into repo):**
```bash
#!/bin/bash
set -e
DROPLET="root@46.101.213.61"
REPO_PATH="/opt/pitabros/supply-os-git"
APP_PATH="/opt/pitabros/supply-os/app"

# Pull latest
ssh $DROPLET "cd $REPO_PATH && git pull --ff-only origin main"

# Backup + sync app/
ssh $DROPLET "cp -a $APP_PATH ${APP_PATH}.bak.$(date +%Y%m%d%H%M%S)"
ssh $DROPLET "rsync -a --delete $REPO_PATH/supply-os-v1/app/ $APP_PATH/"

# Sync seed CSVs if changed
ssh $DROPLET "rsync -a $REPO_PATH/docs/pita-supply-os-v1/seed/ /opt/pitabros/supply-os-data/seed/"

# Install new deps
ssh $DROPLET "/opt/pitabros/supply-os/.venv/bin/pip install -q -e $REPO_PATH/supply-os-v1/"

# Restart + verify
ssh $DROPLET "systemctl restart jarvis-supply-os.service"
sleep 3
ssh $DROPLET "curl -sf http://172.18.0.1:8001/health > /dev/null && echo '✓ health ok' || (echo '✗ health failed'; journalctl -u jarvis-supply-os.service -n 20; exit 1)"
```

**SSH key setup for agent:**
```bash
# On laptop — generate deploy key (no passphrase for CI)
ssh-keygen -t ed25519 -C "supply-os-deploy" -f ~/.ssh/supply_os_deploy -N ""

# Add public key to droplet
ssh root@46.101.213.61 "echo '$(cat ~/.ssh/supply_os_deploy.pub)' >> ~/.ssh/authorized_keys"

# Use key in deploy script
ssh -i ~/.ssh/supply_os_deploy ...
# For GitHub Actions: store private key content as Actions secret DROPLET_SSH_KEY
```

**GitHub Actions deploy job** (add to `.github/workflows/ci.yml`):
```yaml
deploy-backend:
  needs: [backend, frontend]  # only deploy when tests pass
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Set up SSH
      run: |
        mkdir -p ~/.ssh
        echo "${{ secrets.DROPLET_SSH_KEY }}" > ~/.ssh/deploy_key
        chmod 600 ~/.ssh/deploy_key
        ssh-keyscan -H 46.101.213.61 >> ~/.ssh/known_hosts
    - name: Deploy
      run: bash deploy.sh
      env:
        SSH_KEY: ~/.ssh/deploy_key
```

**Agent SSH for on-demand deploys**: the same `deploy.sh` can be invoked directly by the Claude Code agent via `Bash` — `ssh -i ~/.ssh/supply_os_deploy root@46.101.213.61 "..."` — once the key is in place. Agent SSH works as long as the private key is available in the agent's local environment.

### Finding 7: Railway agent-operability is materially better than SSH bespoke scripts

**Source**: `infrastructure.md` scoring, Railway CLI docs

| Operation | Droplet + SSH | Railway CLI |
|-----------|--------------|-------------|
| Deploy | `bash deploy.sh` (custom script, ~30 lines) | `railway up` (one command) |
| Logs | `ssh root@... journalctl -u jarvis-supply-os -n 100` | `railway logs -n 100` |
| Rollback | Manual backup restore + rsync + restart | `railway redeploy` (redeploy prior image) |
| Set env var | `ssh root@... nano /opt/pitabros/supply-os/.env && systemctl restart` | `railway variables --set KEY=value` |
| Scale up | Droplet upgrade (DO dashboard + SSH config change) | `railway scale` or resize in dashboard |
| Check status | `ssh root@... systemctl status jarvis-supply-os` | `railway status` |
| Agent auto-deploy on push | GitHub Actions SSH job | Native Railway GitHub integration (no CI config needed) |

For agent-owned deploys (trigger #3), Railway is the clear winner.

---

## Code References

- `supply-os-v1/Procfile:1` — `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT` (Railway-ready)
- `supply-os-v1/app/config.py` — no hardcoded PORT/HOST; entirely delegated to process manager
- `supply-os-v1/pyproject.toml:1-15` — all standard pip deps; no native binaries
- `supply-os-v1/.gitignore` — `.railway/` already listed (prior Railway use)
- `frontend/vercel.json` — rewrite `destination: https://supply.46-101-213-61.nip.io/api/:path*` (must change on cutover)
- `.github/workflows/ci.yml` — backend + frontend test jobs; **no deploy job**

---

## Architecture Insights

### The structural problem
The deploy gap is not a broken automation — there was **never a deploy automation**. The runbook explicitly says "Manual clone/rsync + systemctl restart — documented gap." D-01 added a git remote + reset that was logically incomplete (it operated on `supply-os-v1/app/` inside a `supply-os-v1/` checkout, which was never materialized on the droplet because the working directory is a flat copy of `app/` contents, not a full checkout). The "deploy" that worked was always manual rsync from the developer's laptop.

### The path-of-least-resistance for Railway
The critical discovery is that `supply-os-v1/Procfile` already has the correct Railway start command. Nothing in `app/main.py` or `config.py` hardcodes the port or host. The `$PORT` injection Railway provides is already the expected interface. The migration is configuration work, not code work.

### The Google SA JSON secret handling
On the droplet, secrets live in `/opt/pitabros/supply-os/.env` (systemd EnvironmentFile). The `\n` footgun affects inline JSON via shell-parsed files. On Railway, env vars are injected directly (not via `EnvironmentFile`), so the footgun is less likely — but the safe pattern (`SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE` pointing to a mounted file, or base64-encoding the JSON) remains the recommendation regardless of platform.

---

## Historical Context (from prior changes)

- `context/changes/deployment/deployment-plan.md` — D-01 plan. Explicitly documented the manual-deploy gap and named Railway as the upgrade path. The plan was marked done despite the gap never being closed.
- `context/foundation/infrastructure.md` — Full platform decision document. Both Railway triggers are now lit; document already says "near-term and likely."
- `prod-deploy-pipeline-broken.md` (memory) — Documents the rsync workaround, corrupted git state, `172.18.0.1:8001` bind address, and the one-time shallow-clone workaround that worked.
- `context/foundation/lessons.md: "Verify what production actually runs"` — Direct lesson from this incident; the research is grounded in it.

---

## Open Questions

1. **Can the pilot tolerate a 30-min cutover window?** Railway migration requires briefly pointing `vercel.json` at the new URL and deploying the frontend. During that window (~5 min) the API is switching hosts. If an order is in-flight, it may fail. Answer from the owner determines Railway vs droplet-fix sequencing.

2. **Where does the Google SA JSON file live on Railway?** Railway has no persistent filesystem by default (ephemeral containers). The safe path is `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE` pointing to a Railway Volume (persistent disk), OR base64-encoding the JSON into an env var and decoding it at startup. The code already supports both paths (`sheets.py:_client()`). Plan must choose one.

3. **Nixpacks builder pinning**: Railway is mid-migration from Nixpacks to Railpack. The plan must include pinning in `railway.toml` to avoid silent build behavior change on a routine redeploy. What version/builder to pin to is a question for the plan phase.

4. **Domain cutover**: `supply.46-101-213-61.nip.io` is embedded in `frontend/vercel.json`. After Railway cutover, this changes to a `*.up.railway.app` URL. The Caddy/nip.io infrastructure can be left idle; no DNS change needed since Vercel proxies the API.

5. **Droplet decommission**: after Railway cutover, the `jarvis-supply-os.service` systemd unit on the droplet should be stopped and disabled. The droplet itself (which also hosts OpenClaw and other services) stays up. Plan should include this cleanup step.
