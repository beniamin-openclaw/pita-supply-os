<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Order `ordered_by` ("who orders")

- **Plan**: context/changes/order-ordered-by/plan.md
- **Scope**: Full plan (Phases 1–3)
- **Date**: 2026-06-24
- **Verdict**: APPROVED (after fixes — F1 fixed, F2 accepted+follow-up)
- **Findings**: 0 critical, 2 warnings (both resolved/accepted), 1 observation (documented)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS (after F1 fix) |
| Success Criteria | PASS |

## Scope

Working-tree diff (no commits — local-only run): 12 files modified + 1 new migration, exactly matching the plan's file list. Plan-drift sub-agent: **all 15 planned items MATCH** — no drift, no missing items, no scope creep; the documented `orders.csv`/`seed_loader.py` deviation is correctly implemented (those paths don't exist).

## Success Criteria

- Backend `python3 -m pytest`: **394 passed** (incl. 2 new 422 tests + queue/detail passthrough), ruff clean.
- Frontend `npm run build` + `npm run lint` + `npm run test`: green (77 vitest tests).
- Migration `0005_add_ordered_by.sql`: idempotent, percent-sign-free, NOT applied.

## Findings

### F1 — Submit button stayed enabled when `ordered_by` was blank

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/captain-mp/CaptainMP.tsx, components/StickyActionBar.tsx
- **Detail**: The initial implementation gated submit via a `requestSubmit` toast (button stayed visually enabled), unlike siblings `InventoryCountPage` / `ReceiveDeliveryPage` which DISABLE the submit button until the attribution name is filled.
- **Fix**: Added an `orderedByMissing?: boolean` prop to `StickyActionBar`, folded it into `submitDisabled`, and added a status-line hint (`captain.orderedByRequired`) so the disabled state is explained instead of showing a misleading green "ready". `CaptainMP` now passes `orderedByMissing={!orderedBy.trim()}`, reverts `onSubmit` to `openConfirm`, and removes the redundant `requestSubmit` callback. Re-verified: lint/build/test green; focused re-review confirmed no dead code, no hook-deps issues, no regression.
- **Decision**: FIXED

### F2 — `min_length=1` allows whitespace-only attribution via direct API

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Data-safety)
- **Location**: supply-os-v1/app/models.py — `CaptainSubmitRequest.ordered_by`
- **Detail**: `min_length=1` counts characters, so a direct API caller (authenticated captain) can POST `"ordered_by": "   "`. The frontend trims before sending, so the UI path is safe. This is a **pre-existing gap shared identically by `count_user` and `received_by`** — not a regression.
- **Decision**: ACCEPTED + FOLLOW-UP. Rationale: the explicit goal of this change (per the user's WZÓR/spec) is to mirror `received_by`/`count_user` exactly. Fixing only `ordered_by` would break that mirror and create a new inconsistency; fixing the class properly means touching the two out-of-scope sibling fields (a behavior change to other features). Left consistent here and spawned a follow-up task (`task_3d38cb3b`) to add `strip_whitespace`/validator across all three attribution fields in a dedicated change.

### F3 — Required-hint appears in two places when name is blank

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/captain-mp/CaptainMP.tsx (field helper) + components/StickyActionBar.tsx (status-line hint)
- **Detail**: When stock is filled but the name is blank, `captain.orderedByRequired` shows both under the field and in the sticky status line.
- **Decision**: ACCEPTED (intentional). The status-line hint is necessary: without it the bar would show the green "readyToSubmit" state next to a disabled button (contradictory). The mild duplication is reinforcing and consistent with how `InventoryCountPage` surfaces its analogous field.

## Notes

- Wipe-risk traced and clean: `ordered_by` is set once at submit and never appears in any update payload (`captain_order_edit`, `manager_order_save`, `manager_dispatch`, `replace_order_lines_atomic`) — the captain edit cannot null it.
- Production-safety: adding `"ordered_by"` to `_ORDER_COLUMNS` makes `append_order` write the column, so prod Supabase needs the migration applied before deploy. Documented in the migration header and the plan's Migration Notes; flagged for closeout. Local run uses seed/mock backends only.
