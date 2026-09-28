# Proposal: one story for Pago orders (app ↔ ordering sheet)

- Change: `pago-data-unity`. Evidence: `reconciliation.md` in this folder.
- Operator decision 2026-09-28 (input, not re-litigated here): Pago and Magazyn for **all** Warsaw locations are sent **only** from the "Ordering PB v5 prod" sheet. The sheet holds the full picture; the app holds what the in-app locations (WOLA, BRACKA, NORBLIN, KEN, BROWARY) ordered. Nothing is sent from the app.
- Marek (ops manager, call 28.09, relayed by the coordinator session):
  - Captains of in-app locations order Pago and Magazyn in the app. Marek copies the quantities into the sheet and marks the app orders as accepted.
  - The sheet is the source for month-end usage per location, Wola included.
  - Magazyn (Mory) items, including Rolki do kasy, travel with the driver on the Pago run, so they belong on the same list.
  - WOLA and BRACKA move to one Pago delivery a week: order Monday, pickup Wednesday.
- Revised 2026-09-28 after PR #33 (`SUP_PAGO` → `transport`).
- **Operator decision 28.09:** the cleanup direction below is approved. It is prepared as `prod-sql.sql` (exact diff in `cleanup-diff.md`) and has **not** been run. Nothing in this document has been executed.

## Facts the proposal relies on (checked in code on `origin/main` and in prod, 2026-09-28)

- **`SUP_PAGO.ordering_method = 'transport'`** in prod since PR #33.
  - Per-order dispatch of a Pago order returns 409 (`main._reject_if_transport_only_supplier`, called from `manager_dispatch`).
  - The Manager order detail shows a notice with a link to Transport instead of a dispatch button.
  - A Pago order reaches `manager_sent` only through **Transport finalize** ("Zatwierdź transport") or a direct database write.
- **`SUP_MORY.ordering_method = 'manual'`**. The per-order "Oznacz jako zamówione ✓" still works for Mory orders: it records `manager_sent` and sends nothing.
- **Transport batches are single-supplier.** `transport/create` skips an order of another supplier, so a Mory order cannot join a Pago transport.
- **Transport finalize** flips members `manager_claimed → manager_sent` with `sent_method='transport'`.
  - Finalize itself sends nothing. "Zrób draft w Gmailu" on a transport creates Gmail drafts, and nothing leaves until someone sends a draft.
  - After finalize, member quantities are frozen: a member is never `editable_after_send`.
  - The logistics fields, including `notes`, can still be edited after sending (`PATCH /api/manager/transport/batch/{id}`).
- **Transport cancel does not cancel members that have lines.** It releases them to `captain_submitted` and clears the marker (`main.manager_transport_cancel`). Only a manager-created order with **no** lines is cancelled. Prefilled skeletons have lines, even all-zero ones.
- **Post-send edit** still works for a Pago order that is `manager_sent`, has no `TRN-` marker and has no receipt.
  - It covers quantities and "+ dodaj produkt".
  - It shows no Gmail button (`ResendPanel.tsx`: Gmail only when `ordering_method === "email"`).
- **A manager quantity of 0 cannot express "not ordered".** The effective quantity is `manager_final if > 0 else captain_final` (`gmail_url._effective_qty`, `frontend/src/lib/orderQty.ts`).
- **The captain's order view reads a manager 0 as "untouched" only when `sent_method = 'transport'`** (`OrderDetailPage.managerChangedLine`). For any other `sent_method`, a `manager_sent` line with manager 0 and captain > 0 is shown as zeroed by the manager.

## (a) One-time cleanup

The **Route** column answers the coordinator's question: Transport finalize, a diff-before / audit-after SQL batch, or a plain app action where neither is needed. "Close as ordered" means the order ends in `manager_sent` with the quantities the sheet's final DRV carried, with nothing sent. It then sits in "Zamówione" until someone confirms a receipt. That is accurate ("ordered, receipt not confirmed"); retroactive receipts are optional.

### Pago (`SUP_PAGO`)

| # | Order / transport | Now | Action | Route | Reason |
|---|---|---|---|---|---|
| 1 | `TRN-20260902-PAGO-aa283f` + `ORD-20260902-BRA-PAGO-3a9bea`, `ORD-20260902-BRO-PAGO-a1fbe8`, `ORD-20260902-ELE-PAGO-c11e06` | draft; members `manager_claimed` | **Cancel** | **SQL**, group A below | Created after the 02.09 pickup. Matches no sheet pickup (Bifteki 50, Długopisy 55 …). Contains SKUs no longer active at Pago. |
| 2 | `TRN-20260925-PAGO-2d5342` + `ORD-20260925-BRO-PAGO-810239`, `…-ELE-PAGO-a141d9`, `…-KEN-PAGO-a3b234`, `…-NOR-PAGO-6702dd`, `…-WES-PAGO-f3732e` | draft; 5 all-zero skeletons | **Cancel** | **SQL**, group A | Abandoned at 13:47; the 26.09 order went from the sheet at 13:55 (`ODB-WAW-2026-09-26-20260925-135515`). |
| 3 | `ORD-20260904-KEN-PAGO-626d49` | manager_claimed | **Close as ordered**, quantities unchanged | **SQL**, group B | Equals the 05.09 sheet line for KEN (G15 1, SW 1, Pita 2). |
| 4 | `ORD-20260907-KEN-PAGO-63620f` | manager_claimed | **Close as ordered**, Pita → 2 | **SQL**, group B | 08.09 sheet: G15 1, SW 1, **Pita 2** (app has 1). |
| 5 | `ORD-20260907-BRA-PAGO-ffdb4f` | manager_claimed | **Close as ordered**, Bifteki flagged in a comment | **SQL**, group B | 09.09 sheet: G15 1, SK 10, SW 2, Pita 6, **no Bifteki**. The app line (captain 2 / manager 1) cannot be set to 0 (see facts). |
| 6 | `ORD-20260914-KEN-PAGO-9ec6c9` | manager_claimed | **Close as ordered** | **SQL**, group B | Equals the 15.09 sheet line. |
| 7 | `ORD-20260914-WOL-PAGO-61280b` | manager_claimed | **Close as ordered** | **SQL**, group B | Equals the 16.09 sheet line. |
| 8 | `ORD-20260914-BRA-PAGO-dbb70d` | manager_sent (no receipt, no marker) | **Correct quantities**, otherwise leave | **SQL**, group C | The app has the first 16.09 version. The revised sheet version (`-130744` / DRV `-131555`) is G15 8, **G25 1**, SK 12, SW 2, Pita 8, Bif 1, and it matches the Bracka billing log for 16.09. |
| 9 | `ORD-20260906-BRO-PAGO-078562`, `ORD-20260920-BRO-PAGO-f90e05`, `ORD-20260924-BRO-PAGO-ef3b5e`, `ORD-20260925-KEN-PAGO-e1723f`, `ORD-20260921-BRA-PAGO-b2d885` | manager_sent | **Leave** | — | Quantities equal the sheet (08.09, 22.09, 26.09, 26.09, 23.09). Their `sent_method='email'` is inaccurate, since no e-mail left the system, but do **not** rewrite it to `transport`. On these orders a manager 0 may be a real zeroing, and `transport` would hide it in the captain view. |
| 10 | `ORD-20260907-WOL-PAGO-e92ac9` | closed | **Leave** | — | Closed orders are locked. The receipt (09.09) already records Pita 5, the sheet quantity. |
| 11 | `ORD-20260921-WOL-PAGO-bcdfe8` | closed | **Leave** | — | Equals the 23.09 sheet line. The app e-mail of 21.09 was cancelled with Lineage the same day (see reconciliation). |
| 12 | `ORD-20260927-BRO-PAGO-142078`, `ORD-20260927-KEN-PAGO-81f35f` | captain_submitted | **This week's run** | **Transport finalize** (process (b)) | For the Tuesday 29.09 pickup; its ODB has not gone out yet. `…-142078` also carries Magazyn items as free text in `extra_items` (Serwetki 10 opak, Box pita bros 2 karton, T. bez logo 4 opak). They must reach the sheet's MORY rows by hand. |
| 13 | `ORD-20260928-WOL-PAGO-e4ce78` | captain_submitted | **Wednesday run** | **Transport finalize** (process (b)) | Wolska is picked up on Wednesday 30.09, although the app date says 29.09. |
| 14 | the 14 location-pickups missing from the app (Norblin ×7, Browary ×4, KEN ×3, 05–26.09) | — | **Leave (no backfill)** | — | Creating orders after the fact would invent captain data: stock counts and reasons. The sheet already holds them and is the month-end usage source. From now on these locations order in the app (Marek, 28.09). |

#### Group A — leftover transports (#1, #2): SQL (in `prod-sql.sql`)

All 8 orders were created by the manager (`captain_user = manager-default`). The SQL cancels them in place, in one transaction:

- each order gets the cancel trace (who, when, why) and its marker is cleared;
- both headers go to `cancelled`;
- each batch gets one `batch_cancelled` event.

This is the state the app would reach, and it matches the 01.09 cleanup of earlier abandoned drafts.

The app route (Transport → "Anuluj", then "Anuluj zamówienie" ×8) was the first recommendation. It was dropped for one reason: it first releases the orders to `captain_submitted`, where they would show up in the Bracka, Browary, KEN and Norblin captains' lists until each one is cancelled.

#### Group B — five historical `manager_claimed` Pago orders (#3–#7): SQL (in `prod-sql.sql`)

Why SQL rather than finalize:

- Finalize would need **five catch-up transports**, one per pickup. Grouping them would merge five pickups into one fake pickup. Each catch-up batch would be stamped today (`created_at`, `sent_at`, `manager_sent_at`).
- They would sit in the sent-transport history next to real ones, with driver-doc and Gmail-draft buttons that someone could click.
- SQL can record the real ordering moment and adds no fake pickups.
- The orders stay post-send-editable (no marker), so a later correction is still possible in the app.

Specification (implemented in `prod-sql.sql`):

1. **Diff before.**
   - SELECT the 5 `orders` rows: `status`, `sent_method`, `manager_user`, `manager_sent_at`, `supplier_order_reference`, `total_value_estimate_pln`.
   - SELECT all their `order_lines`: `order_line_id`, `captain_final_*`, `manager_final_*`, `manager_comment`.
   - Save the result to `cleanup-diff-before.md` in this folder. That file is the rollback.
2. **Apply**, in one transaction:
   - Per order: `UPDATE orders SET status='manager_sent', sent_method='transport', manager_user='manager-default', manager_sent_at=<ODB time below> WHERE order_id=:id AND status='manager_claimed' AND supplier_order_reference IS NULL`. Each statement must hit exactly 1 row; any other count rolls the whole transaction back.
   - `sent_method='transport'` is deliberate. It is the only value for which the captain's view reads the untouched manager-0 lines correctly (see facts). No other line is written.
   - `ORD-20260907-KEN-PAGO-63620f`, Pita line: `manager_final_qty_purchase = 2` and `manager_final_qty_base = 2 × units_per_purchase_unit`. Recompute `total_value_estimate_pln` as Σ effective qty × `price_estimate_pln`, mirroring `manager_order_save`.
   - `ORD-20260907-BRA-PAGO-ffdb4f`, Bifteki line: `manager_comment = 'nie było w zamówieniu 09.09 (arkusz)'`. The quantity is unchanged, because it cannot be zeroed.
   - One `order_events` row per order, with `event_type='reconciled_from_sheet'`, the ODB number in `details` and `actor='manager-default'`. The Manager detail then shows it under "Historia zmian".
3. **Audit after.** Re-SELECT and check:
   - exactly 5 orders are `manager_sent` with `sent_method='transport'`;
   - only the two named lines changed, and only KEN 07.09's total changed;
   - the row counts of `order_lines` are unchanged.
   Record the result in `change.md`.

| Order | Pickup | Sheet ODB | `manager_sent_at` (Europe/Warsaw, from the ODB number) |
|---|---|---|---|
| `ORD-20260904-KEN-PAGO-626d49` | Sat 05.09 | `ODB-WAW-2026-09-05-20260904-124219` (corrected) | 2026-09-04 12:42:19 |
| `ORD-20260907-KEN-PAGO-63620f` | Tue 08.09 | `ODB-WAW-2026-09-08-20260907-113909` | 2026-09-07 11:39:09 |
| `ORD-20260907-BRA-PAGO-ffdb4f` | Wed 09.09 | `ODB-WAW-2026-09-09-20260908-114517` | 2026-09-08 11:45:17 |
| `ORD-20260914-KEN-PAGO-9ec6c9` | Tue 15.09 | `ODB-WAW-2026-09-15-20260914-143259` | 2026-09-14 14:32:59 |
| `ORD-20260914-WOL-PAGO-61280b` | Wed 16.09 | `ODB-WAW-2026-09-16-20260915-130744` (revised) | 2026-09-15 13:07:44 |

**Alternative, if the operator prefers no hand-written SQL on orders:** one catch-up Transport per pickup.

1. Create it with that pickup's order and name it "Zaległe — ODB dd.mm".
2. Set `pickup_date` to the real pickup.
3. In the draft, set KEN 07.09 Pita = 2 and add the Bifteki comment on BRA 07.09.
4. Finalize.

This is also status-only, and quantities freeze afterwards. The costs are the five dated-today batches described above.

#### Group C — `ORD-20260914-BRA-PAGO-dbb70d` (#8): SQL (in `prod-sql.sql`)

The change:

- G15 8, Pita 8, SK 12.
- A new Gyros 25 KG line = 1.
- The total is recomputed, and `last_edited_at` is set.
- The `line_added` and `quantities_changed` events are written, exactly as the app's post-send edit would write them.

It is in the SQL so the operator reviews one diff and one audit. The app route (edit the order, "+ dodaj produkt", "Zapisz zmiany (dosyłka)") gives the same result, sends nothing, and remains the fallback.

### Magazyn / Mory (`SUP_MORY`, `manual`)

| # | Order | Now | Action | Route | Reason |
|---|---|---|---|---|---|
| 15 | `ORD-20260921-WOL-MORY-0cdb48` | manager_claimed | **Close as ordered**, Druciak flagged in a comment — **on hold** until Marek confirms "Tacki bez logo" = "Box beżowy bez logo" (kept out of the SQL) | **App**: per-order "Oznacz jako zamówione ✓" | 23.09 sheet: Boxy PB 2, Box beżowy 1. Druciak is not a sheet item, so ask Wola whether it arrived. |
| 16 | `ORD-20260907-WOL-MORY-482bb5` | manager_sent | **Leave**, ask Marek | — | Boxy 1 + Papier termiczny 1 appear on no sheet pickup; it is unclear how they travelled. |
| 17 | `ORD-20260927-BRA-MORY-fb4d62`, `…-BRO-MORY-5d8aa4`, `…-KEN-MORY-79708d`, `ORD-20260928-WOL-MORY-a64804` | captain_submitted | **This week's runs** | **App**: per order (process (b)) | Tuesday 29.09 (BRO, KEN) and Wednesday 30.09 (BRA, WOL). |
| 18 | the other Mory orders (`…0ff063`, `…ea8850`, `…46b752`, `…e17e0e`, `…61b647`) | sent / closed / cancelled | **Leave** | — | Consistent with the sheet within the unit/name caveats in the reconciliation. |

### Mailbox hygiene (operator, by hand; I did not touch the mailbox)

biuro@ Drafts still hold seven never-sent app e-mails "Zamówienie Pita Bros …" (Browary 07.09 ×2, Wola 08.09, Browary 21.09 ×2, Browary 25.09, KEN 25.09). They also hold two unsent ODB drafts (01.09 14:31, 18.09 13:23). Any of them sent by mistake would be a duplicate order at Lineage, so deleting them removes that risk. The coordinator confirmed this is the operator's manual task.

## (b) Weekly process (Marek's rules, 17:00 captain cutoff)

| Pickup | Locations | Captain cutoff (app) | Manager sends from the sheet | Manager records in the app |
|---|---|---|---|---|
| **Tuesday** | Norblin, Browary, Elektrownia, Westfield, KEN | Sunday 17:00 | Monday, midday (observed 11:39–14:36) | Monday, right after the final DRV |
| **Wednesday** (the only Pago delivery of the week for WOLA and BRACKA) | Bracka, Wolska, MEZE | Monday 17:00 | Tuesday, midday | Tuesday |
| **Saturday** | Norblin, Browary, Elektrownia, Westfield, KEN | Thursday 17:00 | Friday, midday | Friday |

Steps for every pickup:

1. **Captains of all five in-app locations submit in the app by the cutoff.** This includes Norblin, which has ordered no Pago in the app so far.
   - They submit one Pago order and, if needed, one Magazyn (Mory) order.
   - Magazyn items (Boxy, tacki, serwetki, Rolki do kasy …) go as **lines of the Mory order**, not as free text in the Pago order's "extra_items" or note.
   - The requested delivery date is the location's next pickup day.
   - Elektrownia, Westfield and MEZE keep their current channel to Marek.
2. **Manager, the day before the pickup ("accept" = take over):**
   1. Transport → a new draft for Pago, named after the pickup (e.g. "Odbiór wt 29.09"), with `pickup_date` set. Add this pickup's in-app Pago orders. Adding them claims them, and captains can no longer edit them.
   2. Queue → Mory: claim ("Przejmij") this pickup's Mory orders.
   3. "Wyczyść formularz", then enter Pago **and** Magazyn quantities into `ORDER_INPUT`. The PAGO rows and the MORY rows share one location column, so they become one driver list. Enter them by hand today, or paste them with feature (c).
   4. Add the non-app locations and make any adjustments in the sheet.
3. **Send only from the sheet:** "Utwórz draft odbioru" (ODB → Lineage) and "Utwórz draft transportu" (DRV → driver). The app sends nothing. Never press "Zrób draft w Gmailu" on a Pago transport.
4. **Write back the same day, before finalize** ("jedność danych"):
   - **Pago:**
     - In the Transport draft matrix, set the manager quantity wherever the final DRV differs.
     - A line the sheet dropped cannot be set to 0, because it falls back to the captain's number. Add a manager comment on that line instead.
     - Optionally rename the transport with the ODB number.
     - Then "Zatwierdź transport", **only after the final DRV has gone**. This is a status change only.
   - **Magazyn:** set the manager quantities to the DRV, then "Oznacz jako zamówione ✓" per order.
   - **A sheet revision after finalize**, like the 16.09 revision: Pago quantities of a finalized transport are frozen, so write the change into the transport's notes, which stay editable. A Mory order takes a post-send edit ("Zapisz zmiany (dosyłka)"), which sends nothing.
5. **Captains confirm the delivery** in the app ("Potwierdź dostawę") against the ordered quantities. Variance and the WZ photo close the loop, and the order moves to `closed`.
6. **Weekly check (Monday morning, about 5 minutes):**
   - No Pago/Mory order is still `captain_submitted` or `manager_claimed` after its pickup day.
   - No Transport draft is older than its pickup.
   - Every Warsaw ODB of the past week has its app records for the in-app locations.

Guardrails:

- Never switch `SUP_PAGO` back to `email`.
- Never use "Zrób draft w Gmailu" for Pago transports.
- One transport per pickup, and never leave one in draft past its pickup.
- Never finalize before the final DRV.

Known limits of this process (candidate follow-ups, not part of this change):

- A manager cannot express "0 = not ordered" on a line.
- A finalized transport cannot take a quantity revision.
- Mory orders cannot join the Pago transport, because batches are single-supplier. The sheet is the one combined list; the app keeps two records per location per pickup.
- `requested_delivery_date` does not default to the location's pickup day (reconciliation, finding 7).

## (c) Optional feature: copy an app pickup (Pago + Magazyn) into `ORDER_INPUT`

**Goal:** remove the retyping in step 2.3, the place where the 09.09 and 16.09 differences start, and keep Pago and Magazyn on one list the way the sheet expects.

- **Where:** a "Kopiuj do arkusza" button on the Pago Transport draft detail.
- **Input:**
  - Pago comes from the transport's per-location aggregate (`TransportAggregateLine.per_location`).
  - Magazyn comes from the `manager_claimed` `SUP_MORY` orders of the same locations: this pickup's Mory orders, claimed in step 2.2. They are read with existing endpoints (`managerQueue(…, "manager_claimed")` filtered to `SUP_MORY`, lines via `managerOrder`).
  - The button lists the Mory orders it included, so the manager sees what went in.
- **Output:** TSV on the clipboard.
  - Rows are the 24 `ORDER_INPUT` product rows in sheet order, from "Gyros 15 KG" to "Gyros Makedonikos 15kg (próba)". This takes in the PAGO rows, the MEZE "Przyprawa" row and the eight MORY rows (Boxy PB … Rolki do kas - typ 3); BUKAT rows stay empty.
  - Columns are the 8 location columns in sheet order: Wolska, Norblin, Browary, Elektrownia, Bracka / Nocny, KEN, MEZE, Westfield Mokotów.
  - A zero is an empty cell.
  - The TSV is pasted into the first location cell of the Gyros 15 KG row of a freshly cleared form. The non-app columns are then typed as today, since the paste writes blanks there.
  - Below the block: items with no sheet row, and any Pago-order `extra_items` free text, listed per location as "poza arkuszem".
- **Location map:** WOLA→Wolska, NORBLIN→Norblin, BROWARY→Browary, ELEKTROWNIA→Elektrownia, BRACKA→Bracka / Nocny, KEN→KEN, WESTFIELD→Westfield Mokotów. MEZE has no app location.
- **Product map.** The Magazyn rows need Marek's confirmation (open question 2):

| App product | Sheet row | Evidence |
|---|---|---|
| Gyros 15 KG, Gyros 25 KG, Souvlaki Kurczak, Souvlaki Wieprz, Pita (opakowania) szt 10 | same names ("Pita"), 1:1 | counts equal on 9 matched pickups |
| Bifteki burgers (karton) | Bifteki Black Pork (karton) | assumed 1:1 — confirm |
| Boxy PB (opak) | Boxy PB (karton) | counts equal (Bracka/Wolska 23.09) — confirm unit |
| Tacki bez logo (opak) | Box beżowy bez logo (paczka) | inferred — confirm |
| Papier termiczny - aluminiowy (opak) | Papier termiczny (karton) | counts equal (Wolska 16.09) — confirm unit |
| Papier do Pita (PB), Serwetki PB, Przyprawa do souvlakow | Papier do Pita PB, Serwetki PB, Przyprawa (MEZE row) | unit unclear (Serwetki "6" on the sheet vs 8 opak in the app; Przyprawa 2 kg vs 1) — confirm |
| Rolki do kasy 57×20/30/50/80, 80×20/80 | Rolki do kas - typ 1/2/3 | mapping unknown — confirm |
| Druciak, Koperty, Zszywki, Szczotka do grilla, Skepasti box PB, Długopisy, Markery | — | listed under the block as "poza arkuszem" |

- **Scope:** frontend only. It reads existing endpoints and sends nothing. The TSV builder is a pure function with a Vitest test pinning row order, column order and the Pago + Mory merge. Labels go through `src/i18n/`. It is small: about 1–2 days once the mapping is confirmed.
- **Later, only if write-back becomes a chore:** the reverse direction. The backend would read the sheet's `ORDER_LOG` snapshot for an ODB and propose manager quantities for the matching in-app orders, with the operator confirming. This needs a service account with read access to the sheet and a location/product matcher. It is larger and not needed for data unity.

## Open questions

1. ~~Should in-app locations order Pago and Magazyn only through the app?~~ **Answered (Marek, 28.09): yes.** Remaining action for the operator: tell Norblin (none so far), and Browary and KEN (about half so far), to order every pickup in the app.
2. **→ Marek.** Is "Tacki bez logo" the sheet's "Box beżowy bez logo"? Please also confirm the unit conversions for the Magazyn items (table in (c)).
3. ~~Did the three app e-mails (Bracka 22.09, KEN and Browary 25.09) reach the warehouse?~~ **Answered (coordinator session, 28.09): no; the incident note was wrong.**
4. **→ Operator.** What is Lineage WZ `2026/WZ/601/186391 < WZ/76/09/2026 >` (28.09 04:47)? It matches no ODB in biuro@.
5. **→ Marek / Browary.** Did Browary receive the Magazyn items written in its 24.09 note (Boxy 2 karton, tacki 3, serwetki 4)? They are not on the 26.09 sheet.
6. **→ Operator.** `SUP_PAGO` master data says `delivery_days=Tue`, `cutoff_time=14:00`. Should it be updated to describe the Tue/Wed/Sat calendar? It would only be a note, because the field is per supplier, not per location.
7. ~~Group B route: SQL or catch-up transports?~~ **Answered (operator, 28.09): prepare SQL, do not run it.** Groups A, B and C are in `prod-sql.sql`; the exact diff is in `cleanup-diff.md`.
