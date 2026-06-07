---
project: "Pita Supply OS"
version: 1
status: draft
created: 2026-06-04
updated: 2026-06-07
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
| S-03 | bukat-suggestion-learning-loop| Owner validates Bukat suggestions vs per-line history and corrects master data    | S-02          | FR-012                                        | proposed |
| S-04 | channel-aware-dispatch        | Manager dispatches additional suppliers via portal / phone / manual               | S-02          | FR-013                                        | proposed |
| S-05 | manager-queue-filters         | Manager filters/narrows the queue by supplier / location / status                 | —             | FR-014                                        | done     |
| S-06 | inventory-count               | Captain counts all location products in one pass → dated snapshot                 | —             | US-02, FR-015, FR-016                         | done     |
| S-07 | order-prefill-from-inventory  | Order screen offers opt-in pre-fill of stock from the latest inventory snapshot   | S-06          | US-02, FR-017                                 | proposed |
| S-08 | inventory-manager-view        | (Phase 2) Manager views inventories; Owner browses inventory history/trends       | S-06          | FR-018, FR-019                                | proposed |

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
- **Status:** proposed

### S-04: Channel-aware dispatch for additional suppliers

- **Outcome:** Manager dispatches non-email suppliers via the correct channel (portal / phone / manual), recording the state transition and sent_method without an email artifact.
- **Change ID:** channel-aware-dispatch
- **PRD refs:** FR-013
- **Prerequisites:** S-02
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Week-2 scope (must-have by week 2). The dispatch endpoint already branches on `supplier.ordering_method`; the work is per-channel UX + recording. Gated behind the pilot proving the email channel first, so it is not the riskiest-assumption slice.
- **Status:** proposed

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
- **Status:** proposed

### S-08: Manager inventory view + history/trends (Phase 2)

- **Outcome:** Manager views submitted inventory counts; Captain/Owner browse inventory history/trends over time.
- **Change ID:** inventory-manager-view
- **PRD refs:** FR-018, FR-019
- **Prerequisites:** S-06
- **Parallel with:** S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Phase 2 (should-have) — demoted via Socratic challenge: the Manager already sees stock embedded in the order, and snapshots persist regardless, so these consumption surfaces pay off at audit / multi-supplier scale, not on the pilot. Deferred past the must-have core.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                      | Suggested issue title                                          | Ready for `/10x-plan` | Notes                                            |
| ---------- | ------------------------------ | ------------------------------------------------------------- | --------------------- | ------------------------------------------------ |
| F-01       | bukat-master-data-ready        | Verify & correct Bukat master data at Wola                    | no                    | Blocked on master-data readiness decision (Open Q2) |
| S-01       | captain-bukat-submit           | Captain: submit a Bukat order with visible suggestion math    | no                    | Waiting on F-01                                  |
| S-02       | manager-bukat-email-dispatch   | Manager: dispatch the Bukat order by email (north star)       | no                    | Waiting on S-01                                  |
| S-03       | bukat-suggestion-learning-loop | Owner: validate Bukat suggestions & correct master data       | no                    | Waiting on S-02 (needs pilot data)               |
| S-04       | channel-aware-dispatch         | Manager: channel-aware dispatch (portal / phone / manual)     | no                    | Week-2; waiting on S-02                          |
| S-05       | manager-queue-filters          | Manager: filter the order queue (supplier / location / status)| yes                   | Run `/10x-plan manager-queue-filters`            |
| S-06       | inventory-count                | Captain: count the whole location in one pass → dated snapshot | yes                   | Run `/10x-plan inventory-count` — parallel early track |
| S-07       | order-prefill-from-inventory   | Order screen: opt-in pre-fill stock from latest inventory     | no                    | Waiting on S-06                                  |
| S-08       | inventory-manager-view         | Manager inventory view + history/trends (Phase 2)             | no                    | Should-have; waiting on S-06                     |

## Open Roadmap Questions

1. **Who holds the Manager token at Wola day-to-day — staff vs owner during the pilot?** — Owner: owner. Block: pilot-start (go-live) gate for `S-02`; operational, not a planning blocker. (PRD Open Question 1.)
2. **Is Bukat master data ready for week 1, or does it need a prep pass before the Captain pilot?** — Owner: owner. Block: `F-01` — and therefore the whole pilot path `S-01 → S-02 → S-03`. This is the single highest-leverage unknown in the roadmap. (PRD Open Question 2.)
3. **End-state scale — pilot is `small`; company-wide is likely `medium`.** Confirm before scale work. This also gates whether the parked Sheets→Supabase migration + product CI (out of week-1 PRD scope) must start *before* adding suppliers/locations — `infrastructure.md` rates that work urgent on a ~2–3 week company-wide timeline, which is in tension with the PRD's "no migration in week 1". — Owner: owner. Block: roadmap-wide scale stages (not the week-1 slices). (PRD Open Question 3 + `infrastructure.md`.)
4. **Token rotation — two tokens were exposed earlier; rotate before wider rollout.** — Owner: owner. Block: rollout gate beyond the pilot (deferred). (PRD Open Question 4.)

## Parked

- **Sheets → Supabase / Postgres migration** — Why parked: PRD Constraints state "No data migration or backfill in week 1"; the data store stays as-is for the pilot. Urgency for the company-wide stage is tracked in `infrastructure.md` and Open Roadmap Question 3 — not a week-1 roadmap slice.
- **Product CI (pytest/ruff/build gate) + error-tracking/observability** — Why parked: not in week-1 PRD scope; the present quality floors (no lost stock, same-day queue, inspectable per-line history) are met by the baseline. Tracked in `stack-assessment.md` / `infrastructure.md` for the scale stages.
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
