# Plan — Order screen pre-fills stock from the latest inventory snapshot (S-07 / FR-017)

- **Change**: `context/changes/order-prefill-from-inventory/`
- **Status**: planned (self-reviewed — autonomous run)
- **Roadmap**: S-07 · **PRD**: US-02, FR-017

## Desired End State

On the Captain order screen, when a supplier's lines have loaded and a location inventory snapshot exists, an **opt-in** banner names the snapshot's date/time and offers to pre-fill `current_stock`. Accepting fills the `current_stock` field of every orderable line that was counted (matched by `product_id`), leaving everything editable. Skipping (or having no snapshot) leaves today's manual-entry flow byte-for-byte unchanged. No snapshot / seed mode → no banner, no error.

## Current State Analysis

- **Backend**: snapshots persist via `inventory_counts` + `inventory_count_lines` (sheet-only). `sheets.load_inventory_counts()`, `load_inventory_count_lines()`, `get_inventory_count(count_id)` exist (sheets.py:687/692/732). `seed_loader` has NO inventory read → seed mode must degrade to "no snapshot" (mirrors `captain_orders` / `manager_queue`, which return `[]` off-sheet). No latest-snapshot endpoint yet. Auth: `require_captain` derives `location_id` from the token (cross-location read forbidden).
- **Frontend (`CaptainMP.tsx`)**: `lines: Record<product_id, OrderLine>` (`current_stock_qty_base: number|""`); orderable items + blank lines initialize in the `activeSupplierId` effect (lines 99–151). Existing **draft-resume banner** (`draftBanner` state + `acceptDraft`/`discardDraft`, render 336–364) — the prefill banner is a SECOND, independent opt-in and must not collide. `api` shortcuts live in `apiClient.ts`; copy via `STRINGS`/`useT`.
- **Units**: inventory `current_stock_qty_base` and the order line's `current_stock_qty_base` are both in the product's inventory_unit (base) — no conversion. (Verified: `captain_inventory_submit` stores base; the order screen enters base.)

## Phase 1: Backend — latest-snapshot endpoint

### Changes Required
1. `supply-os-v1/app/models.py` — add `InventoryLatestLine` + `InventoryLatestResponse`.
2. `supply-os-v1/app/main.py` — `GET /api/captain/inventory/latest` (`response_model=Optional[InventoryLatestResponse]`): seed/off-sheet → `None`; else newest `InventoryCount` for the captain's `location_id` by `count_submitted_at` (fallback `count_date`), lines via `get_inventory_count`.
3. `supply-os-v1/tests/test_inventory_latest.py` — synthetic sheet-backend tests: latest-wins across multiple counts, location scoping, no-snapshot → null, seed mode → null, lines shape. (Never a real order.)

### Success Criteria
#### Automated Verification:
- [ ] `cd supply-os-v1 && python -m pytest tests/test_inventory_latest.py` passes.
- [ ] `cd supply-os-v1 && python -m pytest` full suite green.
- [ ] `cd supply-os-v1 && ruff check .` clean.

#### Manual Verification:
- [ ] (none — covered by synthetic tests)

## Phase 2: Frontend — opt-in prefill banner

### Changes Required
1. `frontend/src/types.ts` — `InventoryLatestLine` + `InventoryLatestResponse`.
2. `frontend/src/apiClient.ts` — `api.inventoryLatest()` → `GET /api/captain/inventory/latest` (returns the object or `null`).
3. `frontend/src/i18n/strings.ts` — `captain.prefillBannerTitle` (names date/time), `captain.prefillBannerAccept`, `captain.prefillBannerSkip`, `captain.prefillApplied`.
4. `frontend/src/pages/captain-mp/CaptainMP.tsx`:
   - mount effect → `api.inventoryLatest()` → `latestSnapshot` state (silent on error; prefill is optional).
   - `prefillDismissed: Set<supplierId>`; banner shown when `latestSnapshot && activeSupplier && !dismissed && items loaded && ≥1 snapshot product is orderable here`.
   - `acceptPrefill`: fill `current_stock_qty_base` for matching orderable lines only; dismiss for this supplier; toast count. `skipPrefill`: dismiss only.

### Success Criteria
#### Automated Verification:
- [ ] `tsc --noEmit` clean.
- [ ] `eslint` — 0 problems (baseline is now 0).
- [ ] `vite build` succeeds (Homebrew node).

#### Manual Verification:
- [ ] Owner sim/test: with a snapshot present, the order screen shows the named-by-date banner; accept fills counted lines (editable); skip leaves manual entry; no snapshot → no banner. No regression to submit.

## Phase 3: Edge-case simulation + flagging

### Changes Required
1. `context/changes/order-prefill-from-inventory/notes/edge-cases.md` — the authoritative weird-case ledger (fed by scout workflow `w0lafv5zc`): for each case (no snapshot, non-orderable snapshot product, orderable-but-uncounted, multiple snapshots, stale snapshot, overwrite of typed values / draft, unit consistency, seed mode, location scoping, discontinued product) — risk + how this implementation handles it, and whether a test covers it.
2. Also record a short **simulation** of the two prior chips' pending manual gates (email content; collapsible categories) with any weird cases surfaced — standing in for the real test "we'll do later".

### Success Criteria
#### Automated Verification:
- [ ] Every edge case in the ledger maps to either a test (named) or an explicit "handled in code at <file>" line.
#### Manual Verification:
- [ ] Owner reviews `notes/edge-cases.md` and the flagged weird cases before the real pilot test.

## What We're NOT Doing

- No auto-fill — prefill is opt-in only (governing rule: never auto-generate an order from a count).
- No new persisted entity / schema change — read-only over existing snapshots.
- No unit conversion (counts and order stock share the base unit).
- No cross-location read; no Manager-side inventory view (S-08, deferred).
- Not changing the existing draft-resume banner behaviour.

## Progress

### Phase 1: Backend — latest-snapshot endpoint

#### Automated
- [x] 1.1 models.py: InventoryLatestLine + InventoryLatestResponse — df06c34
- [x] 1.2 main.py: GET /api/captain/inventory/latest (seed→null; latest by submitted_at; location-scoped) — df06c34
- [x] 1.3 test_inventory_latest.py synthetic tests (latest-wins, scoping, none→null, seed→null) — df06c34
- [x] 1.4 full backend pytest + ruff green — df06c34

### Phase 2: Frontend — opt-in prefill banner

#### Automated
- [x] 2.1 types.ts InventoryLatestResponse/Line — 61c6948
- [x] 2.2 apiClient.ts api.inventoryLatest() — 61c6948
- [x] 2.3 strings.ts prefill banner keys — 61c6948
- [x] 2.4 CaptainMP: snapshot fetch + opt-in banner + accept/skip (matching lines only) — 61c6948
- [x] 2.5 frontend tsc + eslint(0) + build green — 61c6948

#### Manual
- [ ] 2.6 Owner sim/test: banner named-by-date, accept fills counted lines, skip = manual, no-snapshot = no banner

### Phase 3: Edge-case simulation + flagging

#### Automated
- [x] 3.1 notes/edge-cases.md ledger (each case → test or handled-in-code)
- [x] 3.2 simulation note for the 2 prior chips' pending manual gates

#### Manual
- [ ] 3.3 Owner reviews edge-case ledger before the real pilot test
