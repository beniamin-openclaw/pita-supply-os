---
date: 2026-06-08T20:46:52+0200
researcher: Beniamin (via Claude)
git_commit: 8f2499c3ee5ca3fbb6fcd99736afa873ffd5ed3f
branch: main
repository: pita-supply-os
topic: "Inventory-count follow-ups (FR-020…024): editable date, 'counted by' attribution, last-count banner, always-on pre-fill button, snapshot picker"
tags: [research, codebase, inventory, prefill, sheets, captain]
status: complete
last_updated: 2026-06-08
last_updated_by: Beniamin (via Claude)
---

# Research: Inventory-count follow-ups (FR-020…024)

**Date**: 2026-06-08T20:46:52+0200
**Researcher**: Beniamin (via Claude)
**Git Commit**: 8f2499c3ee5ca3fbb6fcd99736afa873ffd5ed3f
**Branch**: main
**Repository**: pita-supply-os

## Research Question

Ground the planned `inventory-count-followups` slice before writing a plan. The slice carries six items surfaced by the 2026-06-08 Wola×Bukat demo feedback (parallel inventory track — does NOT touch the Bukat pilot):

- **FR-020** — editable count date (date-picker, default today, reject future).
- **FR-021** — lightweight "counted by" free-text attribution → existing `count_user` field (NOT per-user auth).
- **FR-022** — "last count: who/when" reassurance banner on the inventory screen.
- **FR-023** — promote the inventory pre-fill (FR-017) to an always-available "fill from inventory" button.
- **FR-024** — let the Captain choose WHICH inventory snapshot to pre-fill from (not only the latest).
- **Follow-up** — improve discoverability of the inventory entry point (navigation).

Scope chosen by the operator: **"Slice + risk surface"** — the six items plus the two real footguns (worksheet column schema / migration, and the seed-vs-sheet split).

## Summary

**The change is smaller and lower-risk than it first looked, because the two metadata fields we most need already exist end-to-end.**

1. **No worksheet migration needed for FR-020/021/022.** `count_date` and `count_user` are already columns in the live `inventory_counts` Google Sheet tab (created + verified column-for-column when S-06 shipped). They already exist on the `InventoryCount` Pydantic model too. The endpoint simply **hardcodes** them (`count_date = today`, `count_user = location_id`) and the submit request never carries them. So FR-020/021 = add request fields + stop hardcoding; FR-022 = surface `count_user` through the latest-snapshot response (currently omitted). **Caveat:** the live sheet's header row is not in the repo — confirm it once before relying on it.

2. **FR-023 (always-on button) is mostly a UI re-wire.** The fill engine `acceptPrefill` already exists, is idempotent, and is safe to re-press (it fills only empty stock fields, never clobbers a typed value — including a deliberate `0`). Promotion = expose it as a persistent button instead of a one-shot dismissable banner.

3. **FR-024 (snapshot picker) is the only real build.** The backing data functions `load_inventory_counts()` and `get_inventory_count(count_id)` already exist in `sheets.py` but are **not exposed by any route**. Work = two thin read routes (through `_choose_backend()`, with seed-degrade + WorksheetNotFound→503), two response models, two apiClient methods, a summary TS type, and a picker UI.

4. **Risk-surface confirmed:** inventory persistence is **sheet-only** — `seed_loader` has zero inventory functions, so in dev/seed mode any list/latest endpoint returns null/empty. The FR-024 picker must degrade gracefully (empty state in dev), never 500.

5. **Consistency:** all five FRs are clean extensions of FR-016/FR-017 and the PRD Non-Goals — but two need a one-line guard in the plan: **FR-021** must be stated as free-text/self-declared/unverified (not auth), and **FR-024** must be stated as an intentional widening of FR-017's "latest snapshot," still preserving the opt-in + named-date/time + fill-empties-only safeguards.

## Detailed Findings

### Backend — endpoints (`supply-os-v1/app/main.py`)

All three inventory endpoints use `require_captain` (location derived from token; no cross-location access). Section starts `main.py:1407`.

- **`captain_inventory_products`** (`GET /api/captain/inventory/products`, `main.py:1448-1483`) — lists active products configured for the location; reads `seed_loader` directly (master-data, both backends serve identically); skips discontinued SKUs (`main.py:1473`).
- **`captain_inventory_submit`** (`POST /api/captain/inventory/submit`, `main.py:1485-1580`) — builds `InventoryCountLine` rows only for entered products (blank = omitted, `main.py:1525-1542`). **Hardcodes** `count_date = today` (`main.py:1514, 1545`) and `count_user = location_id` (`main.py:1546`); the request body has neither field. Persists via `_persist_inventory_count` → seed mode has no `append_inventory_count*` so it logs a warning and returns `False` (`main.py:1426-1432`, surfaced warning `1567-1570`). Sheet-mode-without-tabs → catches `sheets.WorksheetNotFound` → **503** "create the tabs" (`main.py:1554-1565`).
- **`captain_inventory_latest`** (`GET /api/captain/inventory/latest`, `main.py:1581-1632`) — seed mode returns `None` immediately (`main.py:1599-1600`); else newest by `count_submitted_at` (fallback `count_date` at UTC midnight, `main.py:1607-1613`). **Returns `InventoryLatestResponse` WITHOUT `count_user`** — the field is persisted but never surfaced here. This is the FR-022 blocker.

### Backend — models (`supply-os-v1/app/models.py`)

- **`InventoryCount`** (`models.py:396`) already has `count_date: date` (required), `count_user: Optional[str] = None`, `count_submitted_at: Optional[datetime] = None`. Populated server-side, not from client.
- **`InventoryCountSubmitRequest`** (`models.py:415-420`) carries **only** `lines` (min_length=1) + `notes`. No `count_date` / `count_user`. → FR-020/021 add fields here + change the construction site (`main.py:1544-1552`).
- **`InventoryLatestResponse`** (`models.py:436-444`): `count_id, count_date, count_submitted_at, line_count, lines`. **No `count_user`** → FR-022 adds it (Optional, so mirror as `count_user?` in TS).
- **`InventoryLatestLine`** (`models.py:429`): `product_id, current_stock_qty_base, count_comment`.

### Backend — sheets adapter behavior on missing columns (`supply-os-v1/app/sheets.py`)

The critical mechanic for the migration question:

- **On WRITE — silently dropped.** `_model_to_row` (`sheets.py:356-380`) iterates the worksheet's actual header row (`_get_column_order`), not the model fields. A model field with no matching header column is never emitted (`sheets.py:374-376`). A header with no model field emits `""`.
- **On READ — header validation, then default.** `_validate_headers` (`sheets.py:219-244`) requires columns only for *required* model fields (`field.is_required()`); fields with a default are optional and may be absent → value stays at the model default. A missing *required*-field column → `ConfigDriftError`.
- **Consequence:** adding a field to the model is necessary but **not sufficient** — a value persists only if a matching column exists in the live header row. `count_date` is required (its column is mandatory); `count_user` is optional (silently blank if column absent).

### Backend — worksheet schema + MIGRATION VERDICT

No live schema artifact in the repo (these are operator-provisioned Google Sheet tabs, not seed CSVs):

- `docs/pita-supply-os-v1/seed/` has only master-data CSVs — **no** `inventory_counts.csv` / `inventory_count_lines.csv`.
- `DATA_MODEL.md:226` lists these tables under "What's NOT in v0 / Phase 3 — remanent module" (stale w.r.t. the shipped S-06 feature).
- The de-facto column contract (two sources agree):
  - S-06 Migration Notes — `context/archive/2026-06-05-inventory-count/plan.md:248-253`: `inventory_counts` = `count_id, location_id, count_date, count_user, count_submitted_at, line_count, notes`; `inventory_count_lines` = `count_line_id, count_id, product_id, current_stock_qty_base, count_comment`.
  - Test constants `INVENTORY_COUNT_HEADERS` / `INVENTORY_COUNT_LINE_HEADERS` (`tests/test_inventory_sheets.py:20-35`) — match exactly.
  - S-06 closeout: tabs "created in the live sheet; headers verified column-for-column via the Drive connector" (`2026-06-05-inventory-count/change.md:19`).

**VERDICT:**
- **`count_date`** — already a live column → **NO migration.** FR-020 is a behavior change in `main.py` (accept + validate a request date), not a column add.
- **`count_user`** — already a live column → **NO migration.** Currently written as a location proxy; surfacing/repurposing it is a model/endpoint change.
- **Any genuinely new field** (none currently in scope) → would require BOTH a model change AND a live-worksheet column add.
- **Caveat:** the repo cannot verify the actual live header row; recommend a one-time confirm before the destructive assumption.

### Backend — seed vs sheet split

`seed_loader.py:72-92` implements only the five master-data loaders — **zero** inventory functions. Inventory persistence is **sheet-only**: submit → in-memory + warning in seed mode; `captain_inventory_latest` → `None` in seed mode. **Implication:** a FR-024 "list snapshots" picker is empty in dev/seed mode (mirrors `captain_orders` / `manager_queue` degrading off-sheet). Plan the empty-state.

### Backend — FR-024 endpoint readiness

- `load_inventory_counts()` and `get_inventory_count(count_id)` already exist in `sheets.py`; both used internally by `captain_inventory_latest` (`main.py:1603, 1615`) but **exposed by no route**.
- The only inventory routes today are `/inventory/products`, `/inventory/submit`, `/inventory/latest`.
- `_choose_backend()` seam rule applies (lessons.md): new routes call `_choose_backend()` and branch on backend (`if backend is not sheets: return []`), never `import sheets` directly. → FR-024 = two thin read routes + response models + seed-degrade guard + WorksheetNotFound→503. No new sheets-adapter code for the happy path.

### Backend — tests (`supply-os-v1/tests/`)

- `test_inventory_sheets.py` — adapter unit tests (gspread mocked at `_open_worksheet`); defines the header-contract constants.
- `test_inventory_submit.py` — `/products` + `/submit` endpoint tests; sheet mode simulated via `_patch_sheet_master_data` (flip `data_backend` to SHEET, stub `is_configured`, point sheet reads at `seed_loader`); `WorksheetNotFound`→503 covered.
- `test_inventory_latest.py` — `/latest` tests incl. newest-selection, location-scoping, null-in-seed, `count_submitted_at`→`count_date` fallback; `_activate_sheet` helper.
- **conftest.py** sets env BEFORE any `app.config` import via `os.environ.setdefault`: captain tokens `WOLA:test_wola_token,KEN:test_ken_token`, manager `test_manager_token`, `SUPPLY_OS_DATA_BACKEND=seed`, and **blanks all three Google cred vars** so the suite never touches the live sheet. WOLA has settings; KEN has none (used for empty/400 cases).

### Frontend — inventory count screen (`frontend/src/pages/captain-mp/InventoryCountPage.tsx`, 505 lines)

- Loads products via `api.inventoryProducts()` on mount (150-181); seeds blank per-product line map; draft-resume via `loadDraft("__inventory__")` (`DRAFT_KEY` line 23).
- Per-product numeric stock input (`handleStockChange` 193-201) + per-line free-text `count_comment` (`handleCommentChange` 203-211); collapsible category sections (245-268).
- **No order-level notes field** in the UI — `handleSubmit` hardcodes `notes: ""` (line 274). **No date state at all today.**
- Submit (`handleSubmit` 270-298): `countedLines` = only products with non-blank stock; `api.inventorySubmit({ lines, notes: "" })`; on success clears draft + resets to blank (append-only re-count).
- **Insert points** — the header block at **lines 314-318** (`<h2>` + `<p>`) is the natural home for: (a) count-date `<input type="date">` (new state `countDate`, default today), (b) "counted by ___" text input (new state `countedBy`), (c) "last count: who/when" banner (above the draft banner at line 320). The amber draft banner (320-348) is a styling template.
- **FR-022 wrinkle:** this page does NOT fetch `inventoryLatest()` today (only `CaptainMP` does) — the banner needs a new fetch here, AND `count_user` added to `InventoryLatestResponse`.

### Frontend — pre-fill banner (`frontend/src/pages/captain-mp/CaptainMP.tsx`)

- State `latestSnapshot` (line 54), `prefillDismissed: Set<string>` per-supplier (line 55); fetch once on mount via `.inventoryLatest()` (88-101), **silent on error** (prefill must never block ordering).
- `acceptPrefill` (231-252): fills **only** order lines where the product is in the snapshot AND `current_stock_qty_base === ""` (a typed value — incl. `0` — is preserved); adds supplier to `prefillDismissed`; toasts filled count. `skipPrefill` (254-257) just dismisses.
- `showPrefillBanner` (371-377): true only when `latestSnapshot` exists + active supplier + not dismissed + not loading + `orderableItems.length > 0` + ≥1 snapshot line maps to a loaded order line. Render 436-462, names source via `prefillTime` (365-369).
- **FR-023 delta:** add a persistent button (e.g. in `StickyActionBar` / `ContextStrip`) calling `acceptPrefill` regardless of `prefillDismissed`; fill-empties-only makes a re-press a safe no-op. Disable/hide when `latestSnapshot == null`. New i18n key (e.g. `captain.prefillButton`).
- **FR-024 delta:** replace single `latestSnapshot` with `availableSnapshots` + `selectedSnapshotId`; `acceptPrefill` reads from the *selected* snapshot's lines; new picker UI (`<select>` of date/time/counted-by); `prefillTime` generalizes to "selected snapshot time"; the mount effect fetches the list, with a lazy detail fetch per selection.

### Frontend — types / apiClient / i18n

- **types.ts** inventory block 102-142. `InventoryLatestResponse` (118-124) needs `count_user?: string | null`. No `InventoryCountSummary` type exists → FR-024 needs one (`count_id, count_date, count_submitted_at, count_user, line_count`). `InventoryCountSubmitRequest` (132-135) needs optional `count_date?` / `count_user?` for FR-020/021.
- **apiClient.ts**: existing `inventoryProducts` / `inventorySubmit` / `inventoryLatest`. FR-024 adds `inventoryCounts(params?)` (list, mirror `captainOrders` limit pattern) + `inventoryCount(count_id)` (get-by-id). FR-020/021 thread new fields into `inventorySubmit`'s request. Pattern: flat `api` record of named thunks, explicit `Role`, `URLSearchParams`, `encodeURIComponent`.
- **i18n strings.ts**: inventory keys 503-576, prefill keys 577-586 (`captain.prefillBannerTitle/Accept/Skip/Applied`). `STRINGS ... as const satisfies Record<string, StringEntry>`; `StringKey = keyof typeof STRINGS`. Dynamic keys must cast (`as Parameters<typeof t>[0]` — see `OrderDetailPage.tsx:181`, `ReasonPicker.tsx:16-17`). New keys are static literals → no cast. Add pl + en for every new string.

### Frontend — navigation / discoverability

- Route `App.tsx:57-64`: `/captain-v2/inventory-count` → `<InventoryCountPage>` under `<AuthGate role="captain">`.
- **Only entry point** = hamburger menu: `CaptainMP` passes `onShowInventory` → `Header` (`components/Header.tsx:32`) → `HamburgerMenu` (`components/HamburgerMenu.tsx:88-100`, item shown only when `onShowInventory` provided). Buried two levels deep — the demo user had to be told "menu → inventory."
- Legacy `/captain` (`pages/CaptainPage.tsx`) has **no** inventory wiring — only `/captain-v2` (MP) exposes it.
- **Suggestion:** a first-class button on `CaptainMP` near `SupplierPicker` / `ContextStrip` (394-403) or an inline icon-button in `Header`'s pill row (35-51). Pairs naturally with the FR-023 "fill from inventory" button — one toolbar can both *launch a count* and *pull from a count*.

## Code References

- `supply-os-v1/app/main.py:1485-1580` — `captain_inventory_submit` (hardcodes count_date/count_user; FR-020/021 site).
- `supply-os-v1/app/main.py:1544-1552` — `InventoryCount` construction (the hardcode to change).
- `supply-os-v1/app/main.py:1581-1632` — `captain_inventory_latest` (FR-022: add count_user; FR-024 reuses load/get).
- `supply-os-v1/app/models.py:396-407` — `InventoryCount` (count_date/count_user/count_submitted_at already present).
- `supply-os-v1/app/models.py:415-420` — `InventoryCountSubmitRequest` (FR-020/021 add fields).
- `supply-os-v1/app/models.py:436-444` — `InventoryLatestResponse` (FR-022 add count_user).
- `supply-os-v1/app/sheets.py:356-380` — `_model_to_row` (writes strictly by header row).
- `supply-os-v1/app/sheets.py:219-244` — `_validate_headers` (optional fields may omit columns).
- `supply-os-v1/app/sheets.py` — `load_inventory_counts` / `get_inventory_count` (exist, unexposed → FR-024).
- `supply-os-v1/app/seed_loader.py:72-92` — no inventory functions (sheet-only).
- `frontend/src/pages/captain-mp/InventoryCountPage.tsx:314-318` — header insert point (date/counted-by/banner).
- `frontend/src/pages/captain-mp/CaptainMP.tsx:231-252` — `acceptPrefill` (FR-023 reuse engine).
- `frontend/src/pages/captain-mp/CaptainMP.tsx:371-377,436-462` — banner show-condition + render.
- `frontend/src/types.ts:102-142` — inventory TS types.
- `frontend/src/apiClient.ts` — inventory api methods (FR-024 additions).
- `frontend/src/i18n/strings.ts:503-586` — inventory + prefill copy.
- `frontend/src/App.tsx:57-64`, `components/HamburgerMenu.tsx:88-100` — inventory nav entry.

## Architecture Insights

- **The data-layer seam is the contract** (lessons.md): every new persistence/read route goes through `_choose_backend()`; the established degrade pattern is `if backend is not sheets: return [] / None`. FR-024 follows this exactly.
- **The sheet's header row is the real schema** — model fields are necessary but not sufficient. The "already a live column" status of count_date/count_user is what makes FR-020/021/022 migration-free.
- **Pre-fill safety is a settled, lesson-grade pattern**: name the source date/time, fill empties only, never clobber typed input, opt-in. FR-023/024 must inherit all four properties.
- **Append-only is inviolable**: never add an "edit a saved count" path. FR-020 sets the date on a *new* submit; FR-024 only *reads* past snapshots.

## Historical Context (from prior changes)

- `context/archive/2026-06-05-inventory-count/` (S-06, FR-015/016) — append-only snapshots; Migration Notes with the live column list (`plan.md:248-253`); `count_user = location_id` proxy (`plan.md:133`).
- `context/archive/2026-06-08-order-prefill-from-inventory/` (S-07, FR-017) — opt-in double-safeguard; fill-empties-only adopted as a stronger reading and promoted to a repo lesson (`reviews/impl-review.md:59`); seed-mode null + recency fallback edge cases (`notes/edge-cases.md`).
- `context/archive/2026-06-07-inventory-category-sections/` — collapsible category sections on the count screen.
- `context/archive/2026-06-08-screens-design-audit/` — flagged the "blank = not counted / 0 = real zero" rule as never explained in the UI (cluster-7 item C7-2) — pre-fill-adjacent; FR-023/024 surfacing pre-fill more prominently should not worsen this.
- `context/foundation/roadmap.md` — Stream C "Location inventory" (`S-06 → S-07 · S-08`). Next free slice id = **S-10**. New change fits as one slice S-10 (PRD refs US-02, FR-020…024; prereq S-06+S-07).

## Open Questions

1. **Live sheet header confirm** — repo can't verify the live `inventory_counts` header row carries `count_date` + `count_user`; confirm once before relying on migration-free persistence. (Low risk — verified at S-06 closeout — but worth a 10-second check.)
2. **FR-024 sort key** — list snapshots by `count_submitted_at` (true recency) or by `count_date` (operator-meaningful, but back-dating via FR-020 could reorder display). Decide explicitly in the plan; show both date + submitted-at in the picker to avoid ambiguity.
3. **FR-023 re-press semantics** — keep fill-empties-only (safe no-op on re-press) vs offer an explicit "re-pull / overwrite" variant. Default to empties-only; a "force overwrite" is a separate, confirm-gated action if wanted.
4. **Blank-vs-0 copy gap (C7-2)** — address the "blank = not counted, 0 = real zero" explanation now that pre-fill is more prominent, or leave to its own cluster-7 item? (Out of this slice's core FRs, but adjacent.)

## Related Research

- `context/archive/2026-06-08-order-prefill-from-inventory/` (S-07 research + edge-cases ledger) — the canonical pre-fill behavior this slice extends.
- `context/archive/2026-06-08-screens-design-audit/research.md` — inventory screen critique + cluster-7 follow-ups.
