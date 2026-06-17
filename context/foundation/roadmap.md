---
project: "Pita Supply OS"
version: 1
status: draft
created: 2026-06-04
updated: 2026-06-17
prd_version: 2
main_goal: market-feedback
top_blocker: decisions
---

# Roadmap: Pita Supply OS

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Pita Supply OS is the single structured path from a location's stock counts to supplier dispatch: a Captain enters current stock and a suggestion (with visible math) proposes purchase quantities; a Manager reviews, adjusts, sends back, or dispatches — replacing a 30–60 min manual scramble across portals/Excel/GoStock/email where the decision "why" lived only in WhatsApp. v0 is already shipped; this change moves the live pilot from Pago to **Bukat** with **email** dispatch, to prove the two-role Captain→Manager flow end-to-end on one real supplier before a gated rollout (more suppliers → +2 locations → company-wide). The engine only ever *suggests*; the Captain and Manager always commit, and per-line history (suggested / captain / manager / reason) is the learning asset.

## North star

**S-02: Manager dispatches the Wola×Bukat order by email** — the terminal proof of the governing rule (one path from cooler to supplier): a real Bukat order leaves the system as a ready-to-send email draft, in correct purchase units, after the Captain's stock-based submission flowed through the queue. This is the validation milestone for `main_goal: market-feedback` — the moment the two-role pilot is proven on one real supplier.

> "North star" here means the smallest end-to-end, user-visible flow whose successful delivery would prove the product's core hypothesis — placed as early as its Prerequisites allow, because everything else only matters once this works. S-02 sits behind exactly two enablers (the Bukat master-data foundation F-01 and the Captain submit S-01); it is sequenced as early as that chain permits, not deferred for symmetry.

## At a glance

| ID   | Change ID                     | Outcome (user can …)                                                              | Prerequisites | PRD refs                                      | Status   |
| ---- | ----------------------------- | --------------------------------------------------------------------------------- | ------------- | --------------------------------------------- | -------- |
| F-01 | bukat-master-data-ready       | (foundation) Bukat master data verified + corrected at Wola so suggestions hold   | —             | FR-012, US-01                                 | done     |
| S-01 | captain-bukat-submit          | Captain selects Bukat, enters stock, sees suggestion math, submits to the queue   | F-01          | US-01, FR-001, FR-002, FR-003, FR-004, FR-005 | done     |
| S-02 | manager-bukat-email-dispatch  | Manager claims, edits/sends-back, dispatches the Bukat order by email             | S-01          | US-01, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011 | done     |
| S-03 | bukat-suggestion-learning-loop| Owner validates Bukat suggestions vs per-line history and corrects master data    | S-02          | FR-012                                        | done     |
| S-04 | channel-aware-dispatch        | Manager dispatches additional suppliers via portal / phone / manual               | S-02          | FR-013                                        | done     |
| S-05 | manager-queue-filters         | Manager filters/narrows the queue by supplier / location / status                 | —             | FR-014                                        | done     |
| S-06 | inventory-count               | Captain counts all location products in one pass → dated snapshot                 | —             | US-02, FR-015, FR-016                         | done     |
| S-07 | order-prefill-from-inventory  | Order screen offers opt-in pre-fill of stock from the latest inventory snapshot   | S-06          | US-02, FR-017                                 | done     |
| S-08 | inventory-manager-view        | (Phase 2) Manager views inventories; Owner browses inventory history/trends       | S-06          | FR-018, FR-019                                | done     |

> **Milestone — PRD v2 complete (2026-06-09).** All requirements FR-001…FR-024 are shipped across 14 archived changes; the north star (S-02, Wola×Bukat email dispatch) is proven. Horizon 1 (the PRD) is done. The roadmap now enters **Horizon 2 — Rollout Enablement** (Supabase migration, multi-supplier master data, deploy wiring, and the in-store full-run demo) — see the section below. Execution guidance for the next slices is in **## 10x Execution Playbook**.

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                  | Chain                                  | Note                                                                                          |
| ------ | ---------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| A      | Bukat pilot round-trip | `F-01` → `S-01` → `S-02` → `S-03`      | The market-feedback critical path; north star `S-02` sits as early as the F-01 data prep allows. |
| B      | Week-2 scale-up        | `S-05` · `S-04` (parallel, joins A at `S-02`) | Plannable independently of the Bukat-data blocker; FR-014 gates multi-supplier/location growth. |
| C      | Location inventory     | `S-06` → `S-07` · `S-08` (Phase 2, parallel) | Parallel early track, independent of the north star — counts feed ordering via opt-in pre-fill. `S-06` is `ready` now. |

## Baseline

What's already in place in the codebase as of `2026-06-04` (auto-researched + reviewed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — React 19 + Vite 7 + TypeScript + react-router 7 + Tailwind; Captain / Manager / Orders pages, role-gated `AuthGate` (`frontend/src/App.tsx`). No test runner yet.
- **Backend / API:** present — FastAPI + uvicorn; full captain + manager route set (`supply-os-v1/app/main.py`); `Procfile`.
- **Data:** partial — Google Sheets (gspread) + seed CSV behind `_choose_backend()` (`app/sheets.py`, `app/main.py`). Orders/order_lines persist **only** in `sheet` mode; seed mode is in-memory. No Postgres/Supabase.
- **Auth:** present — two-token bearer (`require_captain` / `require_manager` / `require_any_auth`, `app/auth.py`); frontend `AuthGate` validates before rendering protected routes.
- **Deploy / infra:** partial — Vercel (frontend; `vercel.json` rewrites `/api/*` to the droplet) + DigitalOcean droplet / Caddy / systemd backend (`Procfile`). **No `.github/workflows` CI runs the product** (no pytest / ruff / build gate).
- **Observability:** absent — PostHog key present in `config.py` but no client wired; no Sentry; stdlib `logging` only.

> **Since baseline (updates as of 2026-06-09):** product CI now runs on every push/PR (`.github/workflows/ci.yml` — backend ruff+pytest, frontend build+lint+vitest); a **frontend test runner (Vitest)** is wired in; the backend suite has grown from 196 to **281 tests**. These close the two HIGH `health-check.md` gaps (CI coverage + FE test runner). Still open: backend lockfile, TS `strict`, mypy/pyright (tracked as **H-01**). Observability remains unwired; data is still Google Sheets (S-10 migrates it).

> **Backend host migrated to Railway (2026-06-15, change `deploy-pipeline-repair`):** the FastAPI backend now runs on **Railway**, auto-deploying from `main` (GitHub-connected; Root Directory `supply-os-v1`, Railpack builder, base64 service-account creds, `/health` healthcheck). This supersedes the DigitalOcean droplet, whose deploy was a flat rsync copy disconnected from git (D-01's documented gap — `git push` did not deploy). Google Sheets stays the datastore behind `_choose_backend()`; only the host changed (datastore → Supabase is sequenced separately as **S-10**). Vercel still serves the frontend and rewrites `/api/*` — now to the Railway URL. Owner runbook: `docs/pita-supply-os-v1/RAILWAY_DEPLOY_RUNBOOK.md`. Droplet left intact as a cold fallback (currently not serving).

> **WZ photos + goods receiving live (2026-06-16):** Captain goods receiving (GR-01 — confirm a dispatched delivery, ordered-vs-received variance) and **WZ delivery-note photos** are both in production. Photos now upload to a **private Supabase Storage bucket** (signed URLs; `wz-photos-supabase-storage`, archived `context/archive/2026-06-16-wz-photos-supabase-storage/`); the Google Drive path (service-account storage-quota dead-end) was removed. **This is Supabase _Storage_ (files) only — distinct from S-10**, the transactional datastore migration (orders/inventory → Postgres), which is still `proposed`. Also shipped 2026-06-16: **`manager-queue-ux`** — three Manager/Captain queue UX bugfixes (readable API errors instead of "[object Object]"; no false strikethrough on claim; newest-first queue + ~20s freshness), archived `context/archive/2026-06-16-manager-queue-ux/`. Neither GR-01 nor these bugfixes is a formal roadmap slice (built outside the PRD slice structure); recorded here as a baseline note, mirroring how the Railway migration is tracked.

## Foundations

### F-01: Bukat master data ready

- **Outcome:** (foundation) Bukat products, supplier_products (units-per-purchase-unit, rounding rule, price), and Wola location_product_settings (min/target/max, critical flags) are verified and corrected so the suggestion engine is trustworthy for the pilot SKUs.
- **Change ID:** bukat-master-data-ready
- **PRD refs:** FR-012, US-01 (Given: "Bukat products configured in master data")
- **Unlocks:** S-01 (captain-bukat-submit); reduces Open Roadmap Question 2 (Bukat master-data readiness).
- **Prerequisites:** —
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:**
  - Is Bukat master data ready for week 1, or does it need a prep pass before the Captain pilot? — Owner: owner/Beniamin. Block: yes. **Resolved (2026-06-05): prep pass completed — Open Roadmap Question 2 closed.**
- **Risk:** Sequenced first because the entire pilot's suggestion correctness — and the kg-vs-cartons "unit pain" the PRD calls out — rides on this data; shipping S-01 against wrong master data would validate nothing. Data-only prep (Sheet edits / corrections), no code change; minimal enabler, not a data-layer rebuild.
- **Status:** done

## Slices

### S-01: Captain submits a Bukat order with visible suggestion math

- **Outcome:** Captain logs in, selects supplier **Bukat**, sees the Wola product lines for that supplier, enters current stock, reviews the suggestion math, sets the final purchase quantity (with a reason where deviation rules apply), and submits — the order appears on the Manager queue the same business day.
- **Change ID:** captain-bukat-submit
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004, FR-005
- **Prerequisites:** F-01
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** — (the capability is present in the baseline; the only open item is master-data readiness, owned by F-01)
- **Risk:** Largely validation of existing capability against Bukat data; sequenced after F-01 because submitting against unverified master data produces misleading suggestions. The visible-math contract is Tier-1 (must not regress). No real supplier order is placed by submit.
- **Status:** done

### S-02: Manager dispatches the Bukat order by email

- **Outcome:** Manager logs in, sees the submitted Bukat order in the queue, claims it ("Przejmij"), edits line quantities/comments and saves or sends it back ("Odrzuć do poprawy"), then dispatches — producing a ready-to-send Gmail draft carrying the Bukat line quantities in purchase units. Per-line history (suggested / captain / manager / reason) is recorded.
- **Change ID:** manager-bukat-email-dispatch
- **PRD refs:** US-01, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** — (operationally, *who* holds the Manager token at Wola is a go-live gate, tracked in Open Roadmap Question 1; it does not block planning this slice)
- **Risk:** The terminal proof of the governing rule and the roadmap's north star. **Hard rule: pilot tests must back out on submit / use safe data — never place a real Bukat order from a test.** Email-channel dispatch and the Gmail-URL build are present; the residual risk is operational (right recipient, right purchase units), not build.
- **Status:** done

### S-03: Owner validates Bukat suggestions and corrects master data (learning loop)

- **Outcome:** Once dispatched orders accumulate per-line history, the owner reviews the suggested-vs-captain-vs-manager deltas and reason codes, confirms suggestion quality, and corrects Bukat master data where the engine was wrong — closing the learning loop (confirming the suggestions were right, and fixing the data where they weren't), per Success Criterion 3.
- **Change ID:** bukat-suggestion-learning-loop
- **PRD refs:** FR-012
- **Prerequisites:** S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Depends on real pilot data (S-02 dispatched orders); thin as a build (it reads the present per-line history and edits the Sheet), but it is the must-have learning loop that makes the engine trustworthy before scale. Frame as master-data correction, not operator blame (the blame-culture risk flagged on FR-011).
- **Status:** done

### S-04: Channel-aware dispatch for additional suppliers

- **Outcome:** Manager dispatches non-email suppliers via the correct channel (portal / phone / manual), recording the state transition and sent_method without an email artifact.
- **Change ID:** channel-aware-dispatch
- **PRD refs:** FR-013
- **Prerequisites:** S-02
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Week-2 scope (must-have by week 2). The dispatch endpoint already branches on `supplier.ordering_method`; the work is per-channel UX + recording. Gated behind the pilot proving the email channel first, so it is not the riskiest-assumption slice.
- **Status:** done (already shipped in Manager V2 G3 — see ## Done; reconciled 2026-06-08)

### S-05: Manager filters/narrows the order queue

- **Outcome:** Manager narrows the queue by supplier, location, and status so it stays usable as order volume grows beyond a single Wola×Bukat stream.
- **Change ID:** manager-queue-filters
- **PRD refs:** FR-014
- **Prerequisites:** — (extends the present Manager queue from the baseline)
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The FR-006 resolution requires FR-014 *before* multi-supplier/location scale. Plannable now because it only extends the present queue and carries no blocking unknown — the smallest independent slice, a safe parallel track while the pilot path is gated on Open Roadmap Question 2.
- **Status:** done

### S-06: Captain counts the whole location → dated snapshot

- **Outcome:** Captain opens a location-wide inventory screen (all Wola products with a `location_product_setting`), enters current stock in one pass, and approves — persisting a **dated snapshot** (timestamp + actor); prior snapshots retained.
- **Change ID:** inventory-count
- **PRD refs:** US-02, FR-015, FR-016
- **Prerequisites:** — (operates on the present location product set)
- **Parallel with:** S-05, and the entire Bukat pilot (F-01 / S-01 / S-02 / S-03)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Independent of the Bukat-master-data blocker AND of the north star — a true parallel early track (the user's "one of the first slices"). Introduces the inventory data entities (`inventory_counts` / `inventory_count_lines`) behind `_choose_backend()`, mirroring orders/order_lines; the pilot's data store and dispatch are untouched. NFR: no entered count lost mid-pass.
- **Status:** done

### S-07: Order screen pre-fills stock from an inventory snapshot

- **Outcome:** When starting a per-supplier order, the Captain is offered an opt-in pre-fill of `current_stock` from the latest snapshot — the confirmation names the snapshot's date/time; values are editable and ordering works without it.
- **Change ID:** order-prefill-from-inventory
- **PRD refs:** US-02, FR-017
- **Prerequisites:** S-06 (needs snapshots; the per-supplier order screen is present in the baseline)
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Connects the inventory track to ordering. Double-safeguard required (opt-in + named source snapshot) so a stale count can't silently enter an order. Must not regress the existing manual-entry order flow (Tier-1).
- **Status:** done (archived 2026-06-08 → `context/archive/2026-06-08-order-prefill-from-inventory/`)

### S-08: Manager inventory view + history/trends (Phase 2)

- **Outcome:** Manager views submitted inventory counts; Captain/Owner browse inventory history/trends over time.
- **Change ID:** inventory-manager-view
- **PRD refs:** FR-018, FR-019
- **Prerequisites:** S-06
- **Parallel with:** S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Phase 2 (should-have) — demoted via Socratic challenge: the Manager already sees stock embedded in the order, and snapshots persist regardless, so these consumption surfaces pay off at audit / multi-supplier scale, not on the pilot. Deferred past the must-have core.
- **Status:** done

## Horizon 2 — Rollout Enablement

Horizon 1 delivered the full PRD on the pilot stack (Google Sheets, single Wola×Bukat supplier). Horizon 2 is the bridge from "pilot proven" to "running in the store across suppliers, ready for the gated multi-location rollout." It is **not** new PRD scope — it is the infrastructure + data + operational work that `infrastructure.md` and the four Open Roadmap Questions already flagged as the scale gate. The driving milestone is **M-01: an in-store full-run demo across multiple real suppliers on the production stack.**

**Sequencing rule (from `infrastructure.md`, do not violate):** migrate the data layer and prove it on the single-location pilot until it is boring **before** adding suppliers/locations. Don't stack two big changes (a datastore cutover and a scale-up) in the same step.

### At a glance — Horizon 2

| ID   | Change ID                   | Outcome (user/owner can …)                                                           | Prerequisites    | Refs                            | Status    |
| ---- | --------------------------- | ------------------------------------------------------------------------------------ | ---------------- | ------------------------------- | --------- |
| D-01 | deploy-wiring               | (owner-run) Auto-deploy `main`: Vercel re-pointed to the new repo; backend redeployed | —                | `deployment-plan.md`, infra Q3  | done |
| S-10 | supabase-backend            | Order + inventory data runs on Supabase (Postgres) behind `_choose_backend()`        | —                | `infrastructure.md`, PRD Open Q3 | done      |
| F-02 | multi-supplier-master-data  | (foundation) Master data verified for suppliers beyond Bukat (Pago + others)         | —                | FR-012, FR-013                  | done      |
| H-01 | quality-hardening           | Backend lockfile + TS strict + mypy/pyright + thicker ruff — reproducible, type-safe  | —                | `health-check.md` #3/#4/#5/#6   | proposed  |
| M-01 | in-store-demo (milestone)   | Full Captain→Manager→dispatch run in the store, multi-supplier, on the prod stack     | S-10, F-02, D-01 | governing rule; rollout gate    | milestone |

### D-01: Deploy wiring (auto-deploy on `main`)

- **Outcome:** Pushing `main` deploys — Vercel's Git integration re-pointed from the old repo to `beniamin-openclaw/pita-supply-os` (frontend auto-deploy + PR previews), and the droplet backend redeployed to current `main` (closes the S-09 `tenth_kg` drift that is on `main` but not yet on the droplet). Codified in `context/changes/deployment/deployment-plan.md` (§1/§2).
- **Change ID:** deploy-wiring (documentation already exists — `deployment-plan.md`)
- **Prerequisites:** —
- **Owner-run:** SSH to the droplet and Vercel Git settings are owner actions (agent SSH is blocked). The agent prepares; the owner executes.
- **Risk:** Pure ops, no product code. Hard rule: secrets (`sa.json`, `.env`, Supabase keys) stay off-repo (Lesson 3). Smoke = `/health` + submit-and-back-out, never a real order.
- **Status:** done (2026-06-09) — §1 Vercel Git integration re-pointed to `beniamin-openclaw/pita-supply-os`, production branch `main`, auto-deploy confirmed. §2 backend droplet updated via `git remote add origin` + `git reset --hard origin/main` + `pip install -e .` + `systemctl restart jarvis-supply-os`; smoke `/health` → `{"status":"ok"}`. S-09 `tenth_kg` drift closed. Production stack fully on `main@7b5f2c0`.
  - **Superseded (2026-06-15) — backend host migrated to Railway (`deploy-pipeline-repair`).** D-01's §2 backend mechanism was effectively incomplete: the running droplet backend was a flat rsync copy of `app/` disconnected from the git checkout, so `git push` / `git reset` did **not** deploy (GR-01 went live only after a manual rsync+restart). The repair migrates the backend host to **Railway with real auto-deploy from `main`** (GitHub-connected, Root Directory `supply-os-v1`, Railpack, base64 SA creds, `/health` healthcheck). Frontend `vercel.json` `/api/*` rewrite now points at the Railway URL; Sheets stays the datastore (host-only migration — Supabase is **S-10**, sequenced separately). Runbook: `docs/pita-supply-os-v1/RAILWAY_DEPLOY_RUNBOOK.md`. Droplet stopped serving (HTTPS down) and is left intact as a cold fallback; a clean `systemctl stop/disable` is the only remaining owner cleanup.

### S-10: Supabase data backend behind `_choose_backend()`

- **Outcome:** A new backend module (e.g. `app/supabase_backend.py`) implements the same function set as `app/sheets.py` (`load_*`, `append_order`, `append_order_lines`, `update_order`, `update_order_lines`, `get_order`, `delete_order_lines`, plus the inventory-count set) and registers in `_choose_backend()`. Transactional order + inventory data moves off Google Sheets onto Supabase (managed Postgres), gaining real transactions and row locks — closing the TOCTOU race windows the code documents as "v0 trade-offs" (captain-edit vs manager-dispatch, the non-transactional append torn write, double-claim/double-dispatch) — and lifting the shared 60-write/min Sheets ceiling.
- **Change ID:** supabase-backend
- **Refs:** `infrastructure.md` (decision: Supabase, runner-up Neon; ~1–2 day port); `stack-assessment.md` (`datastore: Supabase`); PRD Open Question 3 (scale gate).
- **Prerequisites:** — (the seam already exists). Recommended to land + bake on the single-location pilot **before** F-02 data goes live and **before** any new location.
- **Risk:** The highest-stakes change remaining — it touches every persistence path. **Lesson 2 is load-bearing: never bypass `_choose_backend()`; the new backend registers there, routes never import it.** Documented footguns (`infrastructure.md`): the Supavisor transaction-vs-session pooler + asyncpg prepared-statement caching, misconfigured, fail under exactly the concurrency you can't afford mid-rollout — a long-lived uvicorn wants direct/session port 5432, not the 6543 pooler (session-on-6543 removed Feb 2025). Secrets (connection string, service key) off-repo (Lesson 3); the new backend needs its env set in `conftest.py`, not per-file (Lesson 6); keep migration and scale-up in separate steps.
- **Status:** done

### F-02: Multi-supplier master data ready

- **Outcome:** (foundation) Master data for the suppliers beyond Bukat (Pago + the rest used in the store) — products, `supplier_products` (units-per-purchase-unit, rounding rule, price), Wola `location_product_settings` (min/target/max, critical flags), and each supplier's `ordering_method` + contact (email / portal URL / phone) — is verified and corrected so suggestions hold and channel-aware dispatch (FR-013) routes correctly for the full set. Mirrors F-01 (data-only).
- **Change ID:** multi-supplier-master-data
- **Refs:** FR-012 (data correctness), FR-013 (channel-aware dispatch needs per-supplier method + contact — portal URLs aren't in master data yet; this closes that S-04 follow-up).
- **Prerequisites:** — (data-only; pairs with S-10 for the demo). Populate into Supabase once S-10 lands, so the demo runs on the target stack — not Sheets-then-migrate.
- **Risk:** Data-only prep, no code change (like F-01). The kg-vs-cartons "unit pain" the PRD calls out recurs per new supplier; each rounding rule must be a real engine rule, not a data hack (the S-09 lesson). Frame as master-data correctness, not operator blame.
- **Status:** done

### H-01: Quality hardening (reproducible + type-safe)

- **Outcome:** Backend dependency lockfile (byte-reproducible builds), TypeScript `strict` enabled in `tsconfig.app.json`, a static type-checker (mypy/pyright) wired into CI, and a thicker ruff ruleset — closing the remaining `health-check.md` HIGH/MEDIUM gaps now that product CI exists to enforce them.
- **Change ID:** quality-hardening
- **Refs:** `health-check.md` Fix #3 (lockfile), #4 (TS strict), #5 (ruff), #6 (formatter); `stack-assessment.md` (mypy/pyright).
- **Prerequisites:** — (product CI is now in place to gate these). Recommended before company-wide scale; can run parallel to S-10/F-02.
- **Risk:** Low product risk, high leverage. Enabling TS `strict` will surface latent `any`s (Lesson 7 — mirror Pydantic optionality); stage it so the build stays green.
- **Status:** proposed.

### M-01: In-store full-run demo (milestone)

- **Outcome:** A complete Captain→Manager→dispatch run performed **in the actual store**, across multiple real suppliers, on the production stack (Supabase data, deployed frontend + backend) — proving the two-role flow end-to-end beyond the single Bukat pilot and rehearsing the gated multi-supplier rollout.
- **Prerequisites:** S-10 (Supabase) + F-02 (multi-supplier data) + D-01 (deploy wiring).
- **Hard rule:** unless a real order is genuinely intended and confirmed, the demo backs out on submit / uses safe data — never an accidental live supplier order (the Tier-1 regression contract).
- **Status:** milestone — the goal the three slices above unlock.

## 10x Execution Playbook

How to execute Horizon 2 for maximum efficiency and lowest rework — the 10x skill chain, the lessons to pre-load, and the verify gate per item. The standard build chain is `/10x-new → /10x-research → /10x-plan → /10x-plan-review → /10x-implement → /10x-impl-review → /10x-archive`, with `/10x-frame` inserted first when *what* to build is uncertain, and `/verify` at every gate. `context/foundation/lessons.md` (7 entries) is read as priors by every review skill — **Lesson 5** (keep skill artifacts in English) and **Lesson 4** (roadmap is the source of truth; `/10x-archive` flips a slice to done) apply to **all** of them.

| Next item | Recommended 10x chain | Lessons to pre-load | Verify gate | Session |
| --------- | --------------------- | ------------------- | ----------- | ------- |
| **D-01** deploy wiring | `deployment-plan.md` §1/§2 — no build, owner-run | L3 (secrets off-repo) | `/health` + submit-and-back-out smoke | this / owner |
| **S-10** Supabase backend | full chain + `/10x-frame` first (pooler/port design risk) → `/10x-research` (the seam's full function set) → `/10x-plan` → `/10x-plan-review` → `/10x-implement` → `/10x-impl-review` → `/10x-archive` | **L2 (seam — load-bearing)**, L3 (secrets), L6 (conftest env for the new backend), L1 (CI must actually run the Supabase path) | `/verify` + a Supabase-mode test path | **separate** |
| **F-02** multi-supplier data | light chain — `/10x-new` (data slice) → `/10x-implement` → `/10x-archive`; mirror F-01 (data-only, no `/10x-plan` needed) | F-01 lessons (over_max informational; rounding = engine rule, not data hack), L4 | `/verify` — suggestion math holds per SKU | separate (pairs with S-10) |
| **H-01** quality hardening | `/10x-new` → `/10x-plan` → `/10x-implement` → `/10x-impl-review` | L7 (TS optionality on strict enable), L1 (CI enforces) | `/verify` (build must stay green) | separate |
| **M-01** in-store demo | rehearse the full Captain→Manager→dispatch flow on the prod stack | **Hard rule: no real order from a test** | end-to-end smoke, back-out-on-submit | with owner |

**Efficiency notes (applied + implied):**

- **Run S-10 as its own session.** It is the single highest-stakes change left; bundling it with anything else violates the "don't stack two big changes" rule from `infrastructure.md`. Give it the full chain incl. `/10x-frame` for the pooler/port decision.
- **F-02 is a data slice, not a code slice** — it mirrors F-01, which skipped `/10x-plan` (data-only prep). Load it into Supabase *after* S-10 so the demo runs on the target stack.
- **Pre-load `lessons.md` before each session** — the review skills already do; stating which lessons bite which slice (above) front-loads the catch. New recurring rules → `/10x-lesson`.
- **Product CI now gates every PR** (`.github/workflows/ci.yml`) — Lesson 1 is satisfied for the existing product paths; extend the workflow to exercise the Supabase backend when S-10 lands.

## Backlog Handoff

| Roadmap ID | Change ID                      | Suggested issue title                                          | Ready for `/10x-plan` | Notes                                            |
| ---------- | ------------------------------ | ------------------------------------------------------------- | --------------------- | ------------------------------------------------ |
| F-01       | bukat-master-data-ready        | Verify & correct Bukat master data at Wola                    | no                    | Blocked on master-data readiness decision (Open Q2) |
| S-01       | captain-bukat-submit           | Captain: submit a Bukat order with visible suggestion math    | no                    | Waiting on F-01                                  |
| S-02       | manager-bukat-email-dispatch   | Manager: dispatch the Bukat order by email (north star)       | no                    | Waiting on S-01                                  |
| S-03       | bukat-suggestion-learning-loop | Owner: validate Bukat suggestions & correct master data       | no                    | Waiting on S-02 (needs pilot data)               |
| S-04       | channel-aware-dispatch         | Manager: channel-aware dispatch (portal / phone / manual)     | n/a                   | Done — shipped in Manager V2 G3 (see ## Done)    |
| S-05       | manager-queue-filters          | Manager: filter the order queue (supplier / location / status)| yes                   | Run `/10x-plan manager-queue-filters`            |
| S-06       | inventory-count                | Captain: count the whole location in one pass → dated snapshot | yes                   | Run `/10x-plan inventory-count` — parallel early track |
| S-07       | order-prefill-from-inventory   | Order screen: opt-in pre-fill stock from latest inventory     | n/a                   | Done — see ## Done                               |
| S-08       | inventory-manager-view         | Manager inventory view + history/trends (Phase 2)             | no                    | Should-have; waiting on S-06                     |

## Open Roadmap Questions

1. **Who holds the Manager token at Wola day-to-day — staff vs owner during the pilot?** — Owner: owner. Block: pilot-start (go-live) gate for `S-02`; operational, not a planning blocker. (PRD Open Question 1.)
2. **Is Bukat master data ready for week 1, or does it need a prep pass before the Captain pilot?** — Owner: owner. Block: `F-01` — and therefore the whole pilot path `S-01 → S-02 → S-03`. This is the single highest-leverage unknown in the roadmap. (PRD Open Question 2.)
3. **End-state scale — pilot is `small`; company-wide is likely `medium`.** Confirm before scale work. This also gates whether the parked Sheets→Supabase migration + product CI (out of week-1 PRD scope) must start *before* adding suppliers/locations — `infrastructure.md` rates that work urgent on a ~2–3 week company-wide timeline, which is in tension with the PRD's "no migration in week 1". **Update (2026-06-09): PRD complete → the "no migration in week 1" constraint is lifted; the migration is now scheduled as S-10 (Horizon 2), to land + bake on the single-location pilot before any new location.** — Owner: owner. Block: roadmap-wide scale stages (not the week-1 slices). (PRD Open Question 3 + `infrastructure.md`.)
4. **Token rotation — two tokens were exposed earlier; rotate before wider rollout.** — Owner: owner. Block: rollout gate beyond the pilot (deferred). (PRD Open Question 4.)

## Parked

- ~~**Sheets → Supabase / Postgres migration**~~ — **Unparked → scheduled as S-10 (Horizon 2).** With the PRD complete, the week-1 "no migration" constraint no longer applies; `infrastructure.md` rates this urgent before any new location. Now a named slice, run in its own session.
- ~~**Product CI (pytest/ruff/build gate)**~~ — **Done (reconciled 2026-06-09).** `.github/workflows/ci.yml` runs backend ruff + pytest and frontend build + lint + vitest on every push/PR (commits `39885ce`, `a1d7ce4`; pip-cache parity fix `a17b9e0`). Closes `health-check.md` Fix #1 (CI covers the product) + Fix #2 (frontend test runner). **Error-tracking / observability (PostHog/Sentry)** stays parked — wire it alongside the S-10 rollout (per `infrastructure.md`).
- **API error-message localization (PL)** — backlog, small frontend change (~1–2h Tier 1). After `manager-queue-ux` (2026-06-16) killed the "[object Object]" 422 rendering, the error *detail* still surfaces raw backend English (Pydantic validation text, e.g. "lines: List should have at least 1 item…") under a PL i18n prefix ("Błąd wysyłania:"). Fix on the frontend by mapping the Pydantic error `type` → PL template (copy stays in `src/i18n/`, per AGENTS) — cover common form validations first (empty / required / min / max) + prevent empty-order submit at the UI. **Tier 2 (defer):** business-rule 400s are free-text English and need backend error *codes* to localize cleanly. Source: owner smoke-check 2026-06-16. Pairs with the `manager-ux-feedback-backlog` memory (order-cancel-with-trace).
- **Pago internal warehouse pipeline** (master-ordering Excel aggregation, warehouse email, driver delivery plan) — Why parked: PRD Non-Goals (separate future module).
- **Auto-ordering without a human final** — Why parked: PRD Non-Goals + governing rule — the engine only suggests; Captain and Manager always commit.
- **Guest / customer-facing restaurant ordering** — Why parked: PRD Non-Goals (Supply OS is internal supplier ordering only).
- **GoStock integration, receiving/WZ, finance/KSeF, predictive AI** — Why parked: PRD Non-Goals (roadmap postponements).
- **Per-manager identity / audit-by-person** — Why parked: PRD Non-Goals (shared Manager token acceptable for the pilot; history records a generic "manager" actor).
- **Multi-location / company-wide scale hardening** (per-manager auth, concurrency, scale) — Why parked: PRD Non-Goals (week 1 is Wola-only; gated to later rollout stages).

## Done

(Empty on first generation. `/10x-archive` appends here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches a roadmap item is archived.)

- **S-06: Captain counts all location products in one pass → dated snapshot** — Archived 2026-06-05 → `context/archive/2026-06-05-inventory-count/`. Lesson: tests must be order-independent (conftest, not per-file).
- **F-01: (foundation) Bukat products, supplier_products (units-per-purchase-unit, rounding rule, price), and Wola location_product_settings (min/target/max, critical flags) are verified and corrected so the suggestion engine is trustworthy for the pilot SKUs.** — Archived 2026-06-05 → `context/archive/2026-06-05-bukat-master-data-ready/`. Lesson: `over_max` is informational-only — packaging granularity is handled by `allow_over_max=TRUE`, never a quantity cap; sub-kg targets on whole-unit SKUs need an engine rounding rule (spun out as S-09), not a data hack. Closes Open Roadmap Question 2.
- **S-01: Captain logs in, selects supplier Bukat, sees the Wola product lines for that supplier, enters current stock, reviews the suggestion math, sets the final purchase quantity (with a reason where deviation rules apply), and submits — the order appears on the Manager queue the same business day.** — Archived 2026-06-05 → `context/archive/2026-06-05-captain-bukat-submit/`. Lesson: a supplier "pivot" is a frontend default + data, not backend branching (1-line `PILOT_SUPPLIER_ID` with `suppliers[0]` fallback); the "lands on Manager queue" proof needs sheet mode (seed submit is in-memory), validated via submit-and-back-out, never dispatch. Unblocks S-02 (north star).
- **S-02: Manager claims, edits/sends-back, dispatches the Bukat order by email — a ready-to-send Gmail draft in purchase units, per-line history recorded.** — Archived 2026-06-06 → `context/archive/2026-06-06-manager-bukat-email-dispatch/`. Lesson: backend + frontend were already built (validation slice = 1 regression test + conftest + builder NOTEs); north-star proven on the live Wola×Bukat setup (submit→claim→edit→dispatch→draft, backed out unsent, no real order). The smoke surfaced a live-sheet↔`main` drift — `supplier_products.rounding_rule = tenth_kg` (S-09) crashes `main`'s `RoundingRule` enum — which blocks any sheet read until S-09 lands on `main`.
- **S-09 (subkg-rounding-rule): sub-unit (0.1 kg) rounding for weight goods.** — Landed on `main` 2026-06-06 by merging branch `claude/dreamy-shockley-005215` (reviewed + archived at `context/archive/2026-06-05-subkg-rounding-rule/`). Adds `RoundingRule.TENTH_KG` + `rounding_step()` deviation-gate floor + frontend parity (`compute.ts` `roundPerRule`) + seed mirror. **Resolves the live-sheet↔`main` drift that blocked S-02** — `main` now parses `supplier_products.rounding_rule = tenth_kg`. Not a formal roadmap slice: spun out from F-01/S-01 as a parked engine fix.
- **S-05: Manager filters/narrows the queue by supplier / location / status** — Archived 2026-06-07 → `context/archive/2026-06-07-manager-queue-filters/`. Lesson: client-side narrowing of the already-fetched queue (supplier dropdown derived from the queue union + status-lane toggles) needs zero backend — `ManagerQueueItem` already carries `supplier_id`/`location_id`; the selected-supplier guard resolves at render (`effectiveSupplierId`) to avoid a `set-state-in-effect` lint regression. Location filter deferred (Wola-only pilot); the param stays plumbed for later.
- **S-04: Channel-aware dispatch for portal / phone / manual suppliers** — Reconciled 2026-06-08; already shipped during Manager V2 (Phase G3), **no new code this session**. Evidence: `frontend/src/pages/manager/DispatchPanel.tsx` branches on `ordering_method` for all four channels (editable email + in-browser Gmail URL; portal copy-list + "Oznacz jako zamówione"; phone `tel:` link parsed from `supplier_notes`; manual note), wired `OrderDetailPane` → `ManagerPage`; backend `manager_dispatch` branches on `is_email_channel` (non-email persists the transition + `sent_method` with no email artifact); covered by `test_dispatch_portal_no_email_no_url` + `test_dispatch_phone_marks_ordered`. Follow-up: portal URLs aren't in supplier master data yet (placeholder shown) — a future master-data enhancement, not an FR-013 blocker. Lesson: check the code before scheduling a slice — channel-aware dispatch was a documentation gap, not a build gap.
- **S-07: Order screen pre-fills stock from the latest inventory snapshot** — Archived 2026-06-08 → `context/archive/2026-06-08-order-prefill-from-inventory/`. Backend `GET /api/captain/inventory/latest` (newest InventoryCount for the token's location; sheet-only, seed→null) + CaptainMP opt-in banner that NAMES the snapshot date/time and fills only EMPTY `current_stock` (never clobbers typed values — the FR-017 double safeguard). 6 synthetic backend tests; 15-case edge ledger in `notes/edge-cases.md`. Lesson: when pre-filling user-editable fields from a data source, fill only empty fields and name the source (adopted from a scout-workflow cross-check — stronger than the original fill-all).
- **S-08: Manager views submitted inventory counts; Captain/Owner browse inventory history/trends over time.** — Archived 2026-06-09 → `context/archive/2026-06-09-inventory-manager-view/`. Lesson: the Captain inventory read endpoints already existed (built in the inventory-count-followups follow-up track) — FR-019 was frontend-only; reuse a lean response contract by adding a SEPARATE enriched model (InventoryCountDetail) rather than changing the one a live consumer (the order pre-fill picker) depends on. Server-side enrichment (location_name + product names) follows the manager_order_detail precedent. Trend charts deferred (should-have).
- **F-02: (foundation) Master data verified for suppliers beyond Bukat (Pago + others)** — Archived 2026-06-09 → `context/archive/2026-06-09-multi-supplier-master-data/`. Lesson: —.
- **S-03: Owner validates Bukat suggestions vs per-line history and corrects master data.** — Archived 2026-06-09 → `context/archive/2026-06-09-bukat-suggestion-learning-loop/`. Lesson: S-03's "thin build that reads per-line history" = a read-only per-product aggregate (suggested/captain/manager averages + avg deviation + reason histogram, sorted worst-first) that operationalizes FR-012 review WITHOUT auto-correction — the master-data fix stays an out-of-band sheet edit (suggest-only governing rule). Averages are purchase-unit quantities; don't label them with inventory_unit. Built on synthetic tests; the positive path validates at the deploy gate against real pilot data.
- **S-10: Order + inventory data runs on Supabase (Postgres) behind `_choose_backend()`** — Archived 2026-06-17 → `context/archive/2026-06-16-supabase-backend/`. Lesson: the new backend registers in `_choose_backend()` (L2 held); Session Pooler (IPv4, 5432) + psycopg2/SQLAlchemy sync sidestepped the asyncpg pooler footgun; cut over via backfill→parity→flip with Sheets kept warm; caught a real schema bug at backfill (delta_vs_suggestion_pct is a ratio >100, widen NUMERIC(8,6)→(12,6)).
