# Impl-review follow-ups — supabase-backend

Deferred items from the Phases 1–4 implementation review (2026-06-16). These were
triaged as "track, don't fix now" — pilot-acceptable but worth addressing before
the rollout stages widen.

## Before multi-location rollout

- **F1 — Make `captain_order_edit` atomic on Supabase.** Today the edit does three
  separately-committed writes (`delete_order_lines` → `append_order_lines` →
  `update_order(expected_status='captain_submitted')`). The conditional guard only
  protects the final status write, so a manager-claim in the window leaves the line
  set replaced under a now-claimed order (the captain still gets a 409). Documented
  v0 window, no worse than Sheets, near-impossible at single-location pilot — but at
  multi-location it becomes reachable. Fix: wrap the three writes in one Postgres
  transaction (pass a connection through, or add a single transactional edit path),
  accepting that the Sheets seam can't be made transactional so the two backends
  diverge here. Same write-then-guard shape exists (less severely) in
  `manager_dispatch` and `manager_order_save`; the dispatch email artifact is built
  before persistence so it's unaffected — line writes are idempotent overwrites.
  Source: impl-review F1 (and W-3/W-5).

## Tech debt (scale, not pilot)

- **F7 — `manager_queue` / `manager_suggestion_review` load ALL `order_lines`.**
  `load_order_lines()` is `SELECT * FROM order_lines` with Python-side filtering —
  one cached call on Sheets, a growing full-table scan on Postgres. Fine at pilot;
  add a `WHERE order_id IN (…)` / JOIN before order volume grows. Source: impl-review F7.
