---
change_id: supabase-edit-atomic
title: Atomic captain-order edit on Supabase (F1 — transactional delete+insert+status guard)
status: implemented
created: 2026-06-17
updated: 2026-06-17
archived_at: null
---

## Notes

F1 from the supabase-backend impl-review (archived follow-up `context/archive/2026-06-16-supabase-backend/follow-ups/review-fixes.md`).

`captain_order_edit` did three separately-committed writes (`delete_order_lines` → `append_order_lines` → `update_order(expected_status='captain_submitted')`); the conditional guard only protected the final write, so a concurrent manager-claim in the window could leave the line set replaced under a now-claimed order (captain still gets a 409). Near-impossible at single-location pilot, reachable at multi-location.

Fix: a new seam method `replace_order_lines_atomic(order_id, new_lines, *, order_updates, expected_status)` that wraps the guarded `UPDATE orders … RETURNING` + `DELETE order_lines` + `INSERT new_lines` in ONE Postgres transaction on Supabase (guard miss → rollback, lines untouched). Sheets keeps the prior non-transactional delete→append→guarded-update sequence (documented divergence; Sheets has no cross-call transaction). Scope: captain edit only — `manager_dispatch`/`manager_order_save` do idempotent overwrites (less severe), out of F1 scope.

Lightweight tracked change (user-approved): implement → /10x-impl-review → /10x-archive. No separate /10x-plan (design already settled in the follow-up note).
