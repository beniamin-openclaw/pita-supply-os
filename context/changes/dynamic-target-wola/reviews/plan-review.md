<!-- independent agent report, plan-review, 2026-09-07 -->

# Plan Review: Dynamic target (usage × days to next delivery) for Wola

**Plan**: `context/changes/dynamic-target-wola/plan.md` · **Mode**: Deep (Steps 1–3 of `10x-plan-review`, no interactive triage) · **Date**: 2026-09-07

## Verdicts

| Dimension | Verdict |
|---|---|
| End-State Alignment | WARNING — one guaranteed test regression not accounted for |
| Lean Execution | WARNING — dead columns added for a write path that doesn't exist |
| Architectural Fitness | PASS |
| Blind Spots | FAIL — repo's own "wire every new migration into the integration fixture" rule is skipped; a documented worked example doesn't match its own formula |
| Plan Completeness | FAIL — migration DDL cited to a research doc that doesn't contain one; several parameter/rounding semantics unspecified |

**Grounding**: 12/12 paths ✓ (`app/main.py`, `app/suggestion.py`, `app/seed_loader.py`, `app/sheets.py`, `app/supabase_backend.py`, `app/config.py`, `tests/conftest.py`, `tests/test_supabase_integration.py`, `tests/test_orderable_order_note.py`, `frontend/src/pages/captain-mp/{lib/dates.ts,lib/compute.ts,CaptainMP.tsx,OrderEditPage.tsx,components/ProductCard.tsx}`, `frontend/src/types.ts`, migrations 0001/0002/0009/0014) · symbols verified against real line numbers, not assumed.

---

## CRITICAL Findings

### C1 — `_build_orderable_item` signature change breaks an existing passing test

**Location**: Phase 2, `supply-os-v1/app/main.py` · **Evidence**: `tests/test_orderable_order_note.py:6,43-58` imports `main._build_orderable_item` directly and calls it positionally as `_build_orderable_item(sp, {"P011": product}, {"P011": setting})` — 3 args, matching the CURRENT signature at `app/main.py:170-174`. The plan's Phase 2 changes this to `_build_orderable_item(sp, products_by_id, settings_by_pid, usage_by_pid, supplier, today)` — 6 params. Confirmed by `grep -rln "_build_orderable_item\b" tests/ app/` — this is the ONLY direct caller besides `main.py`'s own `_build_orderable_items`. The plan's Phase 2 test list ("`tests/test_captain_submit.py` (+ new file `tests/test_dynamic_target_routes.py`)") never mentions this file. Unless the 3 new params get defaults, `python -m pytest` fails with `TypeError: missing 3 required positional arguments` — directly contradicting the plan's own Success Criteria ("existing 644 + new tests" green).

**Fix**: Update `tests/test_orderable_order_note.py`'s two call sites to pass `usage_by_pid={}, supplier=None, today=date(...)` (or the seed defaults), and add this file to Phase 2's "Tests" bullet. Do not paper over it with defaulted params on a private helper — every other private per-item helper in this module takes required args, and a silently-defaulted `today`/`supplier` invites a caller to forget one and get an unnoticed static fallback.

### C2 — New table not wired into `tests/test_supabase_integration.py`

**Location**: Phase 1, missing file · **Evidence**: Every migration since 0004 that adds a column/table this repo actually shipped has a matching update to `tests/test_supabase_integration.py`'s `_schema` fixture, and the convention is stated explicitly in-line: `tests/test_supabase_integration.py:128-130` ("0014 adds the inventory_count_events audit table ... Also add the new table to `_ALL_TABLES` (before `inventory_counts`) and `_TXN_TABLES` above."), and independently in the archived plan that shipped that migration: `context/archive/2026-09-01-training-feedback-0901/plan.md:161-163` ("Wire into the fixture: bindings, `exec_driver_sql`, `_ALL_TABLES` (before `inventory_counts`), `_TXN_TABLES`."). `.github/workflows/ci.yml`'s `backend-integration` job runs `pytest -m integration` against a real ephemeral Postgres on every push/PR (not opt-in, not gated) — so this is not a paper rule, it is CI that actually executes. `dynamic-target-wola/plan.md`'s Phase 1 file list never mentions `tests/test_supabase_integration.py`. Left as-is, migration 0017 is never applied in that fixture, `location_product_usage` never appears in `_ALL_TABLES`, and CI stays green while the new table gets zero real-Postgres coverage — precisely the "green ≠ covered" trap `lessons.md`'s "Verify CI actually runs the product's tests" entry exists to prevent.

**Fix**: Add to Phase 1: apply `0017_location_product_usage.sql` in `_schema`'s migration chain (with the same inline comment convention the file already uses), add `location_product_usage` to `_ALL_TABLES` (parent table, no children — goes near `location_product_settings`), and add one smoke test that inserts a row via `supabase_backend._insert` (mirroring the master-data inserts at lines 159-184) and reads it back via `load_location_product_usage()`.

### C3 — Overview's worked example contradicts its own formula

**Location**: Overview, lines 11–22 · **Evidence**: stated formula is `safety_base = max(min_stock_qty_base, usage_per_day × safety_days)` (computed raw, no intermediate rounding) then `target_dynamic = ceil_unit(usage_per_day × (days_until_delivery + horizon_days) + safety_base)` (single final ceil). Plugging in the plan's own worked numbers, backed by real seed data (`docs/pita-supply-os-v1/seed/location_product_settings.csv`: `WOLA__P024,WOLA,P024,2,10,10,...` → `min_stock_qty_base=2`; research.md: P024 usage=12.75 kg/day; the plan's own Monday-2026-09-07 example gives days_until_delivery=1, horizon_days=4, total=5 days — verified independently: `next_delivery_date([Tue,Sat], Mon 09-07)`→Tue 09-08 (offset 1), `next_delivery_date([Tue,Sat], Tue 09-08)`→Sat 09-12 (offset 4), matches the example's dates exactly):

```
safety_base_raw          = max(2, 12.75×1)      = 12.75
total_raw                = 12.75×5 + 12.75       = 76.5
ceil_unit(total_raw, kg) = 76.5   (already on the 0.1 grid — no-op)
```

The formula as stated yields **76.5 kg**, but the Overview's illustrative text claims "zapas 12,8 kg ... = 76,6 kg" — which only comes out right if `safety_base` is *independently* ceil'd to 12.8 before being summed (`12.75×5 + 12.8 = 76.55 → ceil → 76.6`). The plan never states this two-stage rounding anywhere in `compute_dynamic_target`'s spec (Phase 1: `compute_dynamic_target(usage_per_day, safety_days, min_stock, inventory_unit, today, delivery_date, next_delivery) -> tuple[float, dict]` gives no rounding-order detail). This is a genuine, provable internal contradiction in the plan's core formula, not a rounding artifact — the implementer has no way to resolve it without guessing, and the guess changes what gets snapshotted into `order_lines.target_stock_qty_base` and shown as "the math" on the Captain's card.

**Fix**: Pick one and correct the other. Recommended: `safety_base` gets its own `ceil_unit` for *display* (so the card always shows a value on the same grid as the target), and the final total is ceil'd again over the (rounded) safety_base — i.e. two `ceil_unit` calls, matching the example (76.6 kg). Update the Overview formula block to show both ceil calls explicitly, and add exactly this case (min=2, usage=12.75, 5 days) as a named unit test in `tests/test_dynamic_target.py` so the arithmetic is pinned, not just narrated.

---

## HIGH Findings

### H1 — "table as in research" cites a document that has no table

**Location**: Phase 1, `supply-os-v1/migrations/0017_location_product_usage.sql` bullet · **Evidence**: `plan.md:120` says "table as in research (PK `usage_id`, FKs to locations/products, ...)". `research.md` (99 lines, fully read) contains zero occurrences of `CREATE TABLE`, no column types, no precision, no index/constraint names — nothing beyond the prose usage table and the risk list. The entire DDL — numeric precision for `usage_per_day_base`/`safety_days`, the CHECK-constraint naming convention this repo uses (`<table>_<col>_check`, per `migrations/0001`), whether `UNIQUE (location_id, product_id)` needs a supporting index, and the mandatory "Rollback:" comment block every migration since 0009 carries — is entirely unwritten in this plan bundle.

**Fix**: Either write the DDL inline in `plan.md` Phase 1 (a few lines, following `0009`'s/`0014`'s exact style — header comment, `CREATE TABLE`, `CREATE INDEX` if needed, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, and a `-- Rollback:` block), or correct the cross-reference. Don't leave "as in research" pointing at a document that never specifies it.

### H2 — FE/BE delivery-calendar parity claim overstates what's actually mirrored

**Location**: Current State Analysis line 31, Phase 1's `next_delivery_date` spec (line 100-101), research.md line 87 · **Evidence**: `frontend/src/pages/captain-mp/lib/dates.ts:23-27` — `getRequestedDeliveryDate` has THREE branches: blank/unparseable → tomorrow; **pure numeric string → `today + N days`** (`const asNum = Number(trimmed); if (Number.isFinite(asNum) && asNum > 0) nextDate.setDate(today.getDate() + Math.floor(asNum));`); weekday tokens → next matching weekday. `app/main.py:689-717` (`_parse_weekdays`, to be moved into `dynamic_target.parse_delivery_weekdays`) has NO numeric-days branch — a numeric token fails every `WEEKDAY_MAP` lookup at all three fallback lengths and the function bails to `None` ("we don't want a partially-correct cutoff", `main.py:717` docstring). Under the plan's `resolve_effective_target`, `weekdays=None` means "no_calendar" → static, regardless of whether `req.requested_delivery_date` was supplied. Today this is harmless for the two in-scope suppliers (Pago="Tue"/"Tue, Sat", Coca-Cola="TBD"→"Thu", neither numeric), but the plan's claim that the new engine "mirrors `getRequestedDeliveryDate`" is simply false for this branch, and any future supplier configured with a numeric `delivery_days` cadence (a real, used convention — the FE explicitly supports it) would silently and permanently get static targets with no obvious diagnostic tying it back to what the Captain's own screen computed.

**Fix**: Either extend `parse_delivery_weekdays`/`next_delivery_date` to also accept the numeric "N days" form (small, self-contained addition, keeps the "mirrors FE" claim true), or explicitly narrow the claim in `plan.md`/`research.md` to "weekday-token calendars only" and add a `reason="no_calendar"` test case for a numeric `delivery_days` string so the gap is deliberate and tested, not discovered later.

---

## MEDIUM / WARNING Findings

### W1 — Clamp semantics for a stale `requested_delivery_date` are unspecified

**Location**: Phase 1, `resolve_effective_target` spec, line 108-111 · **Detail**: "`delivery_date` = `requested_delivery_date` if given (clamped so `days_until_delivery ≥ 0`)" doesn't say whether the clamp replaces `delivery_date` itself with `today` (which then changes the `next_delivery_date(weekdays, delivery_date)` horizon calc) or only floors the *subtracted days* at 0 while keeping the stale date for the horizon lookup. These two readings produce different `horizon_days`/`next_delivery_date` for a browser tab left open across a day boundary — exactly the midnight-crossing risk research.md itself flags (line 84-88).

**Fix**: Pin it explicitly: `delivery_date = max(requested_delivery_date, today)` before any downstream date arithmetic. Add one test: tab-held-open scenario, `requested_delivery_date` = yesterday, assert the target computed matches what a fresh `today` calendar lookup would give.

### W2 — RLS + rollback-comment convention stated as conditional when it is unconditional

**Location**: Phase 1, migration bullet, line 122 · **Evidence**: `migrations/0009_transport_batches.sql` and `0014_inventory_count_edit.sql` both unconditionally `ALTER TABLE <new_table> ENABLE ROW LEVEL SECURITY;` and both carry a `-- Rollback:` comment block with explicit `DROP TABLE`/`ALTER ... DROP COLUMN` statements. The plan hedges with "RLS deny-all like 0002 **if** that migration applies RLS per table — check and mirror" and says nothing about the rollback block, when the code confirms both are unconditional, established repo convention for every migration adding a table since 0009.

**Fix**: State both as required, not conditional, in the Phase 1 bullet.

---

## LOW / OBSERVATION Findings

- **`_LOCATION_PRODUCT_USAGE_COLUMNS` and `as_of` in `_DATE_COLS` are dead additions.** `_fetch_all` (`app/supabase_backend.py:253-257`, used by every `load_*` including the planned `load_location_product_usage`) does `SELECT *` mapped straight onto the Pydantic model — it never touches `_DATE_COLS`/the `_XXX_COLUMNS` lists, which exist solely for `_insert`/`_bind` (write paths, `app/supabase_backend.py:243-264`). This plan explicitly builds no write function for this table ("No prod writes ... nothing is applied from this change"). Fix: drop both from Phase 1's supabase_backend.py bullet unless a write path is added later.
- **`seed_loader.load_location_product_usage()`'s "returns `[]` when the file is absent" needs an explicit try/except.** Every existing seed loader (`app/seed_loader.py:71-94`) raises `FileNotFoundError` via `_read_cached` on a missing file — none degrade to `[]`. The new loader needs its own wrapper to diverge from that contract; the plan states the desired behavior but not the mechanism (low risk since `main._load_usage_safe` also catches everything, but the plan's own unit test — "missing usage file → `[]`" — exercises the function directly, not through that safety net).
- **`_build_orderable_item`'s planned signature omits `enabled`** even though `resolve_effective_target(..., enabled: bool)` requires it. Presumably read from the `settings` singleton directly inside the function (a valid pattern used elsewhere in this module) rather than threaded as a parameter — say so explicitly in Phase 1.
- **Migration numbering**: `migrations/` currently jumps 0007→0009 (0008 is reserved by the still-unmerged `claude/multi-location-master-data` branch per the team's own memory notes). No collision with 0017 as things stand, but worth a last-minute `ls migrations/` check before merging, in case another change lands 0017 first.
- **Test-count staleness**: plan/root docs say "644 existing tests"; `pytest --collect-only` on current `main` collects 658 (20 more deselected via the `integration` marker). No test hardcodes a total, so this is cosmetic only — worth refreshing so a reviewer checking pytest output isn't second-guessing a mismatch.

---

## Promise gaps

None found. Every bullet under Desired End State / top-level Success Criteria traces to a phase:
- Captain + Manager Transport grid dynamic target → Phase 2 (`_build_orderable_items` is the single shared function both `captain_orderable`/`manager_orderable` and `manager_add_line`/`manager_transport_add_location`'s `prefill_products` path call — confirmed via `grep -n "_build_orderable_items(" app/main.py`: lines 257, 273, 2031, 4523, all four). Because `manager_add_line` (`main.py:2067`) and the Transport prefill (`main.py:4531`) both build their skeleton lines from `match["target_stock_qty_base"]` / `item["target_stock_qty_base"]` — i.e., straight off the dict `_build_orderable_items` returns — they automatically inherit the dynamic target with zero extra code, which the plan doesn't call out but is true and correct.
- Static-elsewhere byte-identical → covered by the gating conditions in `resolve_effective_target` + Phase 1's "every static-fallback reason" test list.
- Submit/edit gate parity + snapshot → Phase 2 (`_evaluate_submit_line`'s two actual uses of `setting.target_stock_qty_base`, confirmed at `main.py:450` and `:532`, both get replaced — no other use of that field exists inside the function).
- Kill switch → Phase 1 config + conftest.

## Contradictions with `context/foundation/lessons.md`

None outright — the plan is unusually compliant, and in several places explicitly cites the relevant lesson:
- "Tests must be order-independent" → conftest `setdefault` addition matches the established pattern exactly.
- "Mirror Pydantic optionality in TypeScript" → `TargetSource` fields declared `?:` throughout Phase 3.
- "Master-data ops: diff before, audit after" → `prod-sql.sql`'s BEFORE assertion / AFTER audit in Phase 4 matches this rule almost verbatim.
- "Never bypass the data-layer seam" → every new read goes through `_choose_backend()`-resolved `backend`, `_load_usage_safe` uses `getattr` the same way `_persist_order`/`_persist_receipt` do.

The one soft tension is C2 above against "Verify CI actually runs the product's tests" — not a violation of the letter (nothing here claims a false green), but leaving the new table unwired into `test_supabase_integration.py` sets up exactly the situation that lesson warns about: CI stays green while a real gap in coverage goes unnoticed.

---

## Verdict

**Ready with fixes.** The core design — one computed `target_stock_qty_base` flowing through existing plumbing via a single shared function, a kill switch, and reusing the order-line snapshot for edit-gate consistency — is sound, well-grounded in the actual code, and the blast-radius sweep confirms no caller of the changed functions was missed except one. But it is not ready to hand to `/10x-implement` as written: one change (C1) will cause a concrete, certain test failure; one (C2) silently violates a repo convention that exists specifically to keep Supabase coverage honest; and one (C3) is an internal arithmetic contradiction in the plan's own worked example that must be resolved before `compute_dynamic_target` can be written unambiguously. All three fixes are small and mechanical (update one test file, add one fixture wiring block, pick one rounding order and correct the example) — this is a REVISE, not a RETHINK.