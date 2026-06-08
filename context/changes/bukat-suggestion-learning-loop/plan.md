# Suggestion Learning-Loop Review (S-03, FR-012) — Implementation Plan

## Overview

A read-only aggregate over the per-line order history so the owner can see where the engine's suggestion was overridden and act on it. Per product: line/order counts, average suggested vs captain-final vs manager-final purchase quantities, average absolute deviation from suggestion, and a reason-code histogram — sorted worst-deviation first. Backend aggregate endpoint → owner/manager review view. Two phases.

## Current State Analysis

- `order_lines` already records the learning asset per line: `suggested_qty_purchase`, `captain_final_qty_purchase`, `manager_final_qty_purchase`, `delta_vs_suggestion_pct`, `reason_code`, `product_id` (`models.py` OrderLine). Persisted only in sheet mode; `sheets.load_order_lines()` reads them (used today by `manager_queue` to count deviations).
- No aggregate/review endpoint exists — the only consumer surfaces are per-order (`manager_order_detail`, `captain_order_detail`). The learning loop needs a CROSS-order, per-product roll-up.
- Manager read pattern: `manager_queue` uses `_: None = Depends(require_manager)`, `if backend is not sheets: return []`. The new endpoint mirrors this (manager auth, seed → []).
- `ReasonCode` enum (`models.py`) has 7 values incl. `SYSTEM_SUGGESTION_WRONG` — the strongest "fix the engine/data" signal.
- Frontend: flat routes + `<AuthGate role>`; `ManagerInventoryPage` (just shipped) is the template for a manager read view + the "Remanenty"-style nav link from `ManagerPage`.

### Key Discoveries
- This is a pure read/aggregate — the per-line history already exists; no schema change, no write path. Matches the roadmap's "thin build that reads the present per-line history."
- `manager_final_qty_purchase` is `0` until an order is dispatched; the average is computed over all lines (a 0 means "manager hasn't changed it"), surfaced honestly rather than filtered.

## Desired End State

A Manager/owner opens `/manager/suggestion-review` (linked from the Manager workspace) and sees a table, one row per product, sorted by average absolute deviation (worst suggestions first): product name, # lines, avg suggested → avg captain → avg manager (purchase units), avg deviation %, and the reason codes given (with `SYSTEM_SUGGESTION_WRONG` highlighted). Seed/off-sheet degrades to an empty state. The owner uses this to decide which Bukat master-data rows to correct (out of band).

Verify: backend `pytest` + `ruff` green; frontend `build` + `lint` green; e2e seed-degrade (empty state, nav). Positive sheet-mode path deploy-gated.

## What We're NOT Doing

- **No auto-correction of master data / the engine** — suggest-only governing rule holds; the review only surfaces signal, the owner edits the sheet.
- **No new persistence / schema change** — reads existing `order_lines`.
- **No per-supplier filter in v0** — `order_lines` carries `product_id`, not `supplier_id`; the pilot data is Wola×Bukat, so the all-lines aggregate IS the Bukat signal. (Supplier join is a future enhancement.)
- **No time-series / charts** — a sorted table is the v0 review surface.
- **No mockup-approval gate** — autonomous run; the view mirrors `ManagerInventoryPage`.

## Implementation Approach

Backend aggregate first (synthetic-data unit tests), then the review view. All reads through `_choose_backend()`; Pydantic models at the boundary; seed → []. Frontend: apiClient-only fetch, i18n-only copy.

## Phase 1: Backend — suggestion-review aggregate

### Overview
Roll up `order_lines` per product into a review model and expose it to the Manager. *(FR-012 backend)*

### Changes Required

#### 1. Model
**File**: `supply-os-v1/app/models.py`
**Contract**: new `SuggestionReviewItem` = `product_id, product_name_pl: str, product_category: str, inventory_unit: str, line_count: int, order_count: int, avg_suggested_qty_purchase: float, avg_captain_final_qty_purchase: float, avg_manager_final_qty_purchase: float, avg_abs_deviation_pct: float, reason_code_counts: dict[str, int]`.

#### 2. Endpoint
**File**: `supply-os-v1/app/main.py`
**Contract**: `GET /api/manager/suggestion-review` → `list[SuggestionReviewItem]`. `_: None = Depends(require_manager)`. `backend = _choose_backend()`; `if backend is not sheets: return []`; `try: lines = backend.load_order_lines() except sheets.WorksheetNotFound: return []`; join `load_products()` for names; group lines by `product_id`; per group compute counts, the three averages (over all lines; round), `avg_abs_deviation_pct` = mean of `abs(delta_vs_suggestion_pct)` over lines where it is not None (0.0 if none), and a `reason_code_counts` histogram (enum value → count, only non-null). Sort by `avg_abs_deviation_pct` desc, tie-break by `line_count` desc. Extract a pure helper `_aggregate_suggestion_review(lines, products_by_id)` for direct unit testing.

#### 3. Tests
**File**: `supply-os-v1/tests/test_suggestion_review.py` (new)
**Contract**: aggregate correctness (averages, abs-deviation mean skipping None, reason histogram), per-product grouping + order_count (distinct order_ids), sort by deviation desc, product-name join (+ id fallback), seed → [], `WorksheetNotFound` → [], manager-only auth (captain token rejected, no token 401). Also unit-test `_aggregate_suggestion_review` directly with hand-built lines. Synthetic data only.

### Success Criteria

#### Automated Verification:
- Backend tests pass: `cd supply-os-v1 && python -m pytest`
- Lint passes: `cd supply-os-v1 && ruff check .`

#### Manual Verification:
- `curl` `/api/manager/suggestion-review` (manager token) returns per-product rows sorted by avg deviation desc; captain token rejected; seed mode → [].

---

## Phase 2: Frontend — suggestion-review view

### Overview
A Manager/owner table at `/manager/suggestion-review` (linked from the workspace) showing the per-product learning signal. *(FR-012 frontend)*

### Changes Required

#### 1. Types + apiClient
**File**: `frontend/src/types.ts`, `frontend/src/apiClient.ts`
**Contract**: add `SuggestionReviewItem` interface (`reason_code_counts: Record<string, number>`). Add `api.managerSuggestionReview()` → `SuggestionReviewItem[]` (role `"manager"`).

#### 2. Review page
**File**: `frontend/src/pages/manager/ManagerSuggestionReviewPage.tsx` (new)
**Contract**: header (back to `/manager`) + a table sorted as returned (worst deviation first): columns product (name + category), # lines, avg suggested → captain → manager (purchase units), avg deviation % (formatted, emphasized when high), and reason codes (compact chips; `SYSTEM_SUGGESTION_WRONG` highlighted). A short explainer line ("wyższe odchylenie = kandydat do poprawy danych"). Loading / empty / error states like `ManagerInventoryPage`.

#### 3. Route + nav + copy
**File**: `frontend/src/App.tsx`, `frontend/src/pages/ManagerPage.tsx`, `frontend/src/i18n/strings.ts`
**Contract**: add `<Route path="/manager/suggestion-review" ...>` (AuthGate manager). Add a nav link in the `ManagerPage` header ("Sugestie"). Add `manager.review.*` keys (title, navLink, back, explainer, columns, reason labels reuse `reason.*` where present, empty, fetchError) in pl + en.

### Success Criteria

#### Automated Verification:
- Build passes: `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run build`
- Lint passes: `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run lint`

#### Manual Verification:
- `/manager/suggestion-review` shows per-product rows sorted by deviation; reason chips render; `SYSTEM_SUGGESTION_WRONG` highlighted.
- Reachable via the "Sugestie" link; seed mode shows a graceful empty state.

---

## Testing Strategy
- **Backend (pytest)**: `_aggregate_suggestion_review` unit correctness + endpoint (sort, join, seed/worksheet degrade, manager-only auth). Synthetic data — never reads a live sheet or places an order.
- **Frontend**: build + lint; e2e seed-degrade (empty state + nav). Positive path deploy-gated.

## Migration Notes
No schema change. Reads existing `order_lines`. Sheet-mode review runs at the deploy gate against real pilot data.

## References
- Roadmap S-03; PRD FR-012, Success Criterion 3.
- Per-line history: `models.py` OrderLine; `sheets.load_order_lines()`; `manager_queue` deviation counting.
- View template: `frontend/src/pages/manager/ManagerInventoryPage.tsx`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <sha>` when a step lands.

### Phase 1: Backend — suggestion-review aggregate

#### Automated
- [x] 1.1 Backend tests pass: `python -m pytest`
- [x] 1.2 Lint passes: `ruff check .`

#### Manual
- [ ] 1.3 curl /manager/suggestion-review sorted by avg deviation desc; captain rejected; seed → []

### Phase 2: Frontend — suggestion-review view

#### Automated
- [ ] 2.1 Build passes: `npm run build`
- [ ] 2.2 Lint passes: `npm run lint`

#### Manual
- [ ] 2.3 /manager/suggestion-review shows per-product rows sorted by deviation; reason chips; SYSTEM_SUGGESTION_WRONG highlighted
- [ ] 2.4 Reachable via "Sugestie" link; seed mode shows graceful empty state
