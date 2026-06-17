---
change_id: order-lines-targeted-load
title: Targeted order_lines load for queue/list endpoints (F-7 — kill the full-table scan)
status: implementing
created: 2026-06-17
updated: 2026-06-17
archived_at: null
---

## Notes

F-7 from the supabase-backend impl-review (archived follow-up `context/archive/2026-06-16-supabase-backend/follow-ups/review-fixes.md`).

`load_order_lines()` is `SELECT * FROM order_lines` (whole table) + Python-side grouping. Three callers in `app/main.py`:
- `manager_queue` (621) and `captain_orders` (842) — load ALL lines but only need the lines for the filtered/limited subset of orders. On Postgres this is a growing full-table scan per request.
- `manager_suggestion_review` (2075) — a per-product roll-up over the WHOLE history; it genuinely needs all lines.

Fix: new seam method `load_order_lines_for_orders(order_ids)`:
- Supabase: `SELECT * FROM order_lines WHERE order_id = ANY(:ids)` (targeted; order_id is indexed). Empty ids → `[]` (no query).
- Sheets: load all (cached) + filter to ids in Python — preserves today's one-cached-read behavior (Sheets has no targeted path; the TTL cache already makes it one read).

Rewire `manager_queue` + `captain_orders` to the targeted loader. `manager_suggestion_review` stays on `load_order_lines()` (full-history aggregate; pushing GROUP BY into SQL would break the uniform seam — deferred as a deeper future optimization, noted not done).

Lightweight tracked change (same shape as F1 supabase-edit-atomic): implement → CI on real PG → archive.
