# Pre-deploy Review — Pita Bros Supply OS v0

**Date:** 2026-05-22
**Scope:** verify [DROPLET_DEPLOY_RUNBOOK.md](DROPLET_DEPLOY_RUNBOOK.md),
[supply-os-v1/](../../supply-os-v1/) code, [DATA_MODEL.md](DATA_MODEL.md),
[ADR-001](ADR-001-hybrid-hosting.md) are coherent and safe to execute.
**Verdict:** **GO with 2 quick probes** (see Blockers section).

---

## What I checked

| Surface | Reviewed | Status |
|---|---|---|
| Runbook (7 deploy steps) | yes | ✓ coherent |
| Backend code (~530 LOC) | yes | ✓ tested 44/44 |
| Pydantic models vs DATA_MODEL.md | yes | ✓ aligned |
| Caddy config (existing) | yes (via SSH recon) | ✓ understood routing |
| Resource budget (RAM + CPU + disk) | yes | ⚠ tight, see findings |
| Auth model (Bearer tokens) | yes | ✓ ready |
| CORS configuration | yes | ⚠ depends on Vercel URL |
| Rollback path | yes | ✓ three layers (soft / hard / snapshot) |
| Write endpoints (Captain submit / Manager dispatch) | yes | ⚠ NOT IMPLEMENTED — see findings |
| Sheets adapter (production data backend) | yes | ⚠ STUB — see findings |
| Existing production load on droplet | yes (recon) | ✓ no conflict |

---

## What looks good

1. **Backend is well-scoped and tested.** 44/44 pytest green covering
   auth, validation, suggestion math, seed loader cache. No surprises
   waiting after deploy.
2. **Pydantic models match `DATA_MODEL.md` exactly.** Seed CSVs parse
   into them without coercion errors (verified end-to-end last slice).
3. **Auth dependency injection is clean.** `require_captain()` returns
   `location_id` — the API surface enforces "Captain cannot reach
   another location's data" by construction, not by trust.
4. **Resource discipline matches the rest of the droplet.** `MemoryMax`
   + `--workers 1` align with how Pita Bros runs Postgres / Streamlit
   in their docker-compose.
5. **Rollback is genuinely three-tiered.** Soft (disable service +
   remove Caddy block, ~30 s), hard (rm directory, ~1 min), nuclear
   (restore DO snapshot, ~5 min). All recoverable.
6. **Secrets stay with user.** Plan explicitly says I never see the
   actual production `.env` values — user pastes them on droplet in
   Step 3.
7. **No conflict with existing services.** Port 8001 is free; no Caddy
   route collision; no docker-compose changes; no impact on existing
   systemd units. OpenClaw production stays untouched.

---

## Findings — things I want fixed before execute

### 🔴 BLOCKER 1 — `host.docker.internal` not verified

**Issue:** The Caddy block I wrote uses `127.0.0.1:8001`, which won't
work because Caddy runs *inside* the `pitabros-gateway-1` Docker
container. Inside that container, `127.0.0.1` means "the container,"
not "the host."

The fix in the runbook says: use `host.docker.internal:8001` instead —
but only if it resolves inside the container. If `extra_hosts` isn't
set in docker-compose, it won't resolve.

**Verification (run before deploy, takes ~10 seconds):**

```sh
ssh root@46.101.213.61 'docker exec pitabros-gateway-1 getent hosts host.docker.internal && echo OK || echo MISSING'
```

- If returns an IP → Option A works (`host.docker.internal:8001`).
- If returns MISSING → Option B (bind uvicorn to docker bridge IP).

**Pre-deploy fix if MISSING:**
Change uvicorn `--host 127.0.0.1` to `--host 172.17.0.1` (docker0
bridge) in the systemd unit. This makes uvicorn reachable from inside
containers AND keeps it unreachable from the public internet (Caddy is
the only public port).

Either way: this needs to be confirmed in 30 seconds before we proceed.

### 🔴 BLOCKER 2 — Write endpoints don't exist yet

**Issue:** The backend currently has these endpoints:
- `GET /health`
- `GET /api/products`, `/suppliers`, `/locations`
- `GET /api/captain/orderable` (read)
- `POST /api/captain/suggest` (pure math, no write)
- `GET /api/manager/queue` (returns `[]` in v0)

It does NOT have:
- `POST /api/captain/submit` — what the Captain Submit button actually calls
- `POST /api/manager/dispatch` — what the Manager Dashboard Send button calls
- Sheets write paths (`app/sheets.py` is a stub)

**Implication:** **This deploy gets us infrastructure ready, NOT pilot
ready.** Captain frontend can render the screen and compute suggestions
locally, but submitting the order does nothing until we add the write
endpoints + Sheets adapter in the next slice.

**Recommendation:**
- Proceed with this deploy anyway — gives us a live API URL Vercel can
  hit, validates the routing + Caddy + auth all work end-to-end, and
  Magic Patterns can build against a real endpoint.
- Add a clear banner in the frontend during this period: "Pilot mode —
  orders not yet persisting. We're collecting data manually."
- Next slice: write endpoints + Sheets adapter (~1 day of work).

This is a documentation gap, not a runbook bug. Calling it a blocker
because the user should know before going live with Captain.

### 🟡 MODERATE 1 — Resource budget is tight

**Issue:** Droplet shows 768 MB used / 1.9 GB total RAM AND 870 MB swap
already in use. We're adding 80–120 MB more. Headroom is real but
small.

**Mitigation:**
- Bump `MemoryMax=200M` → `MemoryMax=250M` to handle cold-start spikes
  (initial CSV parse uses more RAM than steady state).
- Set up the resource watch from runbook Step 7 BEFORE first Captain
  uses the system. If we see RSS climbing past 200 MB sustained, we
  investigate before it becomes a problem.

**Why not a blocker:** systemd will kill our process if it exceeds the
limit, not the rest of the box. Worst case: Supply OS goes down,
OpenClaw keeps running, alert fires, we patch.

### 🟡 MODERATE 2 — `/health` leaks `env=prod`

**Issue:** Unauthenticated `/health` response includes
`"env": "prod"` and `"data_backend": "seed"`. Minor information
disclosure to anyone who probes the URL.

**Fix (1 line):** Remove `env` and `data_backend` from the public
health response. Just return `{"status": "ok", "timestamp": "..."}`.
Move the diagnostic fields to a `/health/internal` endpoint behind
Manager auth (Phase 1.5).

**Why not a blocker:** Low impact; URLs are obscure (nip.io subdomain).
But trivially fixable, may as well do it now.

### 🟡 MODERATE 3 — Master data endpoints are public

**Issue:** `/api/products`, `/api/suppliers`, `/api/locations` are
unauthenticated. They expose product names, supplier names, location
names — semi-sensitive business data.

**Fix:** Gate behind Captain OR Manager auth (accept either token type).
Add a new `require_any_auth()` dep that accepts either Captain or
Manager Bearer token.

**Why not a blocker:** Pilot phase, URL obscure, no PII or pricing
leaked (prices are NOT in `/api/products`, they're in
`/api/supplier_products` which we don't currently expose — also worth
keeping that way for now).

### 🟢 MINOR 1 — `/api/manager/queue` returns `[]` always

**Issue:** Currently a stub. Frontend will look broken (empty queue
forever) until write endpoints exist.

**Fix:** When the Magic Patterns frontend renders an empty queue, it
should show a friendly empty state ("No orders pending. Captain
submissions will appear here once Phase 1.5 ships."). Already in the
DESIGN_HANDOFF.md edge-cases table.

### 🟢 MINOR 2 — uvicorn `--proxy-headers` config

**Issue:** Runbook says `--forwarded-allow-ips=127.0.0.1`, but if
Caddy reaches us via docker bridge (Option B fallback), Caddy's source
IP from uvicorn's POV will be the docker bridge IP, not 127.0.0.1.

**Fix:** If we go Option B, set `--forwarded-allow-ips=172.17.0.1`
instead. Already noted in runbook Step 4 footnote area; just a reminder.

---

## Pre-deploy probe checklist (~2 minutes total)

Before executing Step 1 of the runbook, run these probes:

```sh
# Probe 1 — host.docker.internal resolution (BLOCKER 1)
ssh root@46.101.213.61 'docker exec pitabros-gateway-1 getent hosts host.docker.internal && echo OPTION_A_OK || echo USE_OPTION_B'

# Probe 2 — port 8001 free
ssh root@46.101.213.61 'ss -tlnp | grep ":8001 " && echo PORT_USED || echo PORT_FREE'

# Probe 3 — current RAM headroom
ssh root@46.101.213.61 'free -m | grep Mem | awk "{print \"available_mb=\"\$7}"'

# Probe 4 — Caddyfile syntax pre-validation (so we don't break existing routes)
ssh root@46.101.213.61 'docker exec pitabros-gateway-1 caddy validate --config /etc/caddy/Caddyfile'

# Probe 5 — confirm DO snapshot exists (user-side)
# → user confirms in DO dashboard: snapshot named "pre-supply-os-deploy-2026-05-22" present
```

Expected:
- Probe 1: `OPTION_A_OK` OR `USE_OPTION_B` (either is fine, just tells us which path)
- Probe 2: `PORT_FREE`
- Probe 3: `available_mb=` ≥ 300
- Probe 4: `Valid configuration`
- Probe 5: user confirms

If any of these fails: stop, fix root cause, re-probe.

---

## Recommended runbook edits before execute

| Edit | File | Change |
|---|---|---|
| Bump memory limit | [DROPLET_DEPLOY_RUNBOOK.md](DROPLET_DEPLOY_RUNBOOK.md) Step 4 | `MemoryMax=200M` → `MemoryMax=250M`; `MemoryHigh=150M` → `MemoryHigh=200M` |
| Tighten /health | `supply-os-v1/app/main.py` | Drop `env` and `data_backend` from public response; move to internal endpoint |
| Master-data gate | `supply-os-v1/app/main.py` | Add `require_any_auth` dep, apply to `/api/products`, `/suppliers`, `/locations` |
| Pre-probe step | [DROPLET_DEPLOY_RUNBOOK.md](DROPLET_DEPLOY_RUNBOOK.md) | Insert "Step 0.5 — pre-deploy probes" before Step 1 |

These edits are tiny (~5–10 min of work). I can apply them in the same
slice as the deploy execution, or as a standalone pre-deploy slice if
user wants explicit review.

---

## What we're NOT fixing in this deploy

Documented in the [ROADMAP.md](ROADMAP.md), accepted gaps:

- Write endpoints (`POST /api/captain/submit`, `POST /api/manager/dispatch`).
- Sheets adapter (production data backend).
- Magic-link or Google sign-in auth (Bearer tokens are v0).
- Uptime monitoring / alerting (manual journalctl for v0).
- CI/CD deploys (manual rsync for v0).
- Frontend code (separate slice via Magic Patterns).
- Phase 2 modules (receiving, WZ, discrepancies).
- Phase 4 finance / KSeF.

These are intentional v0 scope cuts, not review failures.

---

## Final verdict

**GO** after:
1. Pre-deploy probes run (~2 min). I run these, you watch.
2. Three small edits to runbook + main.py applied (~10 min). I do these.
3. User has snapshot in hand (confirmed already).
4. User says "execute."

If probes pass and edits apply cleanly, the actual deploy is ~30
minutes for Steps 1–6. After that we have a working API at
`https://supply.46-101-213-61.nip.io/health` with auth gating in place,
and Magic Patterns can start hitting it from a Vercel dev environment.
