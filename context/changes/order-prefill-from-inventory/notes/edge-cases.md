# Edge-case ledger — S-07 order-prefill-from-inventory (FR-017)

Owner asked for **weird cases flagged via simulation** (real pilot data later). Each case below has: **risk** if mishandled, **handling** in this implementation, and a **proof** (test name or `file:site`). Frontend has no test runner yet (known gap) → FE cases proven by reasoning + `tsc`/`eslint(0)`/`build`; backend cases by `pytest`.

Legend: ✅ handled+proven · ⚠️ handled, watch-point flagged.

| # | Case | Risk | Handling | Proof |
|---|------|------|----------|-------|
| 1 | **No snapshot** for the location | Banner offers nothing / crash | Endpoint returns `null` → `showPrefillBanner` false | ✅ `test_latest_null_when_no_snapshot`; FE guard `!!latestSnapshot` |
| 2 | **Seed mode** (no persistence) | 500 / phantom snapshot | `_choose_backend() is not sheets` → `null` (mirrors `captain_orders`) | ✅ `test_latest_null_in_seed_mode` |
| 3 | Snapshot product **not orderable** from the selected supplier | Stock injected for a line that doesn't exist | `lines` is keyed by orderable product_ids only; `acceptPrefill` iterates `Object.keys(lines)` → non-orderable snapshot products ignored | ✅ `acceptPrefill` (CaptainMP) |
| 4 | Orderable product **not in snapshot** (uncounted) | Wrong 0 entered as "counted" | `if (pid in stockByPid)` → uncounted lines left blank (blank ≠ 0) | ✅ `acceptPrefill` |
| 5 | **Multiple snapshots** for the location | Older snapshot wins → stale stock | `max` by `count_submitted_at` (fallback `count_date`) | ✅ `test_latest_returns_newest_snapshot` |
| 6 | **Stale snapshot** (days old) | Captain blindly imports an old count | **Safeguard**: banner NAMES the snapshot date/time (`prefillTime`); opt-in only | ⚠️ named-date shown; an explicit "X days ago / stale" hint is **NOT** built — flagged as a future enhancement |
| 7 | Prefill would **overwrite typed values / an in-progress draft** | Silent clobber of the captain's work | Fills **only empty** `current_stock` (`=== ""`); any value the captain already typed (incl. a deliberate `0`) is never overwritten. Opt-in + per-supplier dismiss; `captain_final` never touched | ✅ `acceptPrefill` `=== ""` guard — **adopted from scout cross-check `w0lafv5zc`** (stronger reading of "never overwrites without confirmation" than the original fill-all) |
| 8 | **Unit mismatch** (inventory vs order) | Silent wrong quantities | Both `current_stock_qty_base` are the product's inventory_unit/base — no conversion | ✅ verified: `captain_inventory_submit` stores base; order screen enters base |
| 9 | **Location scoping** — another location's snapshot | Cross-location data leak | Endpoint filters `c.location_id == location_id` (token-derived) | ✅ `test_latest_is_location_scoped` |
| 10 | **Discontinued** product in snapshot (later `active=False`) | Crash / fills a dead SKU | Inactive SKUs aren't in `orderable` → not in `lines` → ignored (= case 3) | ✅ `acceptPrefill` + `captain_orderable` active filter |
| 11 | Latest count has **`count_submitted_at = None`** | `max()` TypeError / wrong winner | Recency key falls back to `count_date` at UTC midnight | ✅ `test_latest_handles_missing_submitted_at` |
| 12 | **Both banners** shown (draft + prefill) | UI collision / one hides the other | Independent opt-ins; render stacked (draft amber, prefill sky) | ✅ separate state + render blocks (CaptainMP) |
| 13 | **Empty snapshot** (count with 0 lines) | Banner shown but nothing to fill | `latestSnapshot.lines.some(...)` is false → no banner | ✅ `showPrefillBanner` `.some` guard |
| 14 | Backend read **error** (sheet 429 / down) | Order screen blocked | `api.inventoryLatest().catch(() => {})` — silent; prefill is optional, ordering proceeds | ✅ mount effect `.catch` (CaptainMP) |
| 15 | **Re-fetch on supplier switch** wipes lines, banner re-offers | Prefill lost after switching supplier | `latestSnapshot` fetched once (location-wide); `prefillDismissed` is per-supplier, so each supplier still gets one offer | ✅ mount-once effect + per-supplier dismiss |

## Simulation walkthrough (synthetic, no real order)

**Backend** (proven by `tests/test_inventory_latest.py`): two WOLA counts (INV-OLD 06-01, INV-NEW 06-05) + a newer KEN count → `GET /api/captain/inventory/latest` as WOLA returns INV-NEW's lines `{P027:7, P026:2}`, never KEN. None/seed → `null`.

**Frontend** (reasoned, `tsc`+`build` green): snapshot `{count_submitted_at: 2026-06-05T09:00Z, lines:[{P027:7},{P099:3}]}`; supplier Bukat orderable = {P027, P026}. Banner shows "Wypełnić stan z inwentaryzacji z 5 cze 09:00?". Accept → P027.current_stock=7 (counted+orderable), P026 stays blank (uncounted), P099 ignored (not orderable). Toast "Wypełniono stan z inwentaryzacji (1 poz.)". Skip → nothing changes; manual entry as today. Switch supplier → banner re-offers once for that supplier.

## Carried-over simulation — the two prior chips' pending manual gates

Standing in for "real test we'll do later":

- **dispatch-email-content** (archived): subject `Zamówienie {location_name}`, fallback `order_id` when location unknown; body uses `supplier_product_name`, fallback `product_name_pl` → `product_id`. Weird cases covered by `test_gmail_url.py` incl. a name-leak assertion (`(wewn.)` absent). ⚠️ Flag: subject intentionally drops order_id + delivery date (owner request) — both remain in the body.
- **inventory-category-sections** (archived): rows grouped by `product_category`; empty/missing category → `Bez kategorii`. `Product.product_category` is required, so the fallback rarely triggers. ⚠️ Flag: per-category counter recomputes each keystroke (negligible at pilot scale); collapse state is ephemeral (not persisted across reload).

## Cross-check
Scout/edge-case workflow `w0lafv5zc` was launched in parallel to enumerate these independently; this ledger is the authoritative merged list.
