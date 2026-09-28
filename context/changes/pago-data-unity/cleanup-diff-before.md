# Cleanup diff — state BEFORE (STEP 0 output)

- Read from prod Supabase (`lpzhphufjwrndfogkfub`) with SELECT only, 2026-09-28, by the coordinator session, right before STEP 1.
- Every row matches `cleanup-diff.md`. This file is the rollback source for STEP R.

## 0.1 orders

| order_id | location | status | captain_user | manager_user | manager_sent_at (UTC) | sent_method | supplier_order_reference | total | last_edited_at (UTC) | cancel_* |
|---|---|---|---|---|---|---|---|---|---|---|
| ORD-20260902-BRA-PAGO-3a9bea | BRACKA | manager_claimed | manager-default | — | — | — | TRN-20260902-PAGO-aa283f | 3763.00 | — | empty |
| ORD-20260902-BRO-PAGO-a1fbe8 | BROWARY | manager_claimed | manager-default | — | — | — | TRN-20260902-PAGO-aa283f | 437.84 | — | empty |
| ORD-20260902-ELE-PAGO-c11e06 | ELEKTROWNIA | manager_claimed | manager-default | — | — | — | TRN-20260902-PAGO-aa283f | 384.72 | — | empty |
| ORD-20260904-KEN-PAGO-626d49 | KEN | manager_claimed | KEN | — | — | — | — | 723.00 | — | empty |
| ORD-20260907-BRA-PAGO-ffdb4f | BRACKA | manager_claimed | BRACKA | — | — | — | — | 2706.00 | — | empty |
| ORD-20260907-KEN-PAGO-63620f | KEN | manager_claimed | KEN | — | — | — | — | 629.00 | 2026-09-07 10:06:36.822793 | empty |
| ORD-20260914-BRA-PAGO-dbb70d | BRACKA | manager_sent | BRACKA | manager-default | 2026-09-22 12:22:57.279491 | email | — | 3879.00 | — | empty |
| ORD-20260914-KEN-PAGO-9ec6c9 | KEN | manager_claimed | KEN | — | — | — | — | 774.00 | — | empty |
| ORD-20260914-WOL-PAGO-61280b | WOLA | manager_claimed | WOLA | — | — | — | — | 5913.00 | — | empty |
| ORD-20260921-WOL-MORY-0cdb48 (control) | WOLA | manager_claimed | WOLA | — | — | — | — | 125.37 | — | empty |
| ORD-20260925-BRO-PAGO-810239 | BROWARY | manager_claimed | manager-default | — | — | — | TRN-20260925-PAGO-2d5342 | null | — | empty |
| ORD-20260925-ELE-PAGO-a141d9 | ELEKTROWNIA | manager_claimed | manager-default | — | — | — | TRN-20260925-PAGO-2d5342 | null | — | empty |
| ORD-20260925-KEN-PAGO-a3b234 | KEN | manager_claimed | manager-default | — | — | — | TRN-20260925-PAGO-2d5342 | null | — | empty |
| ORD-20260925-NOR-PAGO-6702dd | NORBLIN | manager_claimed | manager-default | — | — | — | TRN-20260925-PAGO-2d5342 | null | — | empty |
| ORD-20260925-WES-PAGO-f3732e | WESTFIELD | manager_claimed | manager-default | — | — | — | TRN-20260925-PAGO-2d5342 | null | — | empty |

`cancel_*` empty = `cancelled_at` null, `cancelled_by` null, `cancel_reason` ''. All `supplier_id` = SUP_PAGO except the Mory control (SUP_MORY).

## 0.2 order lines of B + C (captain / manager qty, manager base, manager comment)

| order_line_id | product | captain | manager | manager base | comment |
|---|---|---|---|---|---|
| OL-ORD-20260904-KEN-PAGO-626d49-001 | P024 Gyros 15 KG | 1 | 0 | 0 | '' |
| OL-ORD-20260904-KEN-PAGO-626d49-002 | P026 Pita (opakowania) szt 10 | 2 | 0 | 0 | '' |
| OL-ORD-20260904-KEN-PAGO-626d49-003 | P028 Souvlaki Wieprz | 1 | 0 | 0 | '' |
| OL-ORD-20260907-BRA-PAGO-ffdb4f-001 | P024 Gyros 15 KG | 1 | 0 | 0 | '' |
| OL-ORD-20260907-BRA-PAGO-ffdb4f-002 | P026 Pita (opakowania) szt 10 | 6 | 0 | 0 | '' |
| OL-ORD-20260907-BRA-PAGO-ffdb4f-003 | P027 Souvlaki Kurczak | 10 | 0 | 0 | '' |
| OL-ORD-20260907-BRA-PAGO-ffdb4f-004 | P028 Souvlaki Wieprz | 2 | 0 | 0 | '' |
| OL-ORD-20260907-BRA-PAGO-ffdb4f-005 | P145 Bifteki burgers | 2 | 1 | 1 | '' |
| OL-ORD-20260907-KEN-PAGO-63620f-001 | P024 Gyros 15 KG | 1 | 0 | 0 | '' |
| OL-ORD-20260907-KEN-PAGO-63620f-002 | P026 Pita (opakowania) szt 10 | 1 | 0 | 0 | '' |
| OL-ORD-20260907-KEN-PAGO-63620f-003 | P028 Souvlaki Wieprz | 1 | 0 | 0 | '' |
| OL-ORD-20260914-BRA-PAGO-dbb70d-001 | P024 Gyros 15 KG | 6 | 6 | 90 | '' |
| OL-ORD-20260914-BRA-PAGO-dbb70d-002 | P026 Pita (opakowania) szt 10 | 3 | 3 | 36 | '' |
| OL-ORD-20260914-BRA-PAGO-dbb70d-003 | P027 Souvlaki Kurczak | 7 | 7 | 35 | '' |
| OL-ORD-20260914-BRA-PAGO-dbb70d-004 | P028 Souvlaki Wieprz | 2 | 2 | 10 | '' |
| OL-ORD-20260914-BRA-PAGO-dbb70d-005 | P145 Bifteki burgers | 1 | 1 | 4.2 | '' |
| OL-ORD-20260914-KEN-PAGO-9ec6c9-001 | P024 Gyros 15 KG | 1 | 0 | 0 | '' |
| OL-ORD-20260914-KEN-PAGO-9ec6c9-002 | P026 Pita (opakowania) szt 10 | 1 | 0 | 0 | '' |
| OL-ORD-20260914-KEN-PAGO-9ec6c9-003 | P027 Souvlaki Kurczak | 1 | 0 | 0 | '' |
| OL-ORD-20260914-KEN-PAGO-9ec6c9-004 | P028 Souvlaki Wieprz | 1 | 0 | 0 | '' |
| OL-ORD-20260914-WOL-PAGO-61280b-001 | P024 Gyros 15 KG | 6 | 0 | 0 | '' |
| OL-ORD-20260914-WOL-PAGO-61280b-002 | P026 Pita (opakowania) szt 10 | 6 | 0 | 0 | '' |
| OL-ORD-20260914-WOL-PAGO-61280b-003 | P027 Souvlaki Kurczak | 18 | 0 | 0 | '' |
| OL-ORD-20260914-WOL-PAGO-61280b-004 | P028 Souvlaki Wieprz | 3 | 0 | 0 | '' |

B line count 3+3+5+4+4 = 19; sum of B manager qty = 1. BRA 14.09 has no P025 line.

## 0.3 transport headers

| transport_id | supplier | status | created_at (UTC) | sent_at |
|---|---|---|---|---|
| TRN-20260902-PAGO-aa283f | SUP_PAGO | draft | 2026-09-02 14:23:52.685128 | null |
| TRN-20260925-PAGO-2d5342 | SUP_PAGO | draft | 2026-09-25 11:47:24.988872 | null |

## 0.4 preconditions

| check | value | expected |
|---|---|---|
| receipts_on_B_C | 0 | 0 |
| ids_taken | 0 | 0 |
| lps_bracka_p025 | 1 | 1 |
| other orders carrying either TRN marker | 0 | 0 (extra check) |
| SP_PAGO_P025 exists | 1 | 1 (extra check, FK of the C3 insert) |
