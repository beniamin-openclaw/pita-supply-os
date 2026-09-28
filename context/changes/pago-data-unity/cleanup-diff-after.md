# Cleanup diff — state AFTER (applied 2026-09-28)

- Applied to prod Supabase (`lpzhphufjwrndfogkfub`) by the coordinator session after the operator's go on 28.09.
- STEP 0 matched `cleanup-diff.md`; saved as `cleanup-diff-before.md` (the rollback source).
- STEP 1 ran as the single `DO $$ … $$` block (one statement, so all or nothing); no error was raised.
- STEP 2 audit: 13/13 checks `ok = true`.
- Nothing was sent: no e-mail, no Gmail draft, no change to biuro@ or the Ordering sheet.

## Orders after the run

| order_id | status | sent_method | manager_sent_at (UTC) | marker | total | last_edited_at (UTC) |
|---|---|---|---|---|---|---|
| ORD-20260902-BRA-PAGO-3a9bea | cancelled | — | — | cleared | 3763.00 | — |
| ORD-20260902-BRO-PAGO-a1fbe8 | cancelled | — | — | cleared | 437.84 | — |
| ORD-20260902-ELE-PAGO-c11e06 | cancelled | — | — | cleared | 384.72 | — |
| ORD-20260925-BRO-PAGO-810239 | cancelled | — | — | cleared | null | — |
| ORD-20260925-ELE-PAGO-a141d9 | cancelled | — | — | cleared | null | — |
| ORD-20260925-KEN-PAGO-a3b234 | cancelled | — | — | cleared | null | — |
| ORD-20260925-NOR-PAGO-6702dd | cancelled | — | — | cleared | null | — |
| ORD-20260925-WES-PAGO-f3732e | cancelled | — | — | cleared | null | — |
| ORD-20260904-KEN-PAGO-626d49 | manager_sent | transport | 2026-09-04 10:42:19 | — | 723.00 | — |
| ORD-20260907-KEN-PAGO-63620f | manager_sent | transport | 2026-09-07 09:39:09 | — | 723.00 (was 629.00) | 2026-09-07 10:06:36 (unchanged) |
| ORD-20260907-BRA-PAGO-ffdb4f | manager_sent | transport | 2026-09-08 09:45:17 | — | 2706.00 | — |
| ORD-20260914-KEN-PAGO-9ec6c9 | manager_sent | transport | 2026-09-14 12:32:59 | — | 774.00 | — |
| ORD-20260914-WOL-PAGO-61280b | manager_sent | transport | 2026-09-15 11:07:44 | — | 5913.00 | — |
| ORD-20260914-BRA-PAGO-dbb70d | manager_sent | email (unchanged) | 2026-09-22 12:22:57 (unchanged) | — | 6457.48 (was 3879.00) | 2026-09-28 13:13:49 |
| ORD-20260921-WOL-MORY-0cdb48 (control) | manager_claimed | — | — | — | 125.37 | — |

The ODB times were written as CEST (+02) and read back in UTC, so 12:42:19+02 shows as 10:42:19 UTC.

## Other rows

- Transport headers `TRN-20260902-PAGO-aa283f` and `TRN-20260925-PAGO-2d5342`: `draft` → `cancelled`, plus 2 `batch_cancelled` events (`TEV-6c5af516`, `TEV-2aeffb78`).
- KEN 07.09 Pita line `-002`: manager 0 → 2, base 24.
- BRA 07.09 Bifteki line `-005`: comment "nie było w zamówieniu z 09.09 (arkusz Ordering)"; quantities stay 2/1.
- 5 `reconciled_from_sheet` order events (`OEV-a0c129b7`, `OEV-e205fdcf`, `OEV-11df8f69`, `OEV-51cdbf07`, `OEV-2792f0e2`).
- BRA 14.09 lines: G15 6 → 8 (base 120), Pita 3 → 8 (base 96), SK 7 → 12 (base 60); new line `OL-ORD-20260914-BRA-PAGO-dbb70d-M-0b3ab1` Gyros 25 KG 1 (base 25); events `OEV-48b3d281` (line_added) and `OEV-85ee7c03` (quantities_changed).

## Still open (operator)

- `ORD-20260921-WOL-MORY-0cdb48` waits for Marek's answer on "Tacki bez logo" = "Box beżowy bez logo".
- The 7 unsent Pago drafts and 2 unsent pickup orders in biuro@ are deleted by hand.
- Screen check in the Manager app: the 5 B orders under "Zamówione", both drafts gone from the Transport list.
