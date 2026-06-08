<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Manager Inventory View + Captain Inventory History (S-08, FR-018/FR-019)

- **Plan**: context/changes/inventory-manager-view/plan.md
- **Scope**: All phases (1–3)
- **Date**: 2026-06-09
- **Verdict**: NEEDS ATTENTION (1 warning — low impact)
- **Findings**: 0 critical · 1 warning · 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Stale detail fetch in ManagerInventoryPage (no cancel)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency / Safety & Quality
- **Location**: frontend/src/pages/manager/ManagerInventoryPage.tsx:61–73
- **Detail**: `selectCount` issues a fire-and-forget `api.managerInventoryCount()` with no cancellation guard: if the user taps a second row before the first fetch returns, both `.then(d => setDetail(d))` callbacks race and the later-to-resolve wins regardless of which row was tapped last. `InventoryHistoryPage` (sibling Captain page) has the same pattern — the cancel guard IS present for the `inventoryProducts` fetch (line 56–70) but ABSENT from `selectCount` (line 73–85) in both pages.
- **Fix**: Mirror the cancelled pattern from the inventoryProducts fetch into both `selectCount` callbacks, or use an AbortController ref. In practice: `let cancelled = false; api.managerInventoryCount(countId).then(d => { if (!cancelled) setDetail(d); }).catch(e => { if (!cancelled && e.status !== 401) setDetailError(e.detail); }).finally(() => { if (!cancelled) setDetailLoading(false); }); return () => { cancelled = true; };` — but since selectCount is a useCallback (not an effect), the cleanup needs to live in a ref.
- **Decision**: PENDING

### F2 — INVENTORY_PATH constant orphaned in CaptainTabs

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/captain-mp/components/CaptainTabs.tsx:12,21
- **Detail**: `const INVENTORY_PATH = "/captain-v2/inventory-count"` is still used only as the tab's `to` target (line 44). The active-match was correctly broadened to `pathname.startsWith("/captain-v2/inventory")` but the constant name now misrepresents scope — it implies all inventory but points to the count subpath only. No behaviour bug.
- **Fix**: Rename to `INVENTORY_COUNT_PATH` to match what it actually is.
- **Decision**: PENDING

### F3 — Plan-mandated commentCol i18n key absent (both views)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/i18n/strings.ts (absent)
- **Detail**: Phase 2 and 3 copy contracts list `commentCol` alongside `productCol`/`stockCol`. Neither `"manager.inventory.commentCol"` nor `"inventory.history.commentCol"` was added. In both pages comments are rendered inline as sub-text under the product name (no column header), which is arguably better UX. Not a bug — a benign scope trim.
- **Fix**: Either add the key for completeness or note the plan as a resolved trim. No code change required unless a column-header variant is needed.
- **Decision**: PENDING

### F4 — InventoryHistoryPage: locationName="" passed to Header

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/captain-mp/InventoryHistoryPage.tsx:204
- **Detail**: `locationName=""` is passed to Header on the list view. The direct sibling `InventoryCountPage` (line 387) does the same — this IS the established pattern for these screens (location name not surfaced in the header on inventory pages). Consistent with its sibling. No action needed; noted for completeness.
- **Decision**: PENDING

## Specific answers to review questions

1. **PLAN ADHERENCE**: All changes present. List endpoint: cross-location ✅, optional location_id ✅, ≤20 ✅, seed→[] ✅, WorksheetNotFound→[] ✅, location_name join ✅. Detail: enriched product names ✅, no location scope ✅, seed→503 ✅, 404 ✅, WorksheetNotFound→503 ✅. No drift, no missing, no unplanned scope.

2. **HARD RULES**: `_choose_backend()` used on both endpoints ✅; both return Pydantic models ✅; Pydantic Optional mirrored as TS optional ✅ (`count_submitted_at?: string|null`, `count_user?: string|null`); no raw fetch in components ✅; all copy via `useT` ✅.

3. **AUTH**: Both Manager endpoints use `Depends(require_manager)` ✅; captain token → 401 (tested and passing) ✅. Captain history reuses Captain endpoints with role "captain" ✅. No cross-role leak.

4. **SAFETY/QUALITY**: Manager list loads counts in one call then joins locations — NO N+1 ✅. `InventoryHistoryPage` product-name fetch has a cancel flag ✅. Removed-product fallback: present for Captain history (badge + id) ✅; present for Manager detail server-side (line.product_id as name) ✅. Detail fetch in both pages: no cancel guard on `selectCount` (F1, WARNING). Read-only throughout ✅.

5. **PATTERN CONSISTENCY**: `ManagerInventoryPage` follows Manager patterns (no CaptainTabs, brand header, back to /manager) ✅. `_enrich_inventory_count_detail` correctly mirrors the `manager_order_detail` line enrichment pattern ✅.

6. **SUCCESS CRITERIA**: Automated items all pass (270/270 backend, ruff clean, frontend build + lint). Deploy-gated manual items (1.3, 1.4, 2.3, 3.3) correctly deferred. E2e items (2.4, 3.4) verified with live app evidence in the plan.
