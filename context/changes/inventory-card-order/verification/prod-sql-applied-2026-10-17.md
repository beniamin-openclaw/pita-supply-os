# inventory-card-order — prod apply log (2026-10-17)

Applied by the main lane agent through Supabase MCP `execute_sql` (path (b)), after Ben's OK in chat on 17.10:
"odśwież inventory-card-order/prod-sql.sql pod obecny prod, zrób review i wgraj po kolei z audytem".

## What ran

- Source: `prod-sql.sql` at commit `2da7a54`.
  - The SQL was regenerated against the 15:18Z snapshot.
  - The review verdict was "APPLY WITH FIXES".
  - Both fixes are in: Cappy glass aliases and `lock_timeout 5s`.
- Step 1 (read-only) ran at 15:57Z and matched: 1e `0|0|t|t|167|26|112`.
- Step 2 ran as `prod-sql-applied-2026-10-17.sql` (next to this file). It is the same transaction with two transport-only changes:
  - The card list (1514 rows) and the template list (167 rows) are sent as comma strings and unnested, not as VALUES rows. That makes the query small enough to send in one MCP call.
  - A second DO block before COMMIT checks the md5 of the unnested card and template data. It must equal the md5 of the reviewed file's VALUES (computed locally: `34685dd8…`, `f612c2b5…`). A mismatch RAISEs, and the transaction rolls back.
  - Guards G0/G1, row counts 2a–2d, and in-transaction audits A1–A3 are unchanged.
- The transaction committed. No error was raised.

## Audit after (prod, 17.10)

| Check | Expected | Result |
|---|---|---|
| 3a products positioned / ≤ 0 | 167 / 0 | 167 / 0 |
| Template md5 vs reviewed file | equal | equal |
| Settings positioned (26 overrides + 112 extras) | 138 | 138 |
| The 26 overrides, exact (loc, product, pos) | 26 | 26 |
| Active settings without a position | 0 | 0 |
| A1 card order / A2 contiguity (in transaction) | 0 / 0 | passed (commit) |
| Cappy glass WOLA, WESTFIELD | P190 800, P191 820 (after Monster 780) | P190 800, P191 820 at both |
| FORUM Napoje | workbook order | Mirinda 680, 7Up 690, Pepsi 700, Pepsi Zero 710, Krystaliczne niegaz. 720, gaz. 730, Lemoniada Lemon 1000, Orange 1010, Grapefruit 1020 |
| FORUM P192 "Halloumi cięte" | end of Produkcja | 431 |

## Not applied

`prod-sql-pago-mory.sql`: the read on 17.10 shows all 43 rows NULL, and the 24 target ids exist and are active. It is a separate file and needs its own OK.

## Rollback

On this first run, setting both columns back to NULL restores the before-state:

```sql
UPDATE location_product_settings SET inventory_order = NULL WHERE inventory_order IS NOT NULL;
UPDATE products SET inventory_order = NULL WHERE inventory_order IS NOT NULL;
```

The file cannot be re-run: guard G1 raises once positions exist. To change the order, regenerate the pipeline output from a new snapshot first.

## Live check for Ben

- On the FORUM count, drinks follow the paper card: Mirinda, 7Up, Pepsi, Pepsi Zero, water, then lemonades.
- On the WOLA count, Cappy glass comes right after Monster.
- Products new to a location show at the end of their section, for example "Halloumi cięte" at the end of Produkcja on FORUM.
