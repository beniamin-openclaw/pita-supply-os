---
artifact: deployment-plan
lesson: m1l5 — From Localhost to Production
created: 2026-06-04
scope: full hybrid — Vercel (frontend) + backend (droplet default · Railway upgrade)
source_of_truth: context/foundation/infrastructure.md
status: plan (no production change executed by this document)
---

# Deployment Plan — Pita Supply OS

> Built from `context/foundation/infrastructure.md` (the platform decision contract) per the m1l5 lesson prompts. This is a **plan**, not an execution log — completing the lesson does **not** change production. Real (re)deploys, secret provisioning, and domain changes are gated separately.

## §0 Context & scope

**Brownfield — already in production.** This plan *codifies* the existing hybrid deploy and *closes its gaps*; it is not a from-zero first deploy.

- **Frontend:** React/Vite SPA → **Vercel** (`pita-supply-os.vercel.app`, project `pita-supply-os` / `prj_cwgfVlDn8cKl1J2q8fVHEysu1B8Z`).
- **Backend:** FastAPI/uvicorn → **DigitalOcean droplet** `46.101.213.61` behind **Caddy** (TLS) → systemd `jarvis-supply-os.service` on `172.18.0.1:8001`; public host `supply.46-101-213-61.nip.io`.
- **Data:** `seed`/`sheet` behind `_choose_backend()` today; **Supabase (Postgres) migration is urgent** but is *implementation*, cross-referenced in §5, not executed here.

**Decision basis (`infrastructure.md`):** droplet = **default** backend host; Railway = **triggered upgrade**; Vercel = settled frontend. The "scale arrives" trigger is **now near** (owner expects company-wide in ~2–3 weeks).

**Reference docs (do not duplicate):** `docs/pita-supply-os-v1/DROPLET_DEPLOY_RUNBOOK.md` (full droplet runbook), `ADR-001-hybrid-hosting.md` (why hybrid), `PRE_DEPLOY_REVIEW.md` (blockers/findings), `RESUME_STATE_2026-06-02.md` (live status).

---

## §1 Phase 1 — Frontend (Vercel) · platform-managed auto-deploy on `main`

Vercel's native Git integration is the deploy mechanism — **no external CI/CD deploy step** (see §6).

- [ ] **Connect the Vercel project to the *new* repo.** Confirm project `pita-supply-os` is linked to GitHub **`beniamin-openclaw/pita-supply-os`** (it was previously on the old `jarvis-codex` repo). Vercel → Project → Settings → Git → connect repo, production branch = `main`.
- [ ] **Verify auto-deploy behavior:** push to `main` → production deploy; every PR/branch → preview URL. No manual `vercel --prod` needed in steady state.
- [ ] **Verify build settings:** Framework = Vite; Install = `npm install`; Build = `npm run build` (`tsc -b && vite build`); Output = `dist/`.
- [ ] **Verify API routing:** `frontend/vercel.json` rewrite `/(api/.*)` → `https://supply.46-101-213-61.nip.io/api/:path*` (the **single source of truth** for the backend host).
- [ ] **Confirm prod env:** production uses same-origin `/api/*`; `VITE_API_URL` is dev-only and must **not** be set in the Vercel project. Optional PostHog keys set as Vercel env vars if frontend analytics is enabled.
- [ ] **Smoke:** open `pita-supply-os.vercel.app`, confirm the SPA loads and routes (`/captain-v2`, `/manager-v2`).

---

## §2 Phase 2 — Backend (droplet, current default)

Deploy per `DROPLET_DEPLOY_RUNBOOK.md`. Summarized steps (the runbook is authoritative):

- [ ] **Get code onto the droplet from the new repo** — `git clone/pull https://github.com/beniamin-openclaw/pita-supply-os.git` (or rsync the `supply-os-v1/` worktree) into `/opt/pitabros/supply-os`.
- [ ] **Python env:** venv + `pip install -e .`; run `python -m pytest` on the box (or locally pre-transfer) to confirm green.
- [ ] **Config:** write `/opt/pitabros/supply-os/.env` (chmod 600, root-only) from `supply-os-v1/.env.example` with production values (tokens, `SUPPLY_OS_DATA_BACKEND`, Google creds, CORS).
- [ ] **Process:** `systemctl restart jarvis-supply-os` (systemd unit binds `172.18.0.1:8001`, 1 worker, `MemoryMax=250M`, auto-restart).
- [ ] **Proxy/TLS:** Caddy block for `supply.46-101-213-61.nip.io` → `172.18.0.1:8001`, automatic Let's Encrypt.
- [ ] **Smoke:** `curl https://supply.46-101-213-61.nip.io/health` → `{"status":"ok"}`.

> ⚠️ **Documented gap (prompt #2):** the droplet deploy is **manual** (clone/rsync + `systemctl restart`) — it does **not** satisfy "auto-deploy on `main` handled by the platform." This is the concrete operational reason the **Railway upgrade (§3)** exists. Until then, redeploys are a deliberate human step.

**Edge cases / external integrations to respect:**
- [ ] **Service-account JSON `\n` footgun:** prefer `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE` (a file, off-repo) or base64 — inline JSON with `\n` can corrupt via `EnvironmentFile` escaping (ADR-001 / `sheets.py`).
- [ ] **CORS:** `SUPPLY_OS_CORS_ALLOW_ORIGINS` must include the exact Vercel origin (`https://pita-supply-os.vercel.app`).
- [ ] **`/health` info-leak:** keep env/backend details on `/health/internal` (Manager-auth), public `/health` minimal (per PRE_DEPLOY_REVIEW).
- [ ] **RAM budget:** droplet is tight (~600 MB already in use); watch the first ordering cycle against `MemoryMax=250M`.
- [ ] **Auth required in prod:** `SUPPLY_OS_CAPTAIN_TOKENS` + `SUPPLY_OS_MANAGER_TOKEN` must be set (empty = auth disabled, dev-only).

---

## §3 Phase 3 — Backend auto-deploy upgrade path (Railway)

Execute **only when a Decision Trigger fires** (`infrastructure.md`); "scale arrives" is now near. This is the path that *closes* the §2 manual-deploy gap.

- [ ] **Connect repo → Railway**, production branch `main` → **auto-deploy on push** (satisfies prompt #2 for the backend). Railway honors the existing `Procfile` (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
- [ ] **Secrets:** `railway variables --set …` via `..._JSON_FILE`/base64 (same footgun); pin the builder (Nixpacks↔Railpack) in `railway.toml`.
- [ ] **Cut over the proxy:** point `frontend/vercel.json` `/api/*` rewrite at the Railway URL; redeploy frontend; run §7 smoke; **rehearse rollback** (`railway redeploy` / `down`) before the first real order. Keep the droplet warm one pilot cycle.
- [ ] **(Optional) co-locate Postgres** on Railway once the backend is there (else Supabase stays external — §5).

---

## §4 Prerequisites — CLI configuration (prompt #3)

- [ ] **Vercel CLI:** `npm i -g vercel` → `vercel login` → `vercel link` (to project `pita-supply-os`). Used for manual `vercel --prod`, `vercel rollback`, `vercel logs`, `vercel env`.
- [ ] **Droplet access:** SSH key authorized for `root@46.101.213.61`; `rsync` available; familiarity with `systemctl`/`journalctl -u jarvis-supply-os` and the Caddyfile path.
- [ ] **GitHub:** repo already pushed (`beniamin-openclaw/pita-supply-os`, branch `main`); `gh` auth in place. *(Agent-initiated pushes are blocked by the data-exfiltration guard — the human runs pushes.)*
- [ ] **(Upgrade) Railway CLI:** `npm i -g @railway/cli` → `railway login` → `railway link` — needed only when §3 is taken.

---

## §5 External integrations & edge cases

- **Google Sheets:** service-account auth; the `\n` inline-JSON footgun (§2). Sheet edits remain the owner's master-data surface until the Supabase cutover.
- **`nip.io` → real domain:** swapping off `supply.46-101-213-61.nip.io` is a 3-line change — one Caddyfile server block, one DNS A record, one `frontend/vercel.json` rewrite target.
- **Tokens:** provision Captain/Manager tokens in the droplet `.env`; **rotate** the two tokens exposed earlier (tracked in RESUME_STATE) before wider rollout.
- **PostHog:** analytics + (now) error tracking keys as env vars on both ends.
- **Cross-reference (separate work, NOT this plan — `/10x-implement`):** the urgent **Sheets → Supabase** migration and the **product CI** workflow from `infrastructure.md`. Sequencing rule still holds: migrate + add CI + wire monitoring **before** adding locations — don't stack a datastore cutover with the company-wide rollout.

---

## §6 Auto-deploy constraint (prompt #2, explicit)

| Surface | Auto-deploy on `main`? | Mechanism |
|---|---|---|
| **Frontend (Vercel)** | ✅ Yes | Native Vercel Git integration (push `main` → prod; PR → preview) |
| **Backend (droplet)** | ❌ No | Manual clone/rsync + `systemctl restart` — documented gap |
| **Backend (Railway, upgrade)** | ✅ Yes | Native Railway Git integration on `main` |

**CI never deploys.** GitHub Actions (to be added — `infrastructure.md`) runs **tests/gates only** (backend `ruff` + `pytest`; frontend `tsc --noEmit` + `eslint` + `vite build` + `vitest`). Deployment stays platform-native, not an external CI push.

---

## §7 Verification (smoke — safe data only)

> **Hard rule:** never place a real supplier order from a test. Use **submit-and-back-out** or safe test data.

- [ ] `curl https://supply.46-101-213-61.nip.io/health` → `200 {"status":"ok"}`.
- [ ] `pita-supply-os.vercel.app` loads; `/api/*` calls proxy through to the backend (network tab shows same-origin `/api/...` resolving).
- [ ] Captain login (token) → `/api/captain/orderable` returns lines.
- [ ] Manager login (token) → `/api/manager/queue` loads.
- [ ] One **submit-and-back-out** cycle end-to-end; confirm no real dispatch occurred.
- [ ] (If §3 taken) repeat all of the above against the Railway URL before flipping the rewrite.

---

## §8 Rollback

- **Frontend (Vercel):** `vercel rollback <deployment>` or promote a previous deployment in the dashboard (instant).
- **Backend (droplet):** check out the previous commit/release in `/opt/pitabros/supply-os` + `systemctl restart jarvis-supply-os`; Caddy/TLS unaffected.
- **Backend (Railway, upgrade):** `railway redeploy` (roll forward) / `railway down` (remove latest); config/secrets are **not** auto-reverted — re-apply if changed.
- **Proxy flip rollback:** if a Railway cutover misbehaves, revert the `frontend/vercel.json` `/api/*` rewrite back to the droplet host and redeploy frontend.

---

## Execution status & immediate actions (2026-06-07)

**Verified current state** (this is the *wiring gap*, not a plan gap — the plan above is complete):

- **Vercel is NOT yet on the new repo.** All 18 recent deployments of project `pita-supply-os` come from OLD branches (`claude/supply-os-manager-v2`, `claude/romantic-elbakyan-3d712b`, …). Pushing `main` (`029b082`, carrying S-02 + S-09) to `beniamin-openclaw/pita-supply-os` produced **no deployment** → Vercel's Git integration still points at the old repo. §1 connect-step is unstarted.
- **The backend redeploy is the one that matters right now.** S-09 (`RoundingRule.TENTH_KG`) is on `main` but not on the droplet. If the droplet runs `SUPPLY_OS_DATA_BACKEND=sheet`, prod currently **500s on every `supplier_products` read** (the live sheet carries `tenth_kg`) until the droplet is redeployed from `main`. If it runs `seed`, no crash — and the new seed already mirrors `tenth_kg`.
- **Agent constraint:** SSH to `root@46.101.213.61` is blocked for the agent (production remote-shell). Droplet steps are owner-run; prod secrets stay with the owner.

**Immediate ordered actions (owner-run):**

1. **Backend (fixes the tenth_kg drift) — FIRST.** Confirm the droplet's backend mode, then redeploy from the new repo:
   - `ssh root@46.101.213.61 'grep DATA_BACKEND /opt/pitabros/supply-os/.env'`
   - rsync `supply-os-v1/` from this repo → `/opt/pitabros/supply-os/`, then `.venv/bin/pip install -e . && systemctl restart jarvis-supply-os` (see §2 / runbook).
   - Smoke: `curl https://supply.46-101-213-61.nip.io/health`, then a Manager-token `/api/manager/queue`.
2. **Frontend (Vercel) — establish auto-deploy.** Vercel → project `pita-supply-os` → Settings → Git → connect `beniamin-openclaw/pita-supply-os`, production branch `main` (§1). Then a push to `main` auto-deploys; verify a fresh deployment appears with a `main` SHA. (One-off alternative: `vercel --prod` from `frontend/`.)
3. **CORS:** ensure the droplet `.env` `SUPPLY_OS_CORS_ALLOW_ORIGINS` includes the live Vercel origin.

Once #1 lands, the tenth_kg prod-risk is closed; #2 makes future `main` pushes auto-deploy the frontend (closing the "re-pointing pending" gap from the repo guide).

---

## Out of scope (not this lesson)

- Executing an actual (re)deploy, re-pointing Vercel/droplet for real, provisioning/rotating secrets — gated real-world actions.
- The Supabase migration code, product CI YAML, token rotation — `/10x-implement` and follow-ups.
- Production-scale architecture (multi-region, HA/DR).
