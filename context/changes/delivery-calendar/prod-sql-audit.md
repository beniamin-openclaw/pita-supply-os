# prod-sql audit — delivery-calendar (2026-09-28)

Run on prod Supabase at the operator's request, before merging PR #42.
Before-state: `prod-sql-diff-before.md`.

1. Diff before: saved (`prod-sql-diff-before.md`).
2. Migration `0025_delivery_calendar` applied (MCP `apply_migration`, success).
3. Seed (step 3 of `prod-sql.sql`) run once.
4. Audit after:

| Check | Expected | Result |
|-------|----------|--------|
| Rules in `supplier_delivery_rules` | 23 (every supplier and location exists on prod) | 23 |
| 4b orphan supplier/location | 0 rows | 0 |
| 4c more than one shared rule per supplier | 0 rows | 0 |
| 4d `coverage_prompt_enabled` | SUP_BUKAT, SUP_INTERMLECZ | SUP_BUKAT, SUP_INTERMLECZ |
| 4e missing suppliers / locations | none | none |

4a matches the seed list: Pago and Mory per location (WOLA, BRACKA Mon→Wed;
NORBLIN, BROWARY, ELEKTROWNIA, WESTFIELD, KEN Sun/Thu→Tue/Sat), Filber Wed→Thu,
Bukat and Intermlecz every day→Mon–Sat, Coca-Cola WESTFIELD only, Kuchnie
Mon–Sat, Eurofood/Spec/Kamino Mon–Fri (lead 1), Blue Service Mon–Fri (lead 2).
All deadlines 17:00.

Rollback: the block at the end of `prod-sql.sql`, then the migration's own
rollback block.
