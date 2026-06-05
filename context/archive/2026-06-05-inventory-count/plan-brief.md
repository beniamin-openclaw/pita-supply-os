# Inventory Count (S-06) — Plan Brief

> Full plan: `context/changes/inventory-count/plan.md`

## What & Why

Give the Captain a **location-wide inventory count**: one screen listing all of a location's products, enter current stock in a single pass, approve → a **dated, append-only snapshot** is persisted. It makes the governing rule's "location stock counts" step explicit and counted-once, instead of re-typed per supplier. (PRD v2 FR-015/016, US-02; roadmap S-06.)

## Starting Point

The app persists `orders` / `order_lines` to Google Sheets behind the `_choose_backend()` seam (seed = read-only). There is **no** inventory concept today — current stock lives only inside an order line. The Captain UI pattern (page in `pages/captain-mp/`, draft persistence, submit+toast) and the sheets write toolkit are both directly reusable.

## Desired End State

A Captain opens `/captain-v2/inventory-count`, sees every product configured for their location, enters stock once, confirms, and submits → a snapshot lands in `inventory_counts` + `inventory_count_lines` (sheet mode). Ordering is unaffected; an in-progress count survives a reload.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope split | Phase 1 = count → snapshot only | Pre-fill (S-07) + Manager view/history (S-08) stay separate slices | Shape/PRD |
| Persistence | Sheet-only, mirror orders | Seed is read-only; consistency + least code; tests mock sheets | Plan |
| Blank fields | Blank = not counted (store only entered lines) | `0 ≠ unknown`; uncounted products simply have no line | Plan |
| History | Append-only — each submit = new dated snapshot | Matches the "full snapshots over time" decision; immutable audit | Shape/Plan |
| Phasing | 3 phases (data → API → front) | Each phase independently verifiable; backend is pytest-green even if front slips | Plan |

## Scope

**In scope:** location-wide count screen; dated append-only snapshot persisted via the seam; `products` + `submit` endpoints; backend unit + endpoint tests; draft persistence for the NFR.

**Out of scope:** order pre-fill (S-07); Manager view + history browsing (S-08); variance/target capture; edit/delete of a count; partial-count `draft` state; seed-mode writes; auto-provisioning the Sheet tabs.

## Architecture / Approach

Mirror the orders stack top-to-bottom: `models.py` (`InventoryCount` + `InventoryCountLine` + submit req/resp) → `sheets.py` (read + append-only write, reusing `_model_to_row` / `_validate_headers` / `invalidate_cache`) → `main.py` (`_persist_inventory_count` via `getattr`, + 2 captain endpoints) → frontend (`InventoryCountPage` + route + `api.*` + i18n + draft). Persistence is sheet-only; seed degrades to a warning, exactly like orders.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data layer | Models + append-only sheets persistence + unit tests | Header-order mismatch vs the Sheet tabs |
| 2. Endpoints | `products` / `submit` / `latest` + endpoint tests | Location-wide product list (not per-supplier) differs from `captain_orderable` |
| 3. Frontend | One-pass count screen + draft + route | Manual-only verification (no FE test runner); draft key is location-scoped |

**Prerequisites:** for real sheet-mode use, the operator pre-creates the `inventory_counts` + `inventory_count_lines` tabs with header rows (unit tests don't need this — mocked).
**Estimated effort:** ~2-3 implement sessions across 3 phases; backend (P1-2) is the solid, pytest-verified core, frontend (P3) is the manual-verification stretch.

## Open Risks & Assumptions

- Sheet tabs must exist before sheet-mode writes succeed (`_validate_headers` gate) — a manual operator step, called out in Migration Notes.
- The frontend draft helper is keyed by `supplier_id`; inventory reuses it with a fixed sentinel key (`"__inventory__"`) — no helper change, but worth confirming in review.
- Append-only means multiple counts/day accumulate; the newest snapshot is the authoritative current count — intended, not a leak. (The read path that surfaces "latest" is deferred to S-07, per plan review F1.)

## Success Criteria (Summary)

- A Captain can count all location products in one pass and submit a dated snapshot that persists (sheet mode).
- Only entered products produce lines; re-submitting yields a new snapshot (the newest is authoritative).
- The existing ordering flow is unchanged; backend tests (`test_inventory_sheets.py`, `test_inventory_submit.py`) and the full suite stay green.
