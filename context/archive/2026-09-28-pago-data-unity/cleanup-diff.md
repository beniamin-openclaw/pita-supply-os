# Cleanup diff — what `prod-sql.sql` would change in prod

- State read from prod Supabase with SELECT only, 2026-09-28 ~15:00 CEST. **Nothing has been written.**
- The operator approved the direction on 28.09. This file is the exact diff to check before anything touches prod.
- The script changes **14 orders and 2 transport headers**, and adds **2 transport events, 7 order events and 1 order line**.
- Nothing is sent: no e-mail, no Gmail draft, no change to biuro@ or to the Ordering sheet.
- Every statement checks the row's current state before writing. If any row has changed since this read, the whole run rolls back.

## A — cancel the two abandoned draft transports (8 orders)

All 8 orders were created by the manager (`captain_user = manager-default`).

The same change applies to each order:

- `status`: `manager_claimed` → `cancelled`.
- `supplier_order_reference`: the `TRN-…` marker → empty.
- `cancelled_at`: set to now.
- `cancelled_by`: `manager-default`.
- `cancel_reason`: names the transport and "pago-data-unity".
- Lines: unchanged.

| Order | Location | Transport | What it held (captain / manager qty) | Total |
|---|---|---|---|---|
| `ORD-20260902-BRA-PAGO-3a9bea` | Bracka | `TRN-20260902-PAGO-aa283f` | Gyros 25 KG 0/5, Bifteki 0/50, Feta blok 0/4, Boxy PB 0/5, Długopisy 0/0 | 3763.00 |
| `ORD-20260902-BRO-PAGO-a1fbe8` | Browary | `TRN-20260902-PAGO-aa283f` | Boxy PB 0/7, Długopisy 0/55 | 437.84 |
| `ORD-20260902-ELE-PAGO-c11e06` | Elektrownia | `TRN-20260902-PAGO-aa283f` | Boxy PB 0/6, Długopisy 0/55 | 384.72 |
| `ORD-20260925-BRO-PAGO-810239` | Browary | `TRN-20260925-PAGO-2d5342` | 5 lines, all 0 | — |
| `ORD-20260925-ELE-PAGO-a141d9` | Elektrownia | `TRN-20260925-PAGO-2d5342` | 5 lines, all 0 | — |
| `ORD-20260925-KEN-PAGO-a3b234` | KEN | `TRN-20260925-PAGO-2d5342` | 5 lines, all 0 | — |
| `ORD-20260925-NOR-PAGO-6702dd` | Norblin | `TRN-20260925-PAGO-2d5342` | 6 lines, all 0 | — |
| `ORD-20260925-WES-PAGO-f3732e` | Westfield | `TRN-20260925-PAGO-2d5342` | 3 lines, all 0 | — |

Transport headers `TRN-20260902-PAGO-aa283f` and `TRN-20260925-PAGO-2d5342` go from `draft` to `cancelled`. Each also gets one `batch_cancelled` event.

**Why SQL and not "Anuluj" on the Transport screen:**

- The app's transport cancel first releases members that have lines back to `captain_submitted`.
- In that state they would appear in the Bracka, Browary, KEN and Norblin captains' order lists until each one was cancelled by hand.
- The SQL ends in the state the app would reach after both steps, in one step. That state matches the 01.09 cleanup of earlier abandoned drafts: order cancelled with a trace, marker cleared, header `cancelled`, one event.

## B — close 5 historical Pago orders as ordered (from the sheet)

These are the five older Pago orders that were ordered from the Ordering sheet but still sit as "przejęte" (`manager_claimed`) in the app.

The same change applies to each order:

- `status`: `manager_claimed` → `manager_sent`.
- `sent_method`: empty → `transport`.
- `manager_user`: empty → `manager-default`.
- `manager_sent_at`: empty → the time of the pickup order (ODB) generated in the Ordering sheet, Warsaw time.

| Order | Pickup (sheet ODB) | `manager_sent_at` | Line changes | Total |
|---|---|---|---|---|
| `ORD-20260904-KEN-PAGO-626d49` | 05.09 (`ODB-WAW-2026-09-05-20260904-124219`) | 04.09 12:42:19 | none: G15 1, Pita 2, SW 1 | 723.00 (unchanged) |
| `ORD-20260907-KEN-PAGO-63620f` | 08.09 (`ODB-WAW-2026-09-08-20260907-113909`) | 07.09 11:39:09 | **Pita: manager 0 → 2** (the effective quantity goes 1 → 2, as on the sheet); G15 1, SW 1 unchanged | **629.00 → 723.00** |
| `ORD-20260907-BRA-PAGO-ffdb4f` | 09.09 (`ODB-WAW-2026-09-09-20260908-114517`) | 08.09 11:45:17 | **Bifteki: comment "nie było w zamówieniu z 09.09 (arkusz Ordering)"**; quantity stays captain 2 / manager 1, because 0 cannot be stored. G15 1, Pita 6, SK 10, SW 2 unchanged | 2706.00 (unchanged) |
| `ORD-20260914-KEN-PAGO-9ec6c9` | 15.09 (`ODB-WAW-2026-09-15-20260914-143259`) | 14.09 14:32:59 | none: G15 1, Pita 1, SK 1, SW 1 | 774.00 (unchanged) |
| `ORD-20260914-WOL-PAGO-61280b` | 16.09 (`ODB-WAW-2026-09-16-20260915-130744`) | 15.09 13:07:44 | none: G15 6, Pita 6, SK 18, SW 3 | 5913.00 (unchanged) |

Each order also gets one `reconciled_from_sheet` event naming its ODB. The Manager detail shows it under "Historia zmian".

**Why SQL and not Transport finalize:**

- Finalize would need five catch-up transports stamped with today's date, and they would sit in the Transport history next to real pickups.
- SQL records the real ordering time.
- `sent_method = transport` is exactly what finalize writes for Pago. It is also the only value for which the captain's view shows untouched lines as unchanged rather than as zeroed by the manager.

## C — Bracka 14.09 → the revised 16.09 sheet version

`ORD-20260914-BRA-PAGO-dbb70d` stays `manager_sent`. Its `sent_method = email` and `manager_sent_at = 22.09 14:22` stay unchanged. There is no receipt yet.

| Line | Before (manager qty) | After | Base |
|---|---|---|---|
| Gyros 15 KG | 6 | **8** | 90 → 120 kg |
| Pita (opakowania) szt 10 | 3 | **8** | 36 → 96 |
| Souvlaki Kurczak | 7 | **12** | 35 → 60 kg |
| Souvlaki Wieprz | 2 | 2 | — |
| Bifteki burgers | 1 | 1 | — |
| Gyros 25 KG | — (no line) | **1 (new line)** | 25 kg |

- The total goes **3879.00 → 6457.48**, and `last_edited_at` is set to now.
- The two events the app writes for such an edit are added: `line_added` and `quantities_changed`.
- The same edit could be made by hand in the app as a post-send edit. It is in the SQL so that the operator reviews one diff and one audit.

## Not touched

- `ORD-20260921-WOL-MORY-0cdb48` (Magazyn Mory, Wola 21.09) stays `manager_claimed`. It waits for Marek's answer on "Tacki bez logo" = "Box beżowy bez logo". After that, close it in the app with "Oznacz jako zamówione ✓".
- Earlier weeks: no backfill.
- The 5 Pago orders with `sent_method = email` (proposal row 9), the closed Wola orders, and all orders for 29–30.09.
- biuro@ drafts (the operator deletes them by hand) and the Ordering sheet.

## What the app shows after the run

- **Manager:**
  - The 5 B orders move from "Przejęte" to "Zamówione".
  - The 8 A orders drop out of the active lanes.
  - Both drafts disappear from the Transport list; cancelled batches are hidden by default.
- **Captains:**
  - KEN, Bracka and Wola see the B orders as ordered.
  - KEN 07.09 shows Pita changed by the manager, 1 → 2.
  - Bracka 07.09 shows the Bifteki comment.
  - Bracka 14.09 shows the new quantities and the Gyros 25 KG line.
  - Bracka, Browary, KEN and Norblin may see the cancelled manager-created orders in their order history.

## How to run it (operator)

1. Run **STEP 0** of `prod-sql.sql`, save the output as `cleanup-diff-before.md`, and check it against this file.
2. Run **STEP 1**. Expect `NOTICE: pago-data-unity cleanup applied …`. Any `ERROR` means the whole transaction was rolled back and nothing changed.
3. Run **STEP 2**. All 13 rows must show `ok = true`.
4. Re-run STEP 0 and note the "after" state in `change.md`.
5. **STEP R** restores the before-state if needed. It was tested on a local copy.
