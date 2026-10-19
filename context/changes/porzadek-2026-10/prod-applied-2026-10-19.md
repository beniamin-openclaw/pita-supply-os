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
| 19.10 | `gdansk-rollout/prod-sql-4-coca-cola-cans-pet.sql` STEP 1 (Ben's OK: "Wgraj, te same butelki") | One transaction (`lock_timeout` 5s), all guards passed. AUDIT (a): 8 active SUP_COCACOLA_GDA rows, order 1–8: Coca-Cola puszka ×24, Zero puszka ×24, Sprite puszka ×24, Fanta puszka ×24, Cappy Pomarańcza PET ×12, Cappy Jabłko PET ×12, Kropla niegaz. PET 0,5 ×12, Kropla gaz. PET 0,5 ×12. (b) 0 active glass rows; P186/P187/P190/P191 `active=false`. (c) SLONY thresholds: glass 0/0/0; P064/P065/P068/P069 0/0/0 (waiting on Marek); P066/P067 12/48/48; P070 36/96/96; P071 24/48/48 szt. STEP 2 (remove glass settings) not run, it needs a separate OK |
| 09:3x | PR #69 merged | `74f1d37` (Lane C first merged `main` into it, CI green, CLEAN) |
| 09:3x | PR #70 retargeted to `main` and merged | `45812fa`. Migration 0030 and NORBLIN/ELEKTROWNIA=false were already on prod (08:29) |
| 09:3x | PR #64 merged | `57749c1`. Checked first on `main`+#64: backend 1178 passed and ruff clean; frontend typecheck and lint clean, 1219 passed. The 3 vitest failures (`stickyBulkReason`, `ProductCard` English copy) also fail locally on `main` from before the merges (`8d535a8`): Node 25 locally vs Node 20 in CI. CI on `main` is green |

Still open:
- Gdańsk: ask the Captain to delete any unsent Coca-Cola draft (it may still hold glass rows). Prices for Fanta, Sprite and Kropla are NULL until Marek sends them. Thresholds for cans and Cappy PET are 0/0/0 (no suggestion) until Marek sends them.
