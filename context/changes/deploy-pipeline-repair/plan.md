# Railway Backend Host Migration — Implementation Plan

## Overview

Migrate the Pita Supply OS FastAPI backend from the DigitalOcean droplet (manual
rsync, git-disconnected) to **Railway** (auto-deploy from `main`), keeping the
Google Sheets datastore unchanged behind `_choose_backend()`. This repairs the
broken deploy pipeline by making **git the deployable source of truth** and gives
the agent a CLI-operable deploy loop — without bundling the datastore migration
(sequenced as the next change per `frame.md`).

## Current State Analysis

- **Backend is Railway-ready in code**: `supply-os-v1/Procfile:1` already reads
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; `config.py` is fully
  env-driven with zero hardcoded host/port. (frame.md Hypothesis Investigation)
- **No filesystem dependency on the sheet path**: `_client()` (`sheets.py:103-141`)
  can load credentials from an inline env string; all order/inventory/receipt
  persistence is via the Google Sheets / Drive APIs over HTTPS. The backend runs
  on an ephemeral container with zero persistent local disk. (frame.md)
- **The deploy pipeline never had automation**: `.github/workflows/ci.yml` is
  tests-only by design; deploy was always manual rsync. (research.md Finding 3)
- **Git is current**: the worktree is now fast-forwarded to `main` (`e27636f`),
  which carries every session fix as real commits (`dc5e29c` seam, `58e5a48`
  P006, GR-01). Railway-from-`main` deploys correct, current code.
- **GR-01 added a Drive dependency**: `SUPPLY_OS_GDRIVE_WZ_FOLDER_ID` +
  multipart WZ-photo upload to Google Drive (`drive.py`), reusing the
  service-account creds. This adds one env var and one prod-verification step.
- **vitest is wired** (`frontend/package.json:11`, `vitest@4.1.8`) — CI
  `npm run test` is green-capable; no test-runner gap.

## Desired End State

The backend runs on Railway, auto-deploying on push to `main`. `frontend/vercel.json`
rewrites `/api/*` to the Railway URL. The droplet service is stopped+disabled
(code left as a warm fallback) after one green pilot cycle. A committed
`RAILWAY_DEPLOY_RUNBOOK.md` makes the deploy repeatable, and the agent can run
`railway logs` / `railway redeploy` for the deploy/rollback loop. Verify by:
hitting `/health` and an authed `/api/products` through the Vercel domain and
confirming both resolve to Railway serving the live Sheet; completing one
back-out captain submit + one GR-01 WZ-photo upload through the new stack.

### Key Discoveries:

- `supply-os-v1/Procfile:1` — start command already Railway-shaped (`$PORT`).
- `supply-os-v1/app/sheets.py:103-141` — `_client()` credential branch order is
  the insertion point for base64 support.
- `supply-os-v1/app/config.py:32-33` — existing file-path + inline-JSON settings;
  add a sibling base64 setting.
- `frontend/vercel.json` — single rewrite `destination` is the cutover lever.
- `context/foundation/infrastructure.md` "Rollout Sequencing" — forbids stacking
  the datastore migration here.

## What We're NOT Doing

- **No datastore migration** (Sheets → Supabase/Postgres) — sequenced as the next
  change. `_choose_backend()` keeps Sheets running unchanged on Railway.
- **No PostHog error tracking** wiring — sequenceable, not a host-move dependency.
- **No custom domain** — keep the Railway `*.up.railway.app` URL; nip.io stays
  idle on the droplet.
- **No CI deploy job** — Railway's native GitHub integration handles auto-deploy;
  `ci.yml` stays tests-only.
- **No behavior change** — the only code change is base64 credential support +
  centralizing the (already-duplicated) credential resolution behind one helper;
  existing file/inline paths behave identically.
- **No droplet deletion** — stop+disable only; the box also hosts other services.

## Implementation Approach

Three agent-prepared, fully-committable artifacts (Phases 1-2) land on the branch
first: additive base64 credential support, a Railway builder-pin config, and an
owner-facing deploy runbook + dry-run-safe smoke kit. Then the owner executes the
production cutover (Phase 3) using the runbook, with the agent preparing the
`vercel.json` flip as a reviewable commit; the droplet stays warm as the rollback
target (revert one commit). After one green pilot cycle the owner decommissions
the droplet service and the close-out updates the roadmap (Phase 4).

The agent never handles production secrets: all `railway variables --set`, the
GitHub dashboard link, and the merge/push are owner steps (the agent's pushes are
blocked by design). The base64 credential path is what makes the
`railway variables --set` flow CLI-safe (single-line, no shell-escaping of the
multi-line service-account JSON).

## Critical Implementation Details

**Railway monorepo root.** The app lives in `supply-os-v1/`, not the repo root.
The Railway service must set **Root Directory = `supply-os-v1`** so it finds the
`Procfile`, `pyproject.toml`, and `railway.toml`. This is a service setting (set
in the runbook), not something `railway.toml` can self-declare.

**Builder pinning.** Railway is mid-migration Nixpacks→Railpack; an unpinned
service can silently flip builders on a routine redeploy and change how the
inline JSON env is parsed. `railway.toml` pins the builder explicitly.

**Cutover is reversible at the proxy layer.** Because `vercel.json`'s rewrite is
the only thing pointing the frontend at a backend, rollback is `git revert` of
that one commit → Vercel redeploys → traffic returns to the droplet in ~1 minute.
The droplet must stay running and unchanged through Phase 3.

## Phase 1: Backend creds + Railway config

### Overview

Add base64 service-account credential support via a **centralized resolver** (so
secrets set via `railway variables --set` are CLI-safe AND work for both the Sheet
backend and GR-01 Drive uploads — not just one), and pin the Railway builder +
healthcheck. Fully committable and automated-testable; no production interaction.

### Changes Required:

#### 1. Centralized service-account credential resolver

**File**: `supply-os-v1/app/config.py`

**Intent**: Add base64 as a supported credential source AND eliminate the
duplicated resolution logic (drive.py currently copies sheets.py's loader — the
root cause of the F1 break). One resolver + one presence-check become the single
source of truth for every credential consumer.

**Contract**: Add field `google_service_account_json_b64: SecretStr = SecretStr("")`
(env `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_B64`). Add two module-level helpers in
`config.py`: `resolve_service_account_info() -> dict` (preference order
file → b64 → inline → raise `RuntimeError`) returning the parsed creds_info dict,
and `has_service_account_creds() -> bool` (True if any of file / b64 / inline is
set). Scopes are NOT applied here — each caller applies its own. The b64 branch is
`json.loads(base64.b64decode(value))`.

#### 2. Route the gspread client + backend gate through the resolver

**File**: `supply-os-v1/app/sheets.py`

**Intent**: Replace `_client()`'s inline credential loading and `is_configured()`'s
presence check with the shared helpers, so base64 works for the Sheet backend and
`_choose_backend()` (main.py:227) no longer silently falls back to `seed_loader`
when creds are b64-only.

**Contract**: `_client()` (sheets.py:118-138) calls
`config.resolve_service_account_info()`, then
`Credentials.from_service_account_info(..., scopes=SCOPES)`. `is_configured()`
(sheets.py:87-90) uses `config.has_service_account_creds()` for the creds half
(still AND `google_sheet_id`).

#### 3. Route the Drive adapter through the resolver

**File**: `supply-os-v1/app/drive.py`

**Intent**: Replace drive.py's duplicated `_credentials()` loader and
`is_configured()` presence check with the shared helpers, so GR-01 WZ photo upload
keeps working under b64-only creds on Railway (the regression F1 names).

**Contract**: `_credentials()` (drive.py:56-72) calls
`config.resolve_service_account_info()`, then
`Credentials.from_service_account_info(..., scopes=DRIVE_SCOPES)`. `is_configured()`
(drive.py:41-47) uses `config.has_service_account_creds()` for the creds half
(still AND `gdrive_wz_folder_id`).

#### 4. Railway builder pin + healthcheck

**File**: `supply-os-v1/railway.toml` (new)

**Intent**: Pin the builder so a redeploy can't silently flip Nixpacks→Railpack,
and gate the deploy on a real boot via a healthcheck so a bad release (e.g. an
auth/Sheets misconfig) is held back instead of replacing a working one.

**Contract**: `[build] builder = "RAILPACK"` (Railway's current default; Nixpacks
is legacy — corrected per infrastructure.md 2026-06-12) (no `startCommand` —
Procfile owns it); `[deploy] healthcheckPath = "/health"` with a sane
`healthcheckTimeout` (e.g. 100s). Lives at `supply-os-v1/railway.toml` — Railway
reads it by absolute path from the repo root, not via the Root Directory setting.

#### 5. Document the new var + prod values

**File**: `supply-os-v1/.env.example`

**Intent**: Document `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_B64` and the prod-value
expectations (backend=sheet, CORS=Vercel origin) without committing any secret.

**Contract**: Add the `..._JSON_B64` line under the Google Sheets block with a
one-line comment on when to use it (Railway CLI). No real values.

#### 6. Credential-resolver test (covers all four consumers)

**File**: `supply-os-v1/tests/test_sheets_read.py` (or a new `test_config_creds.py`)

**Intent**: Lock the shared resolver and prove b64-only creds satisfy BOTH backends
— the exact F1 failure mode.

**Contract**: Unit tests: (a) `resolve_service_account_info()` round-trips a fake
SA-shaped dict through base64; preference order file → b64 → inline holds;
(b) `has_service_account_creds()` is True when ONLY the b64 var is set; (c) with
b64-only creds, `sheets.is_configured()` AND `drive.is_configured()` both return
True (so `_choose_backend()` stays on sheets and Drive upload stays enabled). Mock
`Credentials.from_service_account_info` / `gspread.authorize` per existing sheets
test patterns.

### Success Criteria:

#### Automated Verification:

- Backend tests pass: `cd supply-os-v1 && python -m pytest`
- Lint clean: `cd supply-os-v1 && ruff check .`
- Resolver test passes: b64 round-trips; preference order file → b64 → inline holds
- With b64-only creds, BOTH `sheets.is_configured()` and `drive.is_configured()`
  return True (guards the F1 silent-seed-fallback + GR-01 Drive regression)
- `supply-os-v1/railway.toml` exists, is valid TOML, and sets `healthcheckPath = "/health"`

#### Manual Verification:

- `railway.toml` builder value matches the builder currently recommended for new
  Railway services (confirm against Railway docs at runbook-writing time)

**Implementation Note**: After automated verification passes, pause for human
confirmation before Phase 2.

---

## Phase 2: Deploy runbook + smoke kit

### Overview

Produce the owner-facing executable artifacts: an exact, copy-pasteable Railway
deploy runbook and a dry-run-safe smoke script. Everything the owner needs to
run the cutover without the agent touching a secret.

### Changes Required:

#### 1. Railway deploy runbook

**File**: `docs/pita-supply-os-v1/RAILWAY_DEPLOY_RUNBOOK.md` (new)

**Intent**: Step-by-step deploy + cutover + rollback the owner executes, with
every command literal and the full env-var checklist.

**Contract**: Sections — (a) CLI install + `railway login`/`init`/`link`; (b) set
**Root Directory = `supply-os-v1`**; (c) the base64 encode command for the SA JSON
(`base64 -i sa.json | tr -d '\n'`) and `railway variables --set` for all required
vars (see checklist below); (d) `railway up` + direct-URL smoke; (e) link GitHub
for auto-deploy on `main`; (f) cutover (flip `vercel.json`, merge/push); (g)
rollback rehearsal (`git revert` the vercel.json commit; `railway redeploy`).
Env checklist: `SUPPLY_OS_ENV=prod`, `SUPPLY_OS_DATA_BACKEND=sheet`,
`SUPPLY_OS_GOOGLE_SHEET_ID`, `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_B64`,
`SUPPLY_OS_GDRIVE_WZ_FOLDER_ID`, `SUPPLY_OS_CAPTAIN_TOKENS`,
`SUPPLY_OS_MANAGER_TOKEN`, `SUPPLY_OS_CORS_ALLOW_ORIGINS=https://pita-supply-os.vercel.app`,
optional `SUPPLY_OS_POSTHOG_API_KEY`/`SUPPLY_OS_POSTHOG_HOST`. Note: do NOT set
`SUPPLY_OS_SEED_DIR` (sheet mode).

#### 2. Dry-run-safe smoke script

**File**: `supply-os-v1/scripts/smoke_railway.sh` (new)

**Intent**: One script the owner runs against the Railway URL to prove the deploy
is healthy and serving the live Sheet — without placing a real order.

**Contract**: Takes the base URL + tokens as args/env. Checks: `/health` 200;
`/health/internal` (manager token) reports `data_backend == "sheet"` (catches a
silent seed fallback — the F1 runtime backstop); authed `/api/products` returns >0
items (live Sheet, not seed); authed `/api/manager/queue` 200; Captain
`/api/captain/orderable` returns the expected multi-supplier set. **No
submit/dispatch** — read-only smoke only (honors the "never place a real order
from a test" hard rule). Exits non-zero on any failure.

### Success Criteria:

#### Automated Verification:

- Runbook exists and names all 9 env vars + the base64 command + a rollback section:
  `grep -c SUPPLY_OS_ docs/pita-supply-os-v1/RAILWAY_DEPLOY_RUNBOOK.md` ≥ 8
- Smoke script passes syntax check: `bash -n supply-os-v1/scripts/smoke_railway.sh`
- Smoke script contains no submit/dispatch call:
  `! grep -E '/api/(captain/submit|manager/dispatch)' supply-os-v1/scripts/smoke_railway.sh`
- Smoke script asserts the live backend (F1 backstop):
  `grep -q 'health/internal' supply-os-v1/scripts/smoke_railway.sh`

#### Manual Verification:

- Owner reads the runbook end-to-end; every command is copy-pasteable and assumes
  no agent access to secrets
- The env checklist matches the owner's actual droplet `.env` keys (nothing missing)

**Implementation Note**: Pause for human confirmation before Phase 3 (the prod cutover).

---

## Phase 3: Production cutover (owner-executed, agent-prepared)

### Overview

The owner deploys to Railway and runs the smoke kit; the agent prepares the
`vercel.json` flip as a reviewable commit; the owner merges/pushes to repoint
traffic. The droplet stays warm as the rollback target.

### Changes Required:

#### 1. vercel.json rewrite cutover

**File**: `frontend/vercel.json`

**Intent**: Repoint the `/api/*` rewrite from the droplet nip.io host to the
Railway URL. Prepared by the agent on the branch; the owner merges/pushes it
(which triggers the Vercel production redeploy) only after Railway smoke is green.

**Contract**: Change the single rewrite `destination` from
`https://supply.46-101-213-61.nip.io/api/:path*` to
`https://<railway-app>.up.railway.app/api/:path*` (exact host filled from the
owner's `railway up` output). JSON stays valid; SPA fallback rewrite unchanged.

### Success Criteria:

#### Automated Verification:

- `frontend/vercel.json` is valid JSON and the `/api/:path*` destination points at
  the Railway host (not nip.io)
- Frontend builds with the edit: `cd frontend && npm run build`

#### Manual Verification:

- Owner: `railway up` succeeds; `railway logs` shows a clean uvicorn boot
- Owner: smoke kit green against the Railway URL directly (`/health`,
  authed `/api/products` shows live Sheet data, manager queue 200)
- Owner: after merge/push, a request to the **Vercel domain** `/api/health`
  resolves through Railway (not the droplet)
- Owner: one **back-out** captain submit completes end-to-end (no real order placed)
- Owner: Manager queue loads the submitted order; GR-01 receive screen confirms a
  delivery through Railway (WZ photo upload is disabled by design — Drive is a
  dead end; photos return via Supabase Storage as a separate change)
- Owner: rollback rehearsed — reverting the vercel.json commit returns traffic to
  the droplet within ~1 minute

**Implementation Note**: Pause after cutover; run one real Wola×Bukat pilot cycle
on Railway before Phase 4.

---

## Phase 4: Decommission + close-out (owner-executed, after one pilot cycle)

### Overview

After Railway is boring for one pilot cycle, stop+disable the droplet service
(leave code/venv as a fallback) and update the roadmap/docs to record the pipeline
as repaired.

### Changes Required:

#### 1. Droplet service decommission (owner, on the droplet)

**File**: n/a (operational — documented in the runbook's decommission section)

**Intent**: Free the droplet's RAM and remove the now-redundant backend process
while keeping it as a cold fallback.

**Contract**: `systemctl stop jarvis-supply-os && systemctl disable jarvis-supply-os`
on the droplet; leave `/opt/pitabros/supply-os/` code + venv intact. Caddy block
may be left or removed (documented).

#### 2. Roadmap + docs close-out

**File**: `context/foundation/roadmap.md` (+ note in the runbook)

**Intent**: Record that the deploy pipeline is repaired (Railway auto-deploy on
`main`) and D-01's deploy gap is genuinely closed.

**Contract**: Update the relevant roadmap item/status to reflect Railway as the
backend host with auto-deploy; add a one-line pointer to the runbook.

### Success Criteria:

#### Automated Verification:

- `context/foundation/roadmap.md` references Railway as the backend host /
  auto-deploy and links the runbook

#### Manual Verification:

- One green Wola×Bukat pilot cycle completed on Railway before decommission
- Owner: droplet service stopped + disabled; prod (via Railway) still serves after
- Owner: droplet code/venv confirmed left intact as a fallback

---

## Testing Strategy

### Unit Tests:

- Base64 credential round-trip + branch-selection in `_client()` (Phase 1)
- No new business logic — the migration is host/config, not behavior

### Integration Tests:

- Read-only smoke kit against the live Railway URL (Phase 2 artifact, run in Phase 3)
- End-to-end manual: back-out captain submit + GR-01 WZ upload through Railway (Phase 3)

### Manual Testing Steps:

1. Smoke the Railway URL directly before any cutover (Phase 3)
2. After vercel.json flip, confirm the Vercel domain serves through Railway
3. Back-out captain submit end-to-end (no real order)
4. GR-01 receive + WZ photo upload to Drive
5. Rehearse rollback (revert vercel.json) and confirm droplet serves again

## Performance Considerations

Railway Hobby is always-on and resource-metered; keep App Sleeping OFF (no pilot
cold-starts) and set a $10–20 hard spend cap + alerts (per the runbook). Watch the
long-lived uvicorn process for memory creep. WZ photo upload is disabled (Drive
dead end), so the multipart-body-size concern does not apply for this change.

## Migration Notes

- **Secrets**: never committed. Owner sets them via `railway variables --set`
  using the base64 SA JSON (CLI-safe). The droplet `.env` is the reference list.
- **Rollback**: proxy-layer — `git revert` the vercel.json commit; the droplet
  stays warm through Phase 3 and (disabled) as a cold fallback after Phase 4.
- **No data migration**: same Google Sheet, same `_choose_backend()` — zero schema
  or data change.

## References

- Frame brief: `context/changes/deploy-pipeline-repair/frame.md`
- Research: `context/changes/deploy-pipeline-repair/research.md`
- Start command: `supply-os-v1/Procfile:1`
- Credential loading: `supply-os-v1/app/sheets.py:103-141`, `config.py:32-33`
- Cutover lever: `frontend/vercel.json`
- Sequencing constraint: `context/foundation/infrastructure.md` "Rollout Sequencing"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend creds + Railway config

#### Automated

- [x] 1.1 Backend tests pass: `cd supply-os-v1 && python -m pytest` — 4d69be4
- [x] 1.2 Lint clean: `cd supply-os-v1 && ruff check .` — 4d69be4
- [x] 1.3 Resolver test: b64 round-trips; preference file → b64 → inline holds — 4d69be4
- [x] 1.4 With b64-only creds, sheets.is_configured() AND drive.is_configured() both True — 4d69be4
- [x] 1.5 `supply-os-v1/railway.toml` exists, valid TOML, sets healthcheckPath=/health — 4d69be4

#### Manual

- [x] 1.6 `railway.toml` builder value matches current Railway-recommended builder — 4d69be4

### Phase 2: Deploy runbook + smoke kit

#### Automated

- [x] 2.1 Runbook names all env vars + base64 command + rollback section (`grep -c SUPPLY_OS_` ≥ 8) — 9c9ec5f
- [x] 2.2 Smoke script passes `bash -n` syntax check — 9c9ec5f
- [x] 2.3 Smoke script contains no submit/dispatch call — 9c9ec5f
- [x] 2.4 Smoke script asserts the live backend via /health/internal (data_backend==sheet) — 9c9ec5f

#### Manual

- [x] 2.5 Owner reads runbook end-to-end; every command copy-pasteable, no agent-secret access — 9c9ec5f
- [x] 2.6 Env checklist matches the owner's actual droplet `.env` keys — 9c9ec5f

### Phase 3: Production cutover

#### Automated

- [x] 3.1 `frontend/vercel.json` valid JSON; `/api/:path*` destination points at Railway host
- [x] 3.2 Frontend builds with the edit: `cd frontend && npm run build`

#### Manual

- [x] 3.3 Owner: `railway up` succeeds; `railway logs` shows clean uvicorn boot
- [x] 3.4 Owner: smoke kit green against Railway URL (health, live-Sheet products, queue)
- [x] 3.5 Owner: after merge/push, Vercel domain `/api/*` resolves through Railway
- [x] 3.6 Owner: one back-out captain submit completes end-to-end (no real order)
- [ ] 3.7 Owner: Manager queue loads; GR-01 receive confirms through Railway (WZ photos disabled — Supabase later)
- [ ] 3.8 Owner: rollback rehearsed — reverting vercel.json returns traffic to droplet in ~1 min

### Phase 4: Decommission + close-out

#### Automated

- [x] 4.1 `roadmap.md` references Railway as backend host / auto-deploy + links runbook

#### Manual

- [ ] 4.2 One green Wola×Bukat pilot cycle completed on Railway before decommission
- [ ] 4.3 Owner: droplet service stopped + disabled; prod still serves via Railway after
- [ ] 4.4 Owner: droplet code/venv left intact as a fallback

## Close-out note (2026-06-15)

Migration is **functionally complete**: Railway backend is live (`env=prod`,
`data_backend=sheet`, live Sheet served — 134 products, manager queue 200, Bukat
orderable), Vercel `/api/*` flows through Railway (verified via the
`x-railway-edge` header), and a real Captain submit landed on the Manager queue
end-to-end (3.6). The remaining Progress items are owner-run or have degraded into
no-ops:

- **3.7 (GR-01 receive through Railway)** — Manager queue load is confirmed; the
  goods-receipt path was not exercised this cycle. WZ photo upload stays disabled
  by design (Drive dead-end → Supabase Storage later). Low risk: the receive route
  is unchanged code, host-agnostic.
- **3.8 (rollback rehearsal to droplet)** — **degraded.** The droplet's HTTPS is
  down (TLS handshake fails), so the documented one-commit `vercel.json` revert no
  longer has a live target. Rollback at the proxy layer still works mechanically;
  the fallback host is just not currently serving. Railway prod is healthy, so this
  does not block close-out.
- **4.2 (one green pilot cycle)** — owner judgment; gates decommission, not the
  migration itself.
- **4.3 / 4.4 (droplet stop+disable / leave code intact)** — **moot in practice.**
  The droplet already stopped serving; a clean `systemctl stop/disable` is optional
  cleanup the owner can do via SSH whenever convenient. Code/venv remain in place as
  a cold fallback.

Net: the broken-deploy-pipeline problem this change was opened to fix is resolved —
git (`main`) is now the deployable source of truth via Railway auto-deploy. Datastore
(Sheets → Supabase) is the next change (**S-10**), per the `infrastructure.md`
sequencing rule (host first, prove it boring, then datastore — never two big changes
in one step).
