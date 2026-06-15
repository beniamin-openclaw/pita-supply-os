---
project: "Pita Supply OS"
researched_at: 2026-06-04
recommended_platform: "Backend: droplet (default — primary host for the pilot and the likely end-state at this scale). Frontend: Vercel."
runner_up: "Railway = triggered backend upgrade path (then Render #2, Fly.io #3)"
context_type: mvp
decision: "Droplet is the default backend host (now and possibly permanent at this scale). Railway is a documented upgrade path, taken only when a trigger fires — scale, real ops toil, or wanting agent-owned deploys — not an assumed migration. Frontend settled on Vercel."
tech_stack:
  language: "Python 3.10+ (backend) + TypeScript (frontend)"
  framework: "FastAPI / uvicorn (backend) + React + Vite (frontend)"
  runtime: "long-running ASGI web process (backend) + static SPA (frontend)"
  database: "Google Sheets today → MIGRATE to Supabase (Postgres), behind _choose_backend() — now recommended/urgent, see Stack Element Assessments"
element_decisions:
  datastore: "Supabase (Postgres) — migrate off Sheets; runner-up Neon"
  email_dispatch: "Keep Gmail compose-URL human-send + add server-side audit log (hybrid)"
  error_tracking: "PostHog error tracking (already paid; GA) — not a separate Sentry"
  ci_cd: "GitHub Actions — add a product workflow (backend ruff+pytest; frontend tsc+eslint+build+vitest)"
  secrets: "No change; migration off Sheets removes the inline-JSON \\n footgun"
scale_note: "Owner now expects company-wide rollout in ~2-3 weeks (was 'small pilot') — elevates datastore/CI/monitoring to urgent and fires the backend-host 'scale arrives' trigger"
updated: 2026-06-12
update_note: "Focused update — backend-host trigger FIRED (deploy pipeline confirmed broken this week → Railway now, not 'if/when'); added WZ photo storage → Supabase Storage (Drive service-account-quota dead end); refreshed Railway deploy shape (Railpack now default, IPv6/Hypercorn footgun, spend caps); re-sequenced host-first."
---

## Recommendation

**This is a split deployment. The frontend is settled; the backend default is the droplet.**

- **Frontend → Vercel (settled, no change).** A Vite React SPA with per-PR previews and a `vercel.json` `/api/*` → backend external rewrite. Vercel is a clean 5/5 fit and is already live there; nothing argues for moving it.
- **Backend → keep the droplet (default — and a legitimate end-state at this scale).** The FastAPI/uvicorn service is a long-running ASGI process running today on a VPS droplet (`web: uvicorn app.main:app` via Procfile/systemd, Caddy for TLS). It works, it's cheap and fixed-cost, you control the region and data residency, there's no vendor lock-in, and the inline-JSON service-account footgun is already solved there. For a small internal tool at pilot scale, that is not a placeholder — it's a defensible primary host that could stay the home for a long time.

**Railway is a documented *upgrade path*, not an assumed migration.** The FastAPI process's hard constraint (a long-running ASGI server) eliminates JS-edge/serverless hosts (Cloudflare Workers, Netlify) and makes Vercel awkward for the backend, so the only viable upgrade targets are container PaaS. Among those, **Railway** leads: it honors the existing `Procfile` unchanged (lowest migration friction), is covered by an existing paid premium subscription (≈$0 marginal on the $5 Hobby credit), has a strong CLI + `llms.txt` docs, and offers managed Postgres for the future datastore move. **Render** is #2 (cleanest 5/5, GA MCP) if mature agent tooling outweighs $7/mo; **Fly.io** #3.

**You migrate off the droplet only when a trigger fires** (see *Decision Triggers* below) — not on a timeline. Until then the droplet is the answer.

---

## Update — 2026-06-12 (focused: triggers fired + photo storage)

*Layered on the 2026-06-04 base (m1l5 — `git 92ec804`). The **platform decision is unchanged** — Railway + Supabase still win; this records what this week's lived evidence changed. It **supersedes the "wait for a trigger" timing** for the backend host and **adds WZ photo storage**, an element the base doc predates (GR-01 shipped after).*

### Status change — the backend-host trigger has FIRED (act now, not "if/when")

The base doc treated the Railway move as an upgrade taken "only when a trigger fires." Two fired for real this week:

- **Trigger #2 (real ops toil) + #3 (want agent-owned deploys):** the droplet deploy pipeline is **confirmed broken** — `git push` does **not** deploy, the running `app/` is a flat copy disconnected from git, and the only working deploy is a manual `git clone` to `/tmp` + `cp` + `systemctl restart` (memory `prod-deploy-pipeline-broken`). Every backend change this week needed hand-piloted SSH. That *is* the toil the trigger names.
- **Shared-box risk:** the droplet also runs Caddy, Postgres and unrelated dashboards — an agent can't safely operate it, capping agent-owned deploys.

**Net: backend → Railway is now near-term and recommended, not hypothetical.** Frontend stays on Vercel. Crucially the host move is **data-agnostic** — Railway runs the existing `Procfile`/Sheets backend unchanged, so it lands **before** the datastore migration and immediately gives git-push deploy for every later change (including the Supabase migration itself). See re-sequencing below.

### NEW element — WZ photo storage → Supabase Storage (private bucket + signed URLs)

**Decision: WZ delivery-note photos go to a private Supabase Storage bucket, uploaded server-side from FastAPI with the `service_role` key, viewed via short-lived signed URLs.** Same Supabase project as the datastore migration.

**Why Drive is a structural dead end:** a Google **service account has no Drive storage quota**, so it can't own uploaded files in a normal Drive → `403 storageQuotaExceeded`, confirmed in prod 2026-06-10 (memory `gr-01-wz-photos-supabase`). Drive escapes (Shared Drive / domain-wide delegation) were rejected. **Supabase Storage bills to the project, not an identity**, so the whole quota/scope/sharing class of problem vanishes (GA, checked 2026-06-12).

**Mapping onto `app/drive.py` (drop-in-ish):**

| Today (`drive.py`) | Supabase Storage |
|---|---|
| `ensure_order_folder(order_id)` | **Gone** — no folder objects; just a key prefix `wz/<order_id>/` |
| `upload_photo(folder_id, name, bytes, mime)` | `supabase.storage.from_("wz-photos").upload(path=f"wz/{order_id}/{name}", file=bytes, file_options={"content-type": mime})` |
| receipt stores `wz_photo_folder_id/url` | store `wz_photo_path_prefix` (`wz/<order_id>`) + `wz_photo_count`; sign a URL per photo at view time (`create_signed_url(path, expires_in=…)`) |
| re-enable | flip `WZ_PHOTOS_ENABLED=true` in `frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx` |

**Limits/pricing (Pro, 2026-06-12):** 100 GB storage + 250 GB egress included, overage $0.0213/GB; standard upload handles multi-MB phone JPEGs (max file 500 GB). Trivially enough.

**Anti-bias (Supabase Storage):**
- *Devil's advocate:* (1) GR-01's end goal is a WZ photo reaching the **GoStock accountant by email** — a signed URL expires, so that path must either **attach the image bytes to the dispatch email** or use a re-signable link, not a raw bucket URL. Decide explicitly. (2) `service_role` key is all-powerful — server-side only, never in the SPA. (3) content-type must be set explicitly or files serve as `text/html`. (4) use the current `sb_secret_…` key format.
- *Pre-mortem:* shipped with a **public** bucket "to keep it simple" → delivery notes (supplier + price data) become guessable-URL public business documents = leak; or signed URLs at 1h expiry, accountant opens the mail next morning → dead links. → **Mitigation: private bucket; decide accountant delivery (attach bytes on dispatch, or re-sign on demand).**
- *Unknown unknowns:* `service_role` bypasses RLS on `storage.objects`, but if the client is ever inited with the **anon** key by mistake, uploads silently fail under RLS; and **never persist a signed URL** (it expires) — store the path, sign on demand.

**Decoupling win:** photos-on-Supabase touches only the receipt photo path, not order data — so it can ship as a **small standalone change even before** the full Sheets→Postgres move, re-enabling GR-01 photos quickly.

### Railway deploy shape — 2026-06-12 refresh (fresh research)

Deltas vs the base runbook:
- **Builder churn resolved:** **Railpack is now the default** (Nixpacks → maintenance). Pin `builder = "RAILPACK"` in `railway.toml`. **Gotcha:** `railway.toml` is referenced by **absolute path from repo root** (`/supply-os-v1/railway.toml`) — it does NOT follow the Root Directory setting.
- **Monorepo:** set service **Root Directory = `supply-os-v1/`** so Railway builds only the backend (frontend stays on Vercel). GitHub link is a **one-time dashboard step**; after that `git push` deploys — precisely what fixes the broken pipeline.
- **NEW footgun — IPv6:** Railway's private network is IPv6-only and uvicorn can't dual-stack bind from the CLI. `uvicorn --host 0.0.0.0 --port $PORT` is fine for **public HTTP** (all the pilot needs); Railway's own FastAPI guide now recommends **Hypercorn** (`hypercorn app.main:app --bind 0.0.0.0:$PORT`) — keep as fallback if health checks flake. A hardcoded port fails the health check.
- **Secrets:** base64-encode the Google SA JSON to one line (`base64 -i sa.json | tr -d '\n'`) to dodge newline escaping; the Supabase Postgres connection string is plain single-line.
- **Cost safety:** Hobby is **always-on by default**; keep **App Sleeping OFF** for prod. Spend caps are **NOT on by default** — set a $10–20 hard limit + email alerts (75/90/100%).
- **Region:** EU West (**Amsterdam**); ~15–20 ms to Warsaw. No PL/Frankfurt option.
- **Ops loop:** rollback via dashboard (three-dot → Rollback, restores image + vars) or `railway redeploy`; logs via `railway logs`. MCP server still **beta**.

### Re-sequencing (updated by this week's evidence)

The base doc led with "datastore first." The acute pain now is the **broken deploy pipeline** + **blocked photos**, both independent of the DB. Recommended order:

1. **Backend host → Railway FIRST** — stops the bleeding (git-push deploy), data-agnostic (keep the Sheets backend + `Procfile`), lowest-risk. Every later step then deploys cleanly.
2. **WZ photos → Supabase Storage** — small, standalone, re-enables GR-01 photos; stands up the Supabase project.
3. **Datastore Sheets → Postgres (Supabase)** — the bigger move, behind `_choose_backend()`; keep the base pre-mortem rule (don't cut over the datastore *and* go multi-location in one step).
4. **In parallel (low-risk):** product CI (GitHub Actions) + PostHog error tracking, per the base doc.

### Risk register — additions (2026-06-12)

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| uvicorn IPv6/dual-stack → Railway health check fails | Research (Railway) | M | M | Bind `--host 0.0.0.0 --port $PORT`; fall back to Hypercorn `--bind 0.0.0.0:$PORT` |
| `railway.toml` ignored (expected at Root Directory, not repo root) | Research (Railway) | M | M | Reference it by absolute path `/supply-os-v1/railway.toml` |
| Public Storage bucket leaks WZ business docs | Pre-mortem (Storage) | L | H | Private bucket + signed URLs; `service_role` server-side only |
| Signed-URL expiry breaks async accountant viewing | Devil's advocate (Storage) | M | M | Attach image bytes to the dispatch email, or re-sign on demand; never persist a signed URL |
| Two big changes stacked (host + datastore) during rollout | Base pre-mortem, reaffirmed | M | H | Sequence host → photos → datastore; one change per pilot cycle |

## Decision Triggers — when to take the Railway upgrade

Migrate the backend to Railway (or Render) when **any one** of these becomes true:

1. **Scale arrives** — you begin the PRD rollout beyond the single pilot (week-2 suppliers, then +2 locations). Hand-maintaining one VPS gets less appealing as throughput, data, and uptime expectations grow; move *before* scale, not during.
2. **Ops toil becomes real** — a 2am incident, a kernel/security-patch chore you resent, a silent TLS-renewal or disk-full scare. The droplet's one liability is that *you* are the on-call and an agent can't reliably fix a wedged box; the day that bites is the day to offload it.
3. **You want agent-owned deploys** — if the goal becomes "the agent runs the deploy/rollback loop end-to-end," the droplet's bespoke SSH ops cap how far that goes; a managed PaaS with a CLI/MCP is the enabler.

If none of these fire, **do nothing** — the droplet stays the default.

## Platform Comparison

Hard constraint applied first: **a long-running Python/FastAPI/uvicorn process**. Platforms that can't run it as-is are dropped from the backend shortlist (they may still be excellent frontend hosts).

| Platform | CLI-first | Managed/serverless | Agent-readable docs | Stable deploy API | MCP / integration | Backend verdict |
|---|---|---|---|---|---|---|
| **Railway** | Pass | Pass | Pass (`llms.txt` + per-page `.md`) | Pass (`railway up/redeploy/down` + GraphQL) | Partial (official MCP, **beta/WIP**) | **Shortlist #1 (target)** |
| **Render** | Pass | Pass | Pass (`llms.txt` + `llms-full.txt` + coding-agents guide) | Pass (REST trigger-deploy + deploy hooks) | Pass (**GA** MCP, 20+ tools) | **Shortlist #2** |
| **Fly.io** | Pass | Partial (own the Dockerfile; unmanaged-PG footgun) | Partial (public MD repo, no verified `llms.txt`) | Pass (`fly deploy`; rollback = image redeploy) | Partial (MCP **experimental**) | **Shortlist #3** |
| **Vercel** | Pass | Pass | Pass (`llms.txt`/`llms-full.txt`) | Pass (`vercel --prod`) | Pass (GA MCP) | **Frontend only** — FastAPI runs only as serverless functions (no always-on, TTL cache won't persist, cold starts) |
| **Cloudflare Workers** | Pass (`wrangler`) | Pass | Pass (`llms.txt`, GA MCP) | Pass | Pass (GA MCP) | **Fail (backend)** — Python Workers = Pyodide/Wasm **beta**, no uvicorn, `gspread`/`google-auth` (compiled) unsupported → major rewrite. Excellent static/SPA host. |
| **Netlify** | Pass | Pass | Pass | Pass | Pass (GA MCP, Jun 2025) | **Fail (backend)** — Functions are JS/TS/Go only, **no Python runtime**. Strong JAMstack/SPA host. |

### The droplet (current default) on the same scorecard

| Criterion | Droplet (VPS + uvicorn via Procfile/systemd, Caddy TLS) | vs. Railway |
|---|---|---|
| CLI-first | ~ Partial — all do-able over SSH (`git pull` + `systemctl restart`, `journalctl`), but it's bespoke shell *you* maintain, not a deterministic platform command | Pass |
| Managed over raw infra | ✗ **Fail** — you own OS patching, kernel/security updates, the systemd unit, Caddy, firewall, disk, monitoring, recovery | Pass |
| Agent-readable docs | ~ Neutral — nothing proprietary to read; it's just Linux, which the agent knows cold | Pass (`llms.txt`) |
| Stable deploy API | ~ Partial — deterministic *if* you scripted it well, but no platform-provided versioned deploy/rollback | Pass |
| MCP / integration | ✗ **Fail** — no typed tool access; the agent parses raw SSH output | ~ Partial (beta MCP) |

The two "Fail" marks are true essentially by definition — raw infra is not "managed" and has no MCP — so this scorecard measures *agent-operability*, not overall fitness.

**Where the droplet beats Railway** (and why it's the default, not a placeholder):
- **Zero migration risk** — it already runs the pilot; every Railway risk below is one you *take on by moving*, and the inline-JSON secrets footgun is already solved here.
- **Predictable fixed cost** (~$4–6/mo); no usage-based metering that can creep past a credit.
- **No builder churn** — your deploy is exactly what you scripted; Railway is mid-migrating Nixpacks→Railpack.
- **Any region, including Poland** — full data-residency control (Railway gives you Amsterdam).
- **No vendor lock-in; no platform limits** — cron, background workers, long requests all just work.

Net: the droplet *loses* only on the agent-friendly axes this lesson scores, and *wins* on control, cost-predictability, and zero-risk. That's why it's the default, and why Railway is an upgrade taken on a trigger — not a correction of something broken.

### Shortlisted Platforms (backend)

#### 1. Railway (upgrade path — first choice if a trigger fires)

Honors the existing `Procfile` unchanged → the lowest-friction path off the droplet. Covered by an existing paid premium subscription, so the small always-on service is ≈$0 marginal (within the $5 Hobby credit; resource-metered per-second beyond that). Full operational loop via the `railway` CLI (`up`, `logs`, `redeploy`, `down`, `variables --set`), `llms.txt` + per-page `.md` docs, and one-click managed Postgres ready for the datastore migration. Only soft gap: the official MCP server is self-labeled work-in-progress (beta) with a narrow remote toolset — the lightest-weighted criterion.

#### 2. Render (runner-up)

The cleanest scorecard — Pass on all five, anchored by an **official GA MCP server** (20+ tools: services, logs, metrics, read-only SQL) and the best agent docs in the field (`llms.txt` + `llms-full.txt` + a dedicated "Using Render with Coding Agents" guide), plus a REST trigger-deploy API and deploy hooks for CI. The gap vs. Railway is practical, not technical: **$7/mo** for an always-on service (the free tier sleeps after 15 min → 30–60s cold start, which would violate the pilot's "orders appear without a separate tool" guarantee), no existing subscription, and the start command must be moved into `render.yaml`/dashboard (Procfile not auto-read). Choose Render if GA-grade agent tooling outweighs cost + a little more migration work.

#### 3. Fly.io (third)

Cheapest raw (~$2–6/mo pay-as-you-go), the only candidate with a **Warsaw region**, and true scale-to-zero (`auto_stop_machines`). But it's the least *managed*: you own a generated Dockerfile, the legacy unmanaged-Postgres path is a self-operation trap (the Supabase-on-Fly managed partnership was deprecated Apr 2025; Fly's own Managed Postgres is region-limited and still maturing), the MCP server is experimental, there's no verified official `llms.txt`, and **rollback is an image redeploy that does not revert config/secrets** — a real footgun. The multi-region machinery is overkill for a single-location pilot.

## Anti-Bias Cross-Check: Railway (chosen target)

### Devil's Advocate — Weaknesses

1. **No Poland region** — closest is Amsterdam (EU-West). Latency to Warsaw is fine (~25ms), but offers no PL-local data-residency story if that ever becomes a requirement (only Fly has a `waw` region; Render's EU is Frankfurt).
2. **MCP server is beta / work-in-progress** with a narrow remote toolset — for an agent-operated deploy story you'll parse CLI output for logs/vars rather than call typed MCP tools. Render's GA MCP is materially ahead.
3. **Builder churn (Nixpacks → Railpack)** — Railway is mid-migration between builders; a routine redeploy can silently flip the builder and change build behavior unless it's pinned explicitly.
4. **Usage-based billing with no hard cap by default** — the $5 credit covers steady state, but a memory leak in the always-on uvicorn process or a traffic spike bills past it silently. Usage alerts are not on by default.
5. **Convenience lock-in** — dashboard env/DB management invites platform-specific config to drift out of the repo. Mitigated by keeping persistence behind `_choose_backend()` and config in `.env.example`.

### Pre-Mortem — How This Could Fail

It worked on day one — so nobody pinned the builder or set a spend alert. Three weeks later a routine redeploy flipped Nixpacks→Railpack; the build subtly changed how the inline service-account JSON env var was parsed, and Sheets auth began failing intermittently **in production** — but only *after* the manual cut-off, so orders silently stopped reaching the Manager queue during a real Bukat order. The 60-second in-memory TTL cache masked it intermittently, so it read as "flaky connectivity," not a config regression. Meanwhile a slow memory creep in the long-lived uvicorn process pushed RAM past the Hobby credit with no spend cap. The root mistake was treating *"it deployed"* as *"it's operable"* — skipping the rollback rehearsal and the secrets-parsing test that `sheets.py`'s own documented `EnvironmentFile` `\n`-corruption footgun should have flagged before the first production order.

### Unknown Unknowns

- **The inline-JSON service-account footgun is platform-sensitive.** `app/sheets.py` already warns that `EnvironmentFile` escaping can corrupt inline JSON containing `\n`. Railway's env handling (dashboard vs `railway variables --set`) may escape newlines differently than the droplet's systemd — prefer the `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE` path (a file mounted/kept off-repo) or base64-encode the key.
- **`$PORT` is injected by Railway** — uvicorn must bind `0.0.0.0 --port $PORT`, not the hardcoded `8901`, or health checks fail with no obvious error.
- **Scale-to-zero ("app sleeping") is opt-in and OFF by default** — good (no surprise cold starts at the pilot), but if it's later enabled to save money, the first post-idle request can 502 and a >10s boot is killed → would break the pilot's "no separate tool" guarantee.
- **Preview/PR environments don't auto-isolate the datastore** — without per-environment env vars, a Railway preview deploy could write to the **real** Sheet (or, post-migration, the real DB). The regression-suite "back out on submit" rule is load-bearing here.
- **GitHub push-to-deploy linking is a one-time dashboard step**, not fully CLI — a small dent in the "agent does everything in the terminal" ideal.

## Operational Story

How the deployment actually operates — current droplet+Vercel reality, and the Railway target for the cutover.

- **Preview deploys**: *Vercel (now)* — automatic per-branch/PR preview URLs for the SPA, GA. *Railway (target)* — PR environments available, but **must set per-environment env vars** so a preview never points at the production Sheet/DB; pair with the regression suite's back-out-on-submit rule.
- **Secrets**: *Droplet (now)* — systemd `EnvironmentFile`; the documented `\n`-in-inline-JSON corruption risk means the `..._JSON_FILE` path is preferred. *Vercel* — env vars in project settings; the backend secrets do **not** live on Vercel (the SPA only proxies). *Railway (target)* — `railway variables --set KEY=value` or dashboard; use `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE` or base64 to dodge the newline footgun. **Never** commit `.env`/`sa.json` — only `.env.example`.
- **Rollback**: *Droplet (now)* — redeploy previous revision / restart service manually. *Vercel* — `vercel rollback <id>` / promote a prior deployment, GA. *Railway (target)* — `railway redeploy` (roll forward) / `railway down` (remove latest); rehearse a rollback before the first real order. No DB rollback for forward migrations — handle data changes separately.
- **Approval**: a human approves anything irreversible or production-affecting — production publish, secret rotation, and (post-migration) any datastore schema change or destructive SQL. An agent may read logs, run a dry-run/preview, and prepare a deploy, but a person confirms the production cutover. This mirrors the product's own "never auto-order; a human always commits" rule.
- **Logs**: *Vercel* — `vercel logs --environment production`. *Railway (target)* — `railway logs`, `railway logs --build`, `railway logs -n 100` (read-only, agent-friendly). *Droplet (now)* — `journalctl`/service logs over SSH. Render's GA MCP would expose logs as typed tools if Render is chosen instead.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Inline service-account JSON corrupted by env escaping (Sheets auth fails in prod) | Unknown unknowns / `sheets.py` finding | M | H | Use `..._JSON_FILE` path or base64-encode the key; verify auth on a staging deploy before cutover |
| Builder flips Nixpacks→Railpack on a redeploy, changing build behavior | Devil's advocate | M | M | Pin the builder explicitly in `railway.json`/`railway.toml`; re-run `/verify` after any redeploy |
| uvicorn bound to hardcoded `8901` instead of `$PORT` → health checks fail | Unknown unknowns | M | M | Start command uses `--host 0.0.0.0 --port $PORT`; keep it in the Procfile/`railway.toml` |
| App-sleeping (if enabled) causes a 502/cold start during a real order | Unknown unknowns / Pre-mortem | L | H | Leave app-sleeping OFF for the pilot; if enabled later, set `min` running ≥1 |
| Preview deploy writes to the real Sheet/DB | Unknown unknowns | M | H | Per-environment env vars; rely on the regression suite's back-out-on-submit; never point a preview at prod data |
| Usage-based billing exceeds the Hobby credit unnoticed (memory creep / spike) | Devil's advocate / Pre-mortem | L | M | Set Railway usage alerts; watch RAM on the long-lived uvicorn process |
| "It deployed" ≠ "it's operable" — no rollback rehearsal | Pre-mortem | M | H | Rehearse `railway redeploy`/rollback and a secrets-parsing smoke test before the first production order |
| No PL data-residency region | Devil's advocate | L | L | Amsterdam (EU-West) is acceptable for the pilot; revisit only if a residency requirement appears |
| Re-platforming a live system introduces regressions | Research finding (brownfield) | M | H | **Default: stay on the droplet**; take the Railway upgrade only on a Decision Trigger, between pilot cycles, with `/verify` + prod smoke green |
| Droplet ops failure (kernel CVE, disk full, silent TLS-renewal fail) — you are the on-call; an agent can't fix a wedged box | Devil's advocate (droplet) | L | H | Basic monitoring + automatic security updates; if this bites, that's Decision Trigger #2 → take the Railway upgrade |

## Getting Started

**The droplet is the default — there is no action to take now.** The steps below are the **Railway upgrade runbook**, to run *only if* one of the Decision Triggers fires (frontend stays on Vercel throughout). Validated against the stack's actual shape (Procfile-honored, `$PORT`, file-based service-account secret).

1. **Install + auth the CLI:** `npm i -g @railway/cli` (or `brew install railway`), then `railway login`.
2. **Create/link the service:** from `supply-os-v1/`, `railway init` (new project) or `railway link` (existing). Pin the builder in `railway.toml` to avoid Nixpacks↔Railpack churn; keep the existing `Procfile` (`web: uvicorn app.main:app`) — Railway honors it — but ensure the start command binds `--host 0.0.0.0 --port $PORT`.
3. **Set secrets the safe way:** `railway variables --set SUPPLY_OS_DATA_BACKEND=sheet`, the captain/manager tokens, and the Google credentials via the **file path** variable (`SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE`) or a base64-encoded inline value — never paste raw multi-line JSON. Add `SUPPLY_OS_GOOGLE_SHEET_ID`.
4. **Deploy + verify:** `railway up`, then `railway logs` to confirm a clean boot; hit `/health`. Run a **staging** captain submit that backs out (no real order) to prove Sheets auth works under Railway's env handling.
5. **Cut over the proxy:** point `frontend/vercel.json`'s `/api/*` rewrite at the Railway URL, redeploy the frontend, run the prod smoke / `/verify`, and **rehearse a rollback** (`railway redeploy` / `railway down`) before the first real Bukat order. Keep the droplet warm until a full pilot cycle passes green.

## Stack Element Assessments (beyond hosting)

The same decision lens (5 agent-friendly criteria → research → anti-bias → recommend) applied to every infra/integration element, doubting each. **Trigger context:** the owner now expects **company-wide rollout in ~2–3 weeks** (the PRD frontmatter said "small pilot"). That elevates the datastore, CI, and monitoring from "later" to **urgent**, and lights the backend-host "scale arrives" trigger (see note at end).

### Datastore — MIGRATE Google Sheets → Supabase (Postgres)

**Decision: migrate transactional order data off Google Sheets to Supabase (managed Postgres), behind the existing `_choose_backend()` seam. Runner-up: Neon. This is now urgent, not "later."**

**Why the status quo breaks at scale.** Google Sheets as system-of-record fails under concurrent multi-location writes: one service account = **one API "user" = a shared 60-write/min ceiling**; Sheets has **no transactions and no row locks**; the TOCTOU race windows the code already documents as a "v0 trade-off" (captain-edit vs manager-dispatch, the non-transactional append-order→append-lines torn write, double-claim/double-dispatch) **get strictly worse** with concurrency; quota-exceed returns user-facing 429s (the code retries reads once, writes never). Threshold where it breaks: **~3–5 simultaneous locations** — below the imminent company-wide scale. Google also begins metering Sheets API usage in 2026. Sheets stays genuinely good at exactly one thing worth preserving: the owner editing master data in a familiar grid.

**The model is relational → Postgres** (NoSQL ruled out — a document store forfeits the joins/FK/transactions the migration exists to gain). Scoring the Postgres hosts:

| Host | CLI | Managed | Docs | Migrate API | MCP | Edit UI | Marginal cost | Verdict |
|---|---|---|---|---|---|---|---|---|
| **Supabase** | Pass | Pass | Pass (`llms.txt`) | Pass | Pass | **Table Editor (grid + CSV)** | **~$0 (Pro owned)** | **#1** |
| **Neon** | Pass | Pass | Pass (`llms.txt`) | Pass (+ DB branching) | Pass (GA) | ✗ raw PG, no grid | ~$5–19/mo new | #2 |
| Railway PG | Pass | Partial (single instance = unmanaged template; HA via Patroni) | Partial | Pass | ✗ no DB MCP | ✗ | in-plan | only once backend→Railway (co-locate) |
| Self-host (droplet) | ~ psql | ✗ raw | ~ | ✗ own scripts | ✗ | ✗ | ~$0 | stopgap; **not** for company-wide |
| Keep Sheets | ~ | ✗ | — | ~ | ✗ | ✓ native grid | $0 | ✗ breaks at concurrent scale |

**Why Supabase wins.** The deciding factor is the *"don't know yet"* answer on master-data editing: Supabase's **Table Editor preserves a spreadsheet-like grid** (+ CSV/XLSX import), so migrating doesn't force building/learning an admin UI under time pressure — Neon (raw Postgres) would. Plus it's already paid (~$0 marginal; "weigh Supabase if close"), 5/5 agent-friendly (stable MCP with `execute_sql`/`apply_migration`/`list_tables`, `supabase` CLI, `llms.txt`), and a **~1–2 day** port behind `_choose_backend()` (`delete_order_lines` → a one-line `DELETE`; the seam was designed for exactly this swap). **Neon** is the runner-up — pick only if the grid UI doesn't matter or DB-branching previews are wanted. **Railway PG** re-enters only when/if the backend lands on Railway (then co-locate, one bill, private network).

**Anti-bias cross-check (Supabase):**
- *Devil's advocate:* (1) **Pooler footgun** — Supavisor transaction-vs-session mode + asyncpg prepared-statement caching, misconfigured, throws cryptic errors under exactly the concurrent load you can't afford mid-rollout (session-on-6543 removed Feb 2025; a long-lived uvicorn on the droplet wants **direct/session 5432**, a later serverless/Railway move wants **transaction 6543**). (2) **No Warsaw region** — Frankfurt closest (DE residency, not PL). (3) **Two big changes at once** (DB migration *and* company-wide) is the dominant risk. (4) Table Editor is grid + CSV, **not spreadsheet formulas** — if the owner leans on formulas, expect surprise. (5) Lock-in creep if Auth/Storage/RLS get adopted — stay on plain Postgres behind the seam to keep Neon/RDS portability.
- *Pre-mortem:* cut over to Supabase the Friday before the first multi-location Monday; asyncpg-on-pooler choked on prepared statements under real concurrency (invisible in single-user staging); the owner couldn't find their Sheet formula in the Table Editor; because DB *and* rollout changed together nobody could localize the incident, and rollback meant un-cutting the data layer mid-rollout. → **Mitigation: sequence (below) + a hard staging rehearsal with pooler mode nailed.**
- *Unknown unknowns:* the SQL backend must consciously **drop** the now-unnecessary Sheets-era race guards (real transactions replace `invalidate→reread→409`) — not purely additive; the **backfill must preserve the per-line audit columns** (suggested/captain/manager/reason/actor/time — the PRD's learning asset) or it silently destroys history; the free tier pauses after 1 week (irrelevant on Pro, but a free *staging* project will pause).

### Email dispatch — keep Gmail human-send + add an audit log (hybrid)

**Decision: keep the Gmail compose-URL human-send model; add a server-side audit log of the exact dispatched content.** The compose-URL is inherently human-in-the-loop (honors the governing "never auto-order; a human always commits" rule), sends from a real mailbox (good deliverability, supplier sees a person), and is free. The one gap — *no record of what was actually sent* — is closed by persisting the rendered email body + recipients to the order on dispatch, which also satisfies the PRD's "every dispatched line inspectable later." Only revisit a **Resend**-backed "Send now" button (best Python SDK + GA MCP) **if** long orders start hitting Gmail's ~2k-char body truncation. Do **not** adopt a transactional email vendor now — it risks the never-auto-order rule and adds SPF/DKIM/DMARC setup under time pressure.

### Error tracking / monitoring — PostHog (already paid), not a separate Sentry

**Decision: enable PostHog error tracking for FastAPI + React.** PostHog's native error tracking went **GA 2026-01-30**, captures backend + frontend exceptions, links them to **session replay**, and you already pay for PostHog (one fewer vendor). Sentry is more mature for deep/distributed tracing but isn't worth a second tool at this scale. Add it **now** — going multi-location means real users hitting real bugs you currently cannot see (today: logs only + a client-side ErrorBoundary). Revisit Sentry only if deep distributed tracing becomes a need.

### CI/CD — GitHub Actions + a real product workflow

**Decision: stay on GitHub Actions (already the repo host, GA GitHub MCP); add ONE product workflow.** Today's `quality-gate.yml` tests sibling monorepo tooling, **not** this product — so without this, you'd ship to many locations with zero product coverage. Minimal jobs:
- **backend** — `ruff check .` + `python -m pytest` (196 tests)
- **frontend** — `npm ci` + `tsc --noEmit` + `eslint` + `vite build` (and add **vitest** so UI changes are verifiable — no frontend runner exists today)

This is **urgent** before the rollout; it gates exactly the four checks `/verify` runs locally.

### Secrets — no change (and the migration removes a footgun)

Current env / `EnvironmentFile` / file-based service-account handling is fine at this scale. Adding Supabase is one more secret (a Postgres connection string), kept in the same mechanism (off-repo `.env`, committed `.env.example`). Note the Sheets→Supabase move **incidentally removes** the documented inline-JSON `\n`-corruption footgun (a connection string isn't multiline JSON). Revisit a managed vault only at the Railway upgrade or if secret sprawl grows.

### Settled — no change

- **Analytics:** PostHog (now also doubling as error tracking — a consolidation win).
- **DNS / TLS:** Caddy automatic-HTTPS on the droplet + Vercel-managed for the frontend.

## Rollout Sequencing — sequence, don't stack

The infra *can* be ready in the window, but the PRD's gated rollout exists precisely to avoid changing the datastore *and* going multi-location at once (the pre-mortem above). Recommended order:

1. **Before any new location:** migrate to Supabase **+** add product CI **+** wire PostHog error tracking, then run the *existing* Wola×Bukat pilot on the new stack until it's boring (even a few days) — proves the data layer + concurrency under real-but-single-location load.
2. **Then:** add locations in the PRD's gated steps, watching PostHog errors + Supabase load at each step.
3. **In parallel (low-risk):** the email audit-log change.
4. **Watch the host trigger:** if step 2 reveals droplet ops strain, take the Railway upgrade and then co-locate Railway Postgres.

Going straight to company-wide *while* cutting over the datastore is the one path to push back on.

## Backend-host note — the "scale arrives" trigger is now lit

The locked host decision (droplet default · Railway = triggered upgrade) was made assuming scale was distant. The owner's "company-wide in ~2–3 weeks" **is** Decision Trigger #1. The lock stands as decided, but its premise changed — so the Railway upgrade should be treated as *near-term and likely*, not hypothetical, and re-evaluated as the rollout sequence (above) progresses.

## Out of Scope

Still not evaluated here (these are implementation/build tasks, not platform decisions):
- The actual **migration code** (schema DDL, data backfill, the new Supabase backend module) and the CI **workflow YAML** — implementation, tracked for `/10x-implement`.
- Docker image / Dockerfile authoring (only relevant if Fly.io is ever chosen for the backend).
- Production-scale architecture (multi-region, HA/DR, read replicas) — beyond the current rollout horizon.
- Replacing the two-token auth with Supabase Auth — a product decision, deliberately deferred (PRD non-goal for v0).
