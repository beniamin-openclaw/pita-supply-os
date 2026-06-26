# Preview notes — add-product-to-order (UI-visible change)

Date: 2026-06-26

This change adds a searchable "+ Dodaj produkt" picker on two screens:
- **Captain edit** (`/captain-v2/.../edit` → OrderEditPage) — below the product cards.
- **Manager claimed order** (`/manager` → OrderDetailPane) — below the line table,
  shown only when `editable` (status manager_claimed) and something is addable.

## Why the interactive harness preview was not run

The add-product flow is **data-dependent on a persistent backend**:
- The Manager add-line path requires a real `manager_claimed` order; the seed/test
  backend returns **503** for `manager_order_detail` / add-line (`_is_persistent` gate),
  so the flow cannot be exercised in local seed mode.
- The only persistent backends are the **production** Sheets/Supabase stores. Pointing a
  local preview at prod to exercise add-line would risk the hard rule (no real orders /
  no touching prod data from a test) — so it was deliberately NOT done.

Per the autonomous-workflow Phase 6.2 fallback, the verification done instead:
- **Type/compile**: `tsc -b` (in `npm run build`) typechecks the new `AddProductPicker`
  props, the `availableToAdd`/`onAddLine` wiring through ManagerPage → OrderDetailPane,
  the captain OrderEditPage picker wiring, and the two new `apiClient` methods. Clean.
- **Lint**: eslint clean (incl. react-hooks rules — AddProductPicker calls all hooks
  unconditionally before its `items.length === 0` early return).
- **Unit/route tests**: 83 frontend + 417 backend (13 new add-line route tests) green.
- **Adversarial + impl-review**: confirmed the dispatch email skips zero-qty lines (a
  forgotten added line never reaches a supplier) and that `handleAddLine` MERGES into the
  draft map (does not wipe unsaved manager edits).

## Live interactive verification (deferred — beyond this run's stop point)

Interactive end-to-end verification on the picker is the plan's **Phase 4** (deploy →
live-test on prod), which is intentionally **out of scope** for this autonomous run: the
run stops just before main push / archive, per the request. The user's established
pattern is to live-test on deployed prod after the change is on `main` and the new bundle
is confirmed live. Suggested post-deploy live checks:
- Captain: open an editable order → "+ Dodaj produkt" → pick a not-yet-ordered product →
  card appears with blank stock/qty → adjust → submit → reopen, line persists.
- Manager: claim an order → "+ Dodaj produkt" → pick a product → row appears at qty 0 →
  set manager qty on it AND another line → Save → both persist (no edit lost) → dispatch
  → the 0-qty line (if left at 0) is absent from the supplier email.
