# Inventory-Count Follow-ups (FR-020…024) Implementation Plan

## Overview

Six demo-driven improvements to the Captain inventory-count flow (parallel inventory track — does NOT touch the Bukat pilot): an editable count date, a required "counted by" attribution, a "last count: who/when" reassurance banner, an always-available pre-fill control with two fill modes, a snapshot picker to pre-fill from any recent count, and a permanent top-tab navigation so the inventory module is no longer buried in the hamburger menu.

## Current State Analysis

Grounded in `context/changes/inventory-count-followups/research.md`:

- `captain_inventory_submit` (`main.py:1485-1580`) **hardcodes** `count_date = today` (`main.py:1545`) and `count_user = location_id` (`main.py:1546`); the request (`InventoryCountSubmitRequest`, `models.py:415-420`) carries only `lines` + `notes`.
- `count_date` and `count_user` **already exist** as columns on the live `inventory_counts` worksheet (S-06 Migration Notes `context/archive/2026-06-05-inventory-count/plan.md:248-253`, verified at S-06 closeout) and on the `InventoryCount` model (`models.py:396`). **No worksheet migration is needed** to persist them — the only blocker is the live-header pre-flight confirm.
- `captain_inventory_latest` (`main.py:1581-1632`) returns `InventoryLatestResponse` **without** `count_user` (`models.py:436-444`) — the FR-022 blocker.
- The pre-fill engine `acceptPrefill` (`CaptainMP.tsx:231-252`) fills only empty `current_stock` fields, never clobbers a typed value (incl. a deliberate `0`); shown today as a one-shot per-supplier dismissable banner (`showPrefillBanner`, `CaptainMP.tsx:371-377`).
- `load_inventory_counts()` and `get_inventory_count(count_id)` exist in `sheets.py` but are **exposed by no route** — FR-024 needs two thin read routes.
- Inventory persistence is **sheet-only**: `seed_loader.py:72-92` has zero inventory functions; `captain_inventory_latest` returns `None` in seed mode. New read endpoints must degrade gracefully (empty/null) via `_choose_backend()`, never 500.
- The inventory screen is reachable **only** via the hamburger menu (`HamburgerMenu.tsx:88-100`), two levels deep — the demo user had to be told "menu → inventory."

### Key Discoveries:

- No migration for FR-020/021/022 — `count_date`/`count_user` are live columns (`research.md` §"MIGRATION VERDICT").
- FR-024 backing functions already exist unexposed (`sheets.py` `load_inventory_counts` / `get_inventory_count`).
- Pre-fill safety is a lesson-grade pattern — name the source, fill empties only, never clobber, opt-in (`context/archive/2026-06-08-order-prefill-from-inventory/reviews/impl-review.md:59`). FR-023's "overwrite all" must therefore be confirm-gated.
- Append-only is inviolable — never add an "edit a saved count" path; FR-020 sets the date on a *new* submit, FR-024 only *reads* past snapshots.

## Desired End State

A Captain can: open inventory from a permanent top-tab (not the hamburger); set the count date (any past date; future blocked); must enter who counted; see a banner naming the last count's author + time; on the order screen, pick any of the last 10 snapshots and pull stock into the order via either "fill empties" or a confirm-gated "overwrite all", with the order pre-fill banner naming who counted. The "blank = not counted / 0 = real zero" rule is explained inline.

Verify: backend pytest + ruff green; frontend build + lint green; manual click-through on the deployed link per phase.

## What We're NOT Doing

- No per-user login / auth identity — "counted by" is **free-text, self-declared, unverified**; it does not authenticate or gate anything (stays inside the v0 Non-Goal).
- No editing or deleting a saved inventory count (append-only holds).
- No worksheet migration / new columns (FR-020/021/022 reuse existing live columns).
- No row-locking or conflict detection for concurrent counts — FR-022 is reassurance UI only.
- No supplier KPI / error tracking, no receiving module (belongs to the order-lifecycle epic).
- No master-data fixes (PRD Open Question #2 — owner edits the sheet).
- No FE test runner — frontend phases verify via `build` + `lint` + manual (repo has no Vitest yet).

## Implementation Approach

Two backend→frontend vertical slices plus a navigation phase. Backend lands first within each vertical so it can be curl-verified before the UI consumes it. All persistence/read goes through `_choose_backend()` (never `import sheets` from a route). Production deploy happens once, after all phases pass impl-review — so the request-contract tightening in Phase 1 (required `count_user`) never breaks the live frontend mid-change.

## Critical Implementation Details

- **Request-contract tightening is intra-change only.** Phase 1 makes `count_user` required on `InventoryCountSubmitRequest`; the current frontend submit omits it. This is safe because deploy is a single gated step after all phases — the matching frontend (Phase 2) ships in the same deploy. Do NOT deploy Phase 1 alone to prod.
- **Pre-flight before Phase 1 code.** Confirm the live `inventory_counts` worksheet header carries `count_user` + `count_date` (operator has sheet access). If a column were absent, `_model_to_row` (`sheets.py:356-380`) silently drops the value on write — a hard-to-spot data-loss bug.
- **Overwrite-all must be confirm-gated.** FR-023's second action clobbers typed values; route it through a confirm dialog so it satisfies the "never overwrite without confirmation" lesson.
- **Seed/dev degrade.** The FR-024 list/detail routes return `[]` / `null` (not 500) when `backend is not sheets`, and surface `WorksheetNotFound` as 503 — mirroring `captain_inventory_latest` and the submit endpoint.

## Phase 1: Backend — count metadata + latest response

### Overview
Let the submit endpoint accept an editable count date (reject future) and a required "counted by"; stop hardcoding both. Surface `count_user` in the latest-snapshot response. *(FR-020/021/022 backend)*

### Changes Required:

#### 1. Submit request model
**File**: `supply-os-v1/app/models.py`
**Intent**: Let the client send the count date and the counter's name; make the name mandatory.
**Contract**: `InventoryCountSubmitRequest` (`models.py:415-420`) gains `count_date: Optional[date] = None` and `count_user: str = Field(min_length=1)` (required). `notes`/`lines` unchanged.

#### 2. Latest response model
**File**: `supply-os-v1/app/models.py`
**Intent**: Expose who made the latest snapshot so the banner can render "by X".
**Contract**: `InventoryLatestResponse` (`models.py:436-444`) gains `count_user: Optional[str] = None` (optional → mirror as `count_user?` in TS).

#### 3. Submit endpoint
**File**: `supply-os-v1/app/main.py`
**Intent**: Use the request's date (default today) and name (no more proxy); reject a future date.
**Contract**: `captain_inventory_submit` (`main.py:1485-1580`) — resolve `count_date = req.count_date or today_warsaw`, where `today_warsaw = datetime.now(_WARSAW_TZ).date()` (reuse the existing constant at `main.py:459`, NOT the UTC `today` at `main.py:1514`); if `count_date > today_warsaw` raise `HTTPException(400)`. Construction site (`main.py:1544-1552`) uses the resolved date and `count_user=req.count_user`. *(F3: Warsaw-date comparison avoids rejecting a legitimate "today" picked just after local midnight.)*

#### 4. Latest endpoint
**File**: `supply-os-v1/app/main.py`
**Intent**: Pass the persisted author through to the response.
**Contract**: `captain_inventory_latest` (`main.py:1625-1631`) sets `count_user=latest.count_user`.

#### 5. Backend tests
**File**: `supply-os-v1/tests/test_inventory_submit.py`, `supply-os-v1/tests/test_inventory_latest.py`
**Intent**: Lock the new contract.
**Contract**: submit rejects a future `count_date` (400, incl. a near-midnight Warsaw case); accepts past/today; missing `count_user` → 422; `count_user` round-trips; latest surfaces `count_user`. **(F2)** Also update the 6 existing submit tests — `happy_path_seed_backend`, `unknown_product`, `no_setting_for_location`, `count_id_format`, `persists_to_sheet`, `worksheets_not_configured_returns_503` — which currently post `{lines, notes}` with no `count_user` and will 422 once it's required. Env via `tests/conftest.py` (never per-file).

### Success Criteria:

#### Automated Verification:
- Backend tests pass: `cd supply-os-v1 && python -m pytest`
- Lint passes: `cd supply-os-v1 && ruff check .`

#### Manual Verification:
- **Pre-flight**: live `inventory_counts` worksheet header contains `count_user` + `count_date` columns.
- `curl` submit with a past `count_date` + `count_user` persists; a future date → 400; missing `count_user` → 422.
- `curl` `/api/captain/inventory/latest` returns `count_user`.

---

## Phase 2: Frontend — inventory count screen

### Overview
Add the date picker, the required "counted by" field, the "last count: who/when" banner, and the blank-vs-0 hint to the inventory screen. *(FR-020/021/022 FE + C7-2)*

### Changes Required:

#### 1. Types
**File**: `frontend/src/types.ts`
**Intent**: Mirror the tightened request + enriched latest response.
**Contract**: `InventoryCountSubmitRequest` (`types.ts:132-135`) gains `count_date?: string` and required `count_user: string`; `InventoryLatestResponse` (`types.ts:118-124`) gains `count_user?: string | null`.

#### 2. Inventory count screen
**File**: `frontend/src/pages/captain-mp/InventoryCountPage.tsx`
**Intent**: Capture date + counter, show last-count reassurance, explain blank-vs-0, block submit without a name.
**Contract**: new state `countDate` (default `today` `yyyy-mm-dd`) + `countedBy` (""); header block (`314-318`) gets a `<input type="date">` (client-side reject future) and a required "counted by" text input; fetch `api.inventoryLatest()` on mount → render a "last count: who/when" banner above the draft banner (`line 320`) using `formatDateTime`; a one-line blank-vs-0 hint near the stock inputs; `handleSubmit` (`270-298`) sends `count_date` + `count_user` and is disabled until `countedBy` is non-empty. **(F6)** extend the draft schema `InventoryDraftState` (`InventoryCountPage.tsx:31-34`) to persist `count_date` and restore it on resume (`count_user` stays out — typed each time). **(F7)** re-fetch `inventoryLatest()` after a successful submit so the "last count" banner reflects the just-saved snapshot.

#### 3. Copy
**File**: `frontend/src/i18n/strings.ts`
**Intent**: All new strings in pl + en.
**Contract**: add `inventory.countDateLabel`, `inventory.countedByLabel`, `inventory.countedByRequired`, `inventory.lastCountBanner` (interpolates `{who}`,`{time}`), `inventory.blankVsZeroHint` to `STRINGS` (static keys → no cast).

### Success Criteria:

#### Automated Verification:
- Build passes: `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run build`
- Lint passes: `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run lint`

#### Manual Verification:
- Date picker defaults to today; a future date is blocked.
- Submit is disabled until "counted by" is filled.
- "Last count: who/when" banner appears when a prior snapshot exists for the location.
- Blank-vs-0 hint is visible on the count screen.
- After a successful submit, the last-count banner updates to the just-saved count (F7).
- Resuming a saved draft restores a back-dated count date (F6).

---

## Phase 3: Backend — snapshot list + detail endpoints

### Overview
Expose the already-existing read functions as two routes so the order screen can list and fetch any recent snapshot. *(FR-024 backend)*

### Changes Required:

#### 1. Summary model
**File**: `supply-os-v1/app/models.py`
**Intent**: A compact row for the picker (no lines).
**Contract**: new `InventoryCountSummary` = `count_id, location_id, count_date, count_submitted_at: Optional[datetime], count_user: Optional[str], line_count`.

#### 2. List + detail routes
**File**: `supply-os-v1/app/main.py`
**Intent**: List the last 10 snapshots (newest count date first) and fetch one with lines, scoped to the token's location.
**Contract**:
- `GET /api/captain/inventory/counts` → `list[InventoryCountSummary]`; `backend = _choose_backend()`, `if backend is not sheets: return []`; filter to `location_id`, sort by `count_date` desc, cap 10.
- `GET /api/captain/inventory/count/{count_id}` → reuse `InventoryLatestResponse` (now carries `count_user`); seed mode → 503 (mirrors `manager_order_detail`); `get_inventory_count`; 404 if missing OR `count.location_id != location_id`; wrap append/read `WorksheetNotFound` → 503.

#### 3. Backend tests
**File**: `supply-os-v1/tests/test_inventory_latest.py` (or new `test_inventory_counts.py`)
**Intent**: Lock listing + scoping.
**Contract**: list returns ≤10 sorted by `count_date` desc, location-scoped, `[]` in seed mode; detail returns lines, 404 cross-location, seed/no-tab degrade.

### Success Criteria:

#### Automated Verification:
- Backend tests pass: `cd supply-os-v1 && python -m pytest`
- Lint passes: `cd supply-os-v1 && ruff check .`

#### Manual Verification:
- `curl` `/api/captain/inventory/counts` returns ≤10 rows sorted by count date (newest first), only this location.
- `curl` `/api/captain/inventory/count/{id}` returns lines; a cross-location id → 404; seed mode degrades (no 500).

---

## Phase 4: Frontend — pre-fill controls + picker + order-banner enrichment

### Overview
In the order screen's context strip, add a snapshot picker and two fill actions, and name the counter in the pre-fill banner. *(FR-022 order-side / FR-023 / FR-024 FE)*

### Changes Required:

#### 1. Types + apiClient
**File**: `frontend/src/types.ts`, `frontend/src/apiClient.ts`
**Intent**: Consume the two new routes.
**Contract**: add `InventoryCountSummary` interface; add `api.inventoryCounts()` → `InventoryCountSummary[]` and `api.inventoryCount(count_id)` → `InventoryLatestResponse` (role `"captain"`, `encodeURIComponent` the id).

#### 2. Pre-fill controls + picker
**File**: `frontend/src/pages/captain-mp/CaptainMP.tsx` (+ a dedicated pre-fill control row rendered as a sibling above the order lines — NOT inside `ContextStrip`, which is supplier-context only — F5)
**Intent**: Let the Captain choose a snapshot and fill in two modes; keep the safe mode default; preserve the FR-017 opt-in banner.
**Contract**: **(F1 — refactor map)** the single-`latestSnapshot` model becomes `availableSnapshots` + `selectedSnapshotId`. Repoint EVERY reader of `latestSnapshot` to the SELECTED snapshot: the fetch effect (`CaptainMP.tsx:88-101`, switch `inventoryLatest()` → `inventoryCounts()` + lazy `inventoryCount(id)` on select), `acceptPrefill` (`234`), `prefillTime` (`366-367`), and `showPrefillBanner`'s `.some(...)` mapping check (`377`). **Invariant to preserve (do NOT regress FR-017):** the opt-in banner names the SELECTED snapshot's date/time, fills empties only, and keeps the per-supplier `prefillDismissed` semantics. `selectedSnapshotId` defaults to the newest by `count_date`. The dedicated control row renders a `<select>` (each row: count date + submitted time + counted-by) and two actions: **"Wypełnij puste"** = existing empties-only `acceptPrefill` over the selected snapshot; **"Nadpisz wszystko"** = confirm-gated overwrite of all matched lines (typed values included — an ADDITIVE path; do NOT modify the safe empties-only fill). Pre-fill banner gains "liczył: {who}".

#### 3. Confirm dialog + copy
**File**: `frontend/src/pages/captain-mp/components/` (mirror the lightweight `ConfirmApproveDialog` pattern from `InventoryCountPage.tsx:42-123` — NOT `ConfirmSubmitDialog`, which is hardwired to order-submit line/deviation/reason counts — F4), `frontend/src/i18n/strings.ts`
**Intent**: Gate the destructive action; all copy in pl + en.
**Contract**: add `captain.prefillFillEmpties`, `captain.prefillOverwrite`, `captain.prefillOverwriteConfirmTitle/Body/Confirm/Cancel`, `captain.snapshotPickerLabel`, `captain.prefillBannerBy` to `STRINGS`.

### Success Criteria:

#### Automated Verification:
- Build passes: `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run build`
- Lint passes: `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run lint`

#### Manual Verification:
- Picker lists snapshots (count date + submitted time + who), sorted by count date.
- "Wypełnij puste" fills only empty stock; "Nadpisz wszystko" asks for confirmation then overwrites.
- Order pre-fill banner shows "liczył: X".

---

## Phase 5: Frontend — permanent top-tab navigation

### Overview
Add an always-visible top-tab strip (Zamówienia / Remanent) under the header on the Captain screens, so inventory is discoverable without the hamburger. *(navigation / discoverability)*

### Changes Required:

#### 1. Tab strip component
**File**: `frontend/src/pages/captain-mp/components/CaptainTabs.tsx` (new)
**Intent**: A permanent, mobile-first tab bar with the primary destinations and an active state by route.
**Contract**: renders two tabs — Zamówienia (`/captain-v2`) and Remanent (`/captain-v2/inventory-count`) — using the brand tokens; active state derived from `useLocation`. Sits directly under `<AppHeader>`.

#### 2. Wire into Captain screens
**File**: `frontend/src/pages/captain-mp/CaptainMP.tsx`, `InventoryCountPage.tsx`, `OrdersListPage.tsx`
**Intent**: Mount the strip under the header on the captain-v2 screens; keep the hamburger for secondary actions (language, logout, debug).
**Contract**: insert `<CaptainTabs />` below the header on each screen; hamburger items unchanged.

#### 3. Copy
**File**: `frontend/src/i18n/strings.ts`
**Intent**: Tab labels in pl + en.
**Contract**: add `tabs.orders`, `tabs.inventory` (or reuse `orders.title` / `hamburger.inventory`).

### Success Criteria:

#### Automated Verification:
- Build passes: `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run build`
- Lint passes: `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run lint`

#### Manual Verification:
- Permanent tab strip is visible on phone + laptop (Zamówienia / Remanent) with correct active state.
- Can navigate orders ↔ inventory via the tabs without opening the hamburger.

---

## Testing Strategy

### Unit / endpoint Tests (backend, pytest):
- Submit: future-date 400, past/today accepted, missing `count_user` 422, `count_user` persisted.
- Latest: `count_user` surfaced.
- List: ≤10, sorted by `count_date` desc, location-scoped, `[]` in seed.
- Detail: lines returned, cross-location 404, seed/no-tab degrade.

### Manual Testing Steps:
1. Inventory screen: pick date (block future), enter name (required), see last-count banner, read blank-vs-0 hint, submit.
2. Order screen: open picker, select an older snapshot, "fill empties" then "overwrite all" (confirm), verify banner names the counter.
3. Navigation: reach inventory via the top tab on a phone, no hamburger.
4. **No real order submitted/dispatched** — synthetic/test data only (hard rule).

## Migration Notes

No worksheet migration. One pre-flight: confirm the live `inventory_counts` header carries `count_user` + `count_date` (Phase 1 manual gate). Deploy once, after all phases + impl-review.

## References

- Research: `context/changes/inventory-count-followups/research.md`
- Pre-fill pattern this extends: `context/archive/2026-06-08-order-prefill-from-inventory/`
- Append-only + Migration Notes: `context/archive/2026-06-05-inventory-count/plan.md:132-135,248-253`
- Submit/latest endpoints: `supply-os-v1/app/main.py:1485-1632`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — count metadata + latest response

#### Automated
- [x] 1.1 Backend tests pass: `python -m pytest` — ae2e88c
- [x] 1.2 Lint passes: `ruff check .` — ae2e88c

#### Manual
- [x] 1.3 Pre-flight: live inventory_counts header has count_user + count_date columns — ae2e88c
- [ ] 1.4 curl submit: past count_date + count_user persists; future date → 400; missing count_user → 422
- [ ] 1.5 curl /inventory/latest returns count_user

### Phase 2: Frontend — inventory count screen

#### Automated
- [x] 2.1 Build passes: `npm run build` — 3da3048
- [x] 2.2 Lint passes: `npm run lint` — 3da3048

#### Manual
- [x] 2.3 Date picker defaults today; future date blocked — e2e verified (live app, seed backend): default 2026-06-08, future 2026-06-11 snaps back via handler + `max` attr, past 2026-06-05 accepted — 3da3048
- [x] 2.4 Submit disabled until "counted by" filled — e2e verified: stock-filled+name-empty stays disabled; enables only after name typed — 3da3048
- [ ] 2.5 "Last count: who/when" banner shows when a prior snapshot exists — sheet-mode only; seed returns 200 null (banner correctly hidden, graceful degrade verified e2e). Positive case deferred to deploy gate; covered by unit test `test_latest_surfaces_count_user`
- [x] 2.6 Blank-vs-0 hint visible — e2e verified: "Puste = nie policzone · 0 = brak na stanie" present in sticky bar — 3da3048
- [ ] 2.7 After submit, last-count banner reflects the just-saved count (F7) — sheet-mode only (same dependency as 2.5); deferred to deploy gate
- [x] 2.8 Draft resume restores a back-dated count_date (F6) — e2e verified after fixing an autosave clobber bug (blank-mount autosave was overwriting the saved draft before resume); now date+lines restore correctly — 3da3048

### Phase 3: Backend — snapshot list + detail endpoints

#### Automated
- [x] 3.1 Backend tests pass: `python -m pytest`
- [x] 3.2 Lint passes: `ruff check .`

#### Manual
- [ ] 3.3 curl /inventory/counts returns ≤10 sorted by count_date desc, location-scoped
- [ ] 3.4 curl /inventory/count/{id} returns lines; cross-location → 404; seed mode degrades (no 500)

### Phase 4: Frontend — pre-fill controls + picker + order-banner enrichment

#### Automated
- [ ] 4.1 Build passes: `npm run build`
- [ ] 4.2 Lint passes: `npm run lint`

#### Manual
- [ ] 4.3 Picker lists snapshots (count date + submitted time + who), sorted by count date
- [ ] 4.4 "Wypełnij puste" fills only empty; "Nadpisz wszystko" confirms then overwrites
- [ ] 4.5 Order pre-fill banner shows "liczył: X"

### Phase 5: Frontend — permanent top-tab navigation

#### Automated
- [ ] 5.1 Build passes: `npm run build`
- [ ] 5.2 Lint passes: `npm run lint`

#### Manual
- [ ] 5.3 Permanent tab strip visible on phone + laptop (Zamówienia / Remanent), active state correct
- [ ] 5.4 Navigate orders ↔ inventory via tabs without opening the hamburger
