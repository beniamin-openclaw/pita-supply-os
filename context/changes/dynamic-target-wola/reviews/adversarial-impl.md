<!-- independent agent report, adversarial test of the implementation, 2026-09-07. Fixed after the report: #1 (per-row tolerant loaders), #2 (strict today < requested), #3 (usage at full precision on the card), #4 (_detail_max), #5 (duplicate rows: first wins, logged). #6/#7 accepted as unreachable through typed inputs. -->

# Adversarial test report — dynamic-target-wola

Environment: seed backend, `SUPPLY_OS_DATA_BACKEND=seed`, scratch seed dir at `.../scratchpad/adv/seed` (copy of `docs/pita-supply-os-v1/seed` with `SUP_COCACOLA.delivery_days="Thu"`, `SUP_PAGO.delivery_days="Tue, Sat"`). All repro scripts live under `.../scratchpad/adv/`. No repo files were modified. Baseline: `pytest tests/test_dynamic_target.py tests/test_dynamic_target_routes.py` → 59 passed (confirms these are new gaps, not regressions of covered behavior).

## Findings

### 1. CRITICAL — one malformed `location_product_usage` row anywhere disables dynamic targeting company-wide, silently
`LocationProductUsage.usage_per_day_base`/`safety_days` use `Field(ge=0)` (Pydantic-level validation). `seed_loader._read()` builds every row via `model(**cleaned)` with **no per-row try/except**, so one bad row raises `ValidationError` out of `load_location_product_usage()`. `main._load_usage_safe` catches this with a blanket `except Exception: return {}` — but that `{}` is the **whole location's** usage map, and the load happens *before* the location filter, so a bad row for a totally different location also empties every other location's map.

Repro: added `KEN__BAD,KEN,P024,-1,A,...` (negative usage) to the CSV — a row for **KEN**, not WOLA. Result:
```
GET /api/captain/orderable?supplier_id=SUP_PAGO  (WOLA token)
-> 200, but dynamic items = 0 of 18  (all 18 fall back to mode="static", reason="no_usage")
```
Same result reproduced independently with a negative/`nan`/`"abc"`/empty-string row for WOLA itself. GET/POST never 500 (that part of the design works), but the visible `reason` is `"no_usage"` — indistinguishable from "nobody ever entered usage data" — which will send anyone debugging straight to the wrong place. Given the pilot's only real value-add this change ships is the dynamic target, a single fat-fingered CSV cell (very plausible from manual GoStock-export edits) silently reverts the entire company to static targets with zero user-visible signal, only a DEBUG-level `log.warning(..., exc_info=True)`.

Fix: parse `location_product_usage` rows individually (skip-and-log the bad row, keep the rest), and/or have `_load_usage_safe` filter by `location_id` *before* re-raising is possible, and/or downgrade `reason` for this specific failure mode to something like `"usage_data_corrupt"` so it's distinguishable from `"no_usage"` in logs/UI.

### 2. HIGH — `resolve_delivery_window`'s inclusive `today <= requested` lets a client-chosen date shrink the target below what was shown, flipping an accepted order into a rejected one
`resolve_delivery_window` accepts `requested == today` as a valid delivery date whenever today itself is a delivery weekday (`today <= requested <= today+14`). But `next_delivery_date` — used both for the orderable screen (`requested_delivery_date=None`) and as the fallback here — always starts at offset **1** (never today). This means: the same product, same day, gets a materially different `days_until_delivery` (and hence target) depending purely on whether the client attaches `requested_delivery_date=<today>`.

Repro (engine, Tuesday 2026-09-08, a real Pago delivery day, Wola gyros P024, usage 12.75 kg/day):
```
orderable (requested=None):     target=102.1 kg, days_until=4, delivery=2026-09-12
submit    (requested=today):    target=63.8  kg, days_until=0, delivery=2026-09-08
```
End-to-end via `TestClient` (`_today_warsaw` pinned to that Tuesday), submitting the **exact FE-displayed suggestion** (7 blok = 105 kg, computed from the 102.1 target the Captain saw):
```
requested_delivery_date=None      -> 200 OK
requested_delivery_date=<today>   -> 400 "Line 'P024' deviates 40% from suggestion without reason_code"
```
Identical product, identical quantity, identical stock — one submit path 400s the other doesn't, purely from the date field. This breaks H5's stated guarantee ("the backend accepts client dates only within the trusted window ... so the gate judges the suggestion the Captain saw"). The shipped frontend never sends `today` (`getRequestedDeliveryDate` starts its offset loop at 1), so this isn't reachable through the current UI — but it's reachable by any direct API call, a future FE change, or a retry/replay, and it directly undermines the audited `order_lines.target_stock_qty_base` snapshot's meaning.

Fix: change the window check to `today < requested <= today + 14` (strict, matching `next_delivery_date`'s own exclusive-of-`after` semantics), or explicitly clamp per the plan's stated formula `delivery_date = max(requested, today)` — currently it isn't clamped, it's validated-or-discarded, and the validation is off by one day at the boundary.

### 3. MEDIUM — `ProductCard`'s "math you can verify" line rounds `usage_per_day_base` to 2dp for display, which can silently disagree with the real target
`ProductCard.tsx`: `usage: roundQty(dyn.usage_per_day_base)` (2-decimal round) is shown in `card.dynamicMath`, next to the *exact* `item.target_stock_qty_base`. The backend computes the real target from **full-precision** usage; the DB column is `numeric(12,4)` (4 decimals). A Captain who re-derives `usage_shown × days + safety` from the on-screen numbers gets a different answer from the real target whenever the true usage has ≥3 significant decimal digits and the residual tips a `ceil_unit` grid boundary.

Repro (brute force over usage 0.001–30.000 kg/day × days∈{1,2,3,4,5,7,8,11,15}, safety_days=1, min=0):
- 47,180 / 269,991 combos (17.5%) diverge. Example: usage=0.501 kg/day (displays as "0.50"), days=1, safety=0.6 → real target **1.2**, Captain's re-derivation from the shown "0.50" **1.1**. Same off-by-0.1 pattern recurs across the whole range, not just near zero.
- The current 18-row WOLA seed CSV happens to already carry ≤2-decimal usage values, so it doesn't trigger today — but nothing in the schema, the GoStock pipeline, or `LocationProductUsage` prevents a 3-4-decimal value, and the code comment on this exact line says the point is "so the Captain can argue with the number, not guess at it."

Fix: either display `usage_per_day_base` at full precision (or ≥4dp) on the card, or — better — have the backend put the *displayed* usage precision through the same math it used, so what's shown always reproduces what's shown as the target.

### 4. MEDIUM — order-detail read paths never apply the H1 "effective max ≥ target" fix, so a re-displayed order line can show `max < target`
`_apply_effective_target` (used only by `_build_orderable_items`) raises `max_stock_qty_base` to `max(static_max, target)`. But `_enrich_lines_for_detail` (shared by `captain_order_detail` and the Transport batch detail) and `manager_order_detail`'s own inline copy both do `max_stock_qty_base=setting.max_stock_qty_base if setting else 0` — the **raw static max**, never reconciled against the line's own (possibly dynamic, possibly raised) `target_stock_qty_base`.

Concretely: `OrderEditPage.tsx`'s `overlaySnapshotTargets` correctly fixes this for products still orderable, but for a product removed from the catalog since the original submit (`missing` branch, `lineToItem`), the card gets `target_stock_qty_base` = the correctly-snapshotted (possibly raised) dynamic target, and `max_stock_qty_base` = the current static max — which can be well below it. `computeRowState`'s uncounted branch (`orderBase > item.max_stock_qty_base`) then flags a false "over MAX" pill (forcing a reason) on an order that's nowhere near the real target. Same underlying gap also means the Manager dashboard / receiving screens reading `ManagerOrderLineDetail.max_stock_qty_base` for a historic dynamic-target line never see the effective max that actually gated that submission — the persisted audit trail is incomplete on the max side (only the target is snapshotted, per the known H13/H14 limitation, but the *max* silently reverts to "whatever static max is today").

Fix: either persist an `effective_max` alongside the snapshot (bigger change, same class as H13/H14), or at minimum have `_enrich_lines_for_detail` compute `max(setting.max_stock_qty_base, line.target_stock_qty_base)` the same way `captain_order_edit`'s live gate already does.

### 5. MEDIUM — no duplicate-(location,product) protection on the seed/Sheets path; last row wins silently
Supabase's migration 0018 has `UNIQUE (location_id, product_id)`, but `seed_loader`/(by inspection) `sheets.py` build `usage_by_pid` via a plain dict comprehension over the raw row list — a duplicate row for the same (location, product) silently overwrites the earlier one, winner decided purely by file order, with zero warning.

Repro: appended a second `WOLA,P024` row with `usage_per_day_base=1.0` after the real `12.75` row → `GET /api/captain/orderable` returns `P024` computed from `1.0` (target dropped from ~76.6 to 7.0), 200 OK, no warning anywhere. This is a real backend-parity gap (Supabase would reject the insert; seed/Sheets accept and misbehave), and it's exactly the kind of copy-paste mistake a manual CSV edit produces.

Fix: dedupe (last-wins with a logged warning, or reject) in `seed_loader`/`sheets` the same way the Supabase schema does, or add a load-time uniqueness check in `_load_usage_safe`.

### 6. LOW — `ceil_unit`'s 6-decimal pre-round can round a genuinely-positive value down to 0 instead of up
`ceil_unit(1e-15, "kg")` → `0.0`, not `0.1`. The 6-decimal pre-round (meant to kill float noise like `0.30000000000000004`) also swallows any real value `<5e-8` (after the ×10 scaling) before the ceil ever runs, violating "always rounds up." Unreachable via the `numeric(12,4)` usage column (min representable step 0.0001), so this is a theoretical direct-call issue only, not exploitable through seeded/prod data today. No fix required unless the engine is ever called with untyped/arbitrary floats.

### 7. LOW — `resolve_effective_target`/`resolve_delivery_window` raise an uncaught `TypeError` on a `datetime` instead of `date`
`dt.resolve_effective_target(..., requested_delivery_date=datetime(2026,9,8,10,0), ...)` → `TypeError: '<=' not supported between instances of 'datetime.date' and 'datetime.datetime'`, not caught by the `except (ValueError, OverflowError)` that guards only `compute_dynamic_target`. Confirmed NOT reachable through the real HTTP surface — `CaptainSubmitRequest.requested_delivery_date: Optional[date]` makes FastAPI/Pydantic normalize a zero-time ISO datetime to a plain `date` and reject (422) any non-zero-time datetime string before the engine ever sees it. Purely a latent trap for a future direct/internal caller of the pure module. No user-facing fix needed; note in the module docstring if you want defense-in-depth.

### Not a bug (investigated, ruled out)
Item-3 harness initially flagged 10/934 submits as "mismatches" — all uncounted-stock (blank current-stock) submissions for P024/P026 where the *only* whole-carton quantity (15 kg blok / 12 karton) that reaches the dynamic target necessarily exceeds `effective_max` (which the engine raised to exactly equal the target). Verified the frontend's own uncounted-branch check (`orderBase > item.max_stock_qty_base`) would flag the identical case identically — both sides agree a reason is required. Not a divergence; flagging only as a UX note: tight fractional dynamic targets against large pack sizes make every uncounted PAGO order for these SKUs require a manual reason.

## Sweeps that passed

1. **Property sweep** (`resolve_effective_target`): 3-week window × 6 calendars × 4 usages × 4 mins × 3 units × 7 `requested_delivery_date` shapes = **42,336 combinations, 0 violations** (target≥0, target≥safety, effmax≥target, effmax≥static max, days_until≥0, horizon≥1, kg/int grid respected, never raised).
2. Supplementary robustness sweep — confidence ∈ {A,B,C,a," b ",None,"","D","AB"} × active ∈ {T,F} × safety_days ∈ {0,1}: **36 combos, 0 violations/exceptions**; `supplier=None` degrades cleanly to static.
3. **Rounding edge cases**: 19 hand-picked `ceil_unit` cases (76.5 exact, 0.1×3, float artifacts, 1e-12/1e-9/1e-7 above a grid point, 1e9, negative zero, unit case/whitespace variants) all produced correct grid-snapped results; NaN/±inf correctly raise `ValueError` in all three cases.
4. **FE/BE parity**: 32 orderable items (14 SUP_COCACOLA + 18 SUP_PAGO) × up to 6 stock levels + uncounted × 4–5 `requested_delivery_date` variants = **934 submits, 924 clean 200s with no deviation/over-MAX warning**; the other 10 independently confirmed consistent (see above), not a real divergence.
5. **Corrupt data**: negative/NaN/non-numeric/empty usage rows, a row for a nonexistent product, and a duplicate (location,product) row — `GET /api/captain/orderable` and `POST /api/captain/submit` **never returned 500** in any scenario tested.
6. **Flag off**: `GET /api/captain/orderable` for WOLA×SUP_COCACOLA is **byte-identical JSON** with and without `location_product_usage.csv` present, flag off (confirmed via `TestClient`, not just code reading).
7. **Timezone**: with a drifting fake clock behind `main._today_warsaw`, one `GET orderable` call (18 items) and one `POST submit` call (3 lines) each invoked `_today_warsaw()` **exactly once** — no within-request date-mixing between an order's lines or between orderable-list items.