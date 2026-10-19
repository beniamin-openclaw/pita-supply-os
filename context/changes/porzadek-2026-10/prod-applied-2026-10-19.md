# Prod changes, 2026-10-19 (main lane)

Ben gave his OK in chat on 19.10, on the live-check list (`live-check-2026-10-19.md` §7): "z live check pk 2 - daje ok , pkt 3 daje ok".
- Point 2 is the Pago and Mory list order.
- Point 3 is the Lane C merges, with migration 0030 and its data step before #70.

Path (b): Supabase MCP `execute_sql` from the main lane. Each step below is diff → guarded apply → audit.

| Time (CEST) | Step | Result |
|---|---|---|
| 08:2x | `inventory-card-order/prod-sql-pago-mory.sql` | Before: 43 Pago/Mory rows, all `display_order` NULL (rollback = set NULL). Applied in one transaction with guards (no row positioned yet; Pago = 6, Mory = 18 updated, active rows only). AUDIT 3a: SUP_MORY 18/18/18/0, SUP_PAGO 6/6/6/0 |
| 08:2x | PR #65 merged | `799c773` |
| 08:2x | PR #66 merged | `ee22655`. Merged before 09:00 because the 14-day count submissions start at 09:00, and the legacy local draft is lost once on deploy |
| 08:29 | `captain-stock-count-warning/prod-sql.sql` A | column absent; 13 locations (as in the file); NORBLIN + ELEKTROWNIA present |
| 08:29 | B + C in one transaction (`lock_timeout` 5s) | migration 0030 `locations.require_stock_count` (default true); NORBLIN, ELEKTROWNIA → false (guards as in the file) |
| 08:29 | D | false: ELEKTROWNIA, NORBLIN; true: the other 11. `/health` ok after the change. The running code (`main` before #70) ignores the extra column (`SELECT *` into a Pydantic model without `extra=forbid`) |

Still open:
- #69 conflicts with `main` after #65 and #66. Lane C is merging `origin/main` into it, then into #70 and #64. Merge #69 → #70 once CI is green.
- `gdansk-rollout/prod-sql-4-coca-cola-cans-pet.sql` (Gdańsk: cans and PET, no glass, from Ben in chat 19.10) is in review. It is not applied, and the apply needs Ben's OK.
