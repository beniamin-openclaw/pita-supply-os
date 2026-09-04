# Hardening review — decisions log

Adversarial review of `plan.md` v1 (Opus, 2026-09-02) against the live code, the
Tier-1 contracts and `lessons.md`. Every finding below is **resolved**; the
resolution is folded into `plan.md` v2. `plan-v1-prehardening.md` keeps the
reviewed original.

## Blockers (would have reached production)

**B1 — three migrations unwired from the integration fixture.**
`tests/test_supabase_integration.py:82-132` applies migrations by explicit
filename and its comments repeat the rule six times. The plan mentioned only
"applied to prod". Default `pytest` excludes the integration mark, so this goes
red only in CI. → Every migration step now also names the fixture bindings, the
`exec_driver_sql` call, and (for 0014) `_ALL_TABLES` / `_TXN_TABLES`.

**B2 — the plan's own Pydantic rule breaks every Captain submit.**
The rule said "new fields are `Optional[...] = None`". `supabase_backend._insert`
binds **every** column in the list, so `Optional = None` against a
`NOT NULL DEFAULT ''` column raises `IntegrityError` on `POST /api/captain/submit`.
`_validate_headers` keys off `field.is_required()`, so *any* default already makes
a sheet column optional — the Optional was never needed. Precedent:
`0004` declares `cancel_reason text NOT NULL DEFAULT ''` and `models.py:173`
models it `str = ""`. → **Rule replaced**: match the Pydantic default to the DDL
default. `extra_items: str = ""`, `captain_note: str = ""`, `warehouse_pickup:
bool = False`. `Optional[...] = None` only for genuinely nullable columns.

**B3 — ad-hoc items wired into the non-authoritative email builder.**
`frontend/src/pages/manager/lib/emailBody.ts:23-28` states it is the authoritative
builder; the backend `gmail_url.py` twin only produces a session re-open link. The
plan named only the backend. Result would have been a green test suite and a
supplier email with no ad-hoc items. → Both builders in scope, plus
`emailBody.test.ts`; the manual step reads the real Gmail draft.

**B4 — Phase 4 blanks the pickup PDF in prod.**
`0015` defaults `warehouse_pickup` to `false` on every row; shipping the filter
before the data pass yields an empty product table. → Explicit three-step order
(migration → data pass with saved SELECT-diff → code), plus an audit assertion
that the Pago true-count is non-zero, plus a checklist line for the data pass.

## Defects

- **D1** — `update_inventory_count` was missing from the seam; `line_count` is a
  persisted denormalisation both list endpoints read (`main.py:2336`, `:2489`,
  pinned by `test_inventory_counts.py:163-176`). Added to both backends. Note
  `test_supabase_backend.py:317` parity check is one-directional and would not
  have caught a Sheets-side omission.
- **D2** — the order comment reused `orders.notes`, the field the plan itself
  declared unusable. `manager_release` overwrites it (`main.py:1554`) and
  `captain_order_edit` blanks it (`main.py:1366`). → Its own column
  `orders.captain_note`, same migration.
- **D3/O1** — the defensive aggregate supplier filter defends a state the research
  proved unreachable, at a 12-test blast radius (`test_transport.py:271-377`).
  → **Cut.** Kept only the real one-line fix: derive the batch supplier from the
  header rather than `group[0]` (`main.py:3438-3441`).
- **D4** — column-list drift enumerated per migration (see `plan.md` Migration Notes).
- **D5** — the i18n pickup bar names the *warehouse*, not the buyer. The operator's
  instruction was blanket ("wszędzie pisz PitaBros, nie ma już towaru DeGourmet"),
  so all five sites change, but this one is flagged in the handover as the single
  string whose meaning shifted rather than just its name.
- **D6** — three docstrings assert inventory immutability
  (`models.py` `InventoryCount`, `sheets.append_inventory_count`,
  `main.py` `captain_inventory_submit`). Phase 2 updates all three.

## Gaps closed by decision

- **G1/G2** — instead of incremental line updates, the inventory edit uses
  **replace semantics**: delete the count's lines, append the new set, mirroring
  the tested `replace_order_lines_atomic` path. This resolves the `count_line_id`
  collision, the missing `(count_id, product_id)` uniqueness, and the "Captain
  blanks a product" case (blank = not counted = no line) in one move. The audit
  diff is computed server-side from old vs. new **before** the write.
- **G3** — `count_submitted_at` stays the original submit moment (it is the
  recency/audit key). A new `last_edited_at` column mirrors `Order.last_edited_at`;
  the pre-fill banner shows it when set.
- **G4** — `minimum_order_value_pln` is joined onto `ManagerQueueItem`,
  `ManagerOrderDetail` and `CaptainOrderDetail` server-side. Cheaper than a
  per-screen supplier fetch and it sidesteps `apiClient.ts:306`'s `"captain"`
  role default, which `lessons.md` records as having silently 401'd a Manager
  screen before. Nothing server-side reads the value, so the "no gate" property holds.
- **G5** — step reworded: `isPago` is frontend (`transport.ts:710`); the backend
  fix is `batch_supplier_id` at `main.py:3438-3441`.
- **G6** — the Pago entity stays a hardcoded constant. A batch spans locations
  belonging to different spółki (Pita Bros vs Pita Bros Centrum), so there is no
  single correct `Location.company_*` to source from. TODO stays.
- **G7** — stated explicitly: only the **pickup document** filters on
  `warehouse_pickup`. The Pago order email and the order PDF still cover the whole
  batch — Pago is the purchasing channel, the warehouse run is a subset.
- **G8** — the Pago chicken-gyros block SKU moved to "still blocked".

## Cut as overbuild

- **O1** — the aggregate supplier filter (see D3).
- **O2** — the destructive "overwrite all reasons" variant. `change.md` asks for
  one click to fill the blanks; a reason code is always hand-picked, unlike the
  stock values `PrefillControl` overwrites. Ship fill-empties only.
- **O3** — Phase 1 split into **1a** (zero-backend), **1b** (migration 0013 +
  ad-hoc items + comment + both email builders), **1c** (minimum indicator).

## Demo environment

Execution runs against a **local Postgres 16.14** (`supply_os_demo` on
127.0.0.1:5432), never prod. `tests/test_supabase_integration.py:69-80` refuses to
drop/recreate tables unless the DSN is localhost, so the prod DSN cannot be reached
by accident. Baseline before any change: **16 integration tests green**.
