# Reconciliation: Pago (and Magazyn/Mory) orders — app vs ordering sheet vs sent mail

- Change: `pago-data-unity` (read-only). Prepared 2026-09-28.
- Window: pickups from 2026-08-20 to 2026-09-28, **Warsaw only**. The sheet also serves POZ, GDN and KRK+KTW, which are listed only in the mail section.
- Nothing was written to the database, the sheet or any mailbox. In biuro@ only threads that were already read were opened; unread threads (all Lineage WZ mails, most ODB/DRV threads) were counted from the search list and left unread.

## Sources

| Source | What was read | How |
|---|---|---|
| App (Supabase prod) | `orders`, `order_lines`, `transport_batches`, `transport_events`, `receipts`, `order_events` for `SUP_PAGO` + `SUP_MORY`, `order_date >= 2026-08-20` | `SELECT` only |
| Sheet "Ordering PB v5 prod" | `ORDER_LOG` (59 rows since 20.08; per-location `Snapshot` column), `ORDER_INPUT` (current grid), `STOCK_MOVEMENTS`, `SETTINGS`, `CITY_MASTER`, `CITY_LOCATIONS` | xlsx export → openpyxl |
| Related Drive files | Per-location "Dostawy z PAGO" billing logs (0826/0926 tabs), "Import PB v5 prod", MEZE working sheet | xlsx export (read-only) |
| biuro@pitabros.pl | Sent + all mail: "Zlecenie odbioru wlasnego …" (ODB), "Transport / odbior i rozwOz …" (DRV), "Zamówienie Pita Bros …" (app e-mail), "DOKUMENT Z FIRMY PAGO …" (Lineage WZ/PZP) | Chrome, read-only |

Quantities below come from the **final DRV document** of each pickup (the driver list; the sheet posts the stock issue on it). For every Warsaw pickup the parsed `ORDER_LOG` snapshots of the ODB that was e-mailed and of the final DRV are identical, except 16.09, where the revised ODB `-130744` equals the final DRV. The DRV PDF for 23.09, opened in Gmail, matches the snapshot figure for figure.

Abbreviations: G15 = Gyros 15 KG (blok/szt), G25 = Gyros 25 KG, SK = Souvlaki Kurczak (karton), SW = Souvlaki Wieprz (karton), Pita (karton), Bif = Bifteki Black Pork (karton). App status "(email, dd.mm hh:mm)" = `sent_method='email'` + `manager_sent_at` recorded in the app. It does **not** mean an e-mail left (see "Mail").

## Key findings

1. **The sheet is the only channel that reached Pago/Lineage.** biuro@ Sent holds 16 Warsaw ODB threads for 15 pickups: 05.09 was re-sent with a corrected hour, and the 16.09 thread carries a first ODB and a revised one. Each Warsaw pickup has exactly one Lineage release document (WZ) that fits its date. Where another city was picked up the same day (08.09, 09.09, 19.09), the two WZ of that day cover the two cities. The WZ are matched by date only; they are unread and were not opened. One WZ is unexplained: `2026/WZ/601/186391 < WZ/76/09/2026 >`, received 28.09 04:47, matches no ODB in biuro@.
2. **Only one app e-mail reached Lineage, and it was cancelled.** `ORD-20260921-WOL-PAGO-bcdfe8` went out on 21.09 11:43 from `wolskapitabros@gmail.com` (DW: biuro@). Lineage asked for the pickup date at 12:33. At 12:48 biuro@ (Sławek) asked Lineage to cancel it, saying a combined order would follow. At 17:39 Małgorzata Vafidis confirmed that the order was wrong and a new one had been sent. Wola got the goods on the 23.09 sheet pickup (receipt 23.09, all lines equal).
3. **The other app "email" dispatches never left biuro@.** Five of them exist in biuro@ only as unsent Gmail drafts "Zamówienie Pita Bros …": Browary 07.09 ×2, Wola 08.09, Browary 21.09 ×2, Browary 25.09 and KEN 25.09 (seven drafts in total). For Bracka (manager_sent 22.09 14:22 and 14:31) biuro@ holds nothing: no draft, no sent copy, no DW copy. An e-mail sent from another mailbox with the DW removed would not be visible here. The operator's note says three app e-mails went out (Bracka 22.09, KEN + Browary 25.09). biuro@ does not confirm any of the three, and Lineage issued no extra WZ. Update 28.09 (coordinator session): the note was wrong, and none of the three left the system.
4. **Where the app has an order, it agrees with the sheet.** 13 live app orders map to a sheet pickup: 9 match exactly and 4 differ (table below). In all four the sheet holds the quantity that was actually ordered and the app still holds the captain's quantity, or the manager's first version:
   - KEN 08.09: Pita 1 in the app, 2 on the sheet.
   - Wola 09.09: Pita 4 in the app, 5 on the sheet; Wola's receipt says 5.
   - Bracka 09.09: Bifteki 1 in the app, 0 on the sheet.
   - Bracka 16.09: the app has the sheet's first version; the revised sheet version is what the Bracka billing log shows.
5. **The app misses 14 location-pickups since 04.09**, when captains started ordering Pago in the app. Norblin never orders Pago in the app (7 Tue/Sat pickups on the sheet). Browary is missing 05, 12, 15 and 19.09; KEN is missing 12, 19 and 22.09. Wolska and Bracka are fully covered from 09.09 on.
6. **Both open app transports are leftovers.** `TRN-20260902-PAGO-aa283f` contains quantities that match no sheet pickup, including SKUs no longer active at Pago. `TRN-20260925-PAGO-2d5342` holds five all-zero prefilled skeletons created at 13:47; the sheet ODB for 26.09 followed at 13:55.
7. **The app's `requested_delivery_date` is not the pickup date.** The app says 08.09 for Wolska/Bracka orders that went on 09.09 (Wednesday), and 15.09 for Wolska/Bracka orders that went on 16.09. It says 08.09 for the KEN order that went on 05.09, and 29.09 for Browary/KEN orders that went on 26.09 (Saturday).
8. **Since 01.09 the sheet follows Marek's calendar.** Norblin, Browary, Elektrownia, KEN and Westfield are picked up on Tuesday and Saturday; Wolska, Bracka and MEZE on Wednesday. The ODB is created the day before the pickup, between 11:39 and 14:36 (document-number timestamps). `SUP_PAGO` in app master data has `delivery_days=Tue`, `cutoff_time=14:00`, which does not describe this calendar.

## Per pickup date × location

Rows show every location that has a non-zero sheet quantity or an app order for that pickup. "Sheet — Magazyn/Mory" lists the non-Pago items the driver collects on the same run (sheet unit names; they differ from app units, see the Magazyn section).

### 2026-08-21 (Fri)

Sheet documents: `DRV-WAW-2026-08-21-20260820-144230` (driver list, stock issue posted); `ODB-WAW-2026-08-21-20260820-144133` (Lineage pickup order). Lineage release: WZ 160738 (21.08 12:45).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Wolska | G15 5, SK 10, SW 2, Pita 4 | — | — | — | not in app (before captains ordered Pago in the app) |
| Norblin | G25 4, SK 8, SW 1, Pita 3 | Boxy PB 1, Box beżowy bez logo 6 | — | — | not in app (before captains ordered Pago in the app) |
| Browary | G15 2, SK 8, Pita 4, Bif 1 | Box beżowy bez logo 3, Papier termiczny 1, Serwetki PB 6 | — | — | not in app (before captains ordered Pago in the app) |
| Elektrownia | G25 3, SK 15, SW 2, Pita 7 | Box beżowy bez logo 3, Papier do Pita PB 1 | n/a (not an app location) | — | sheet only |
| Bracka / Nocny | G15 7, SK 10, SW 2, Pita 5, Bif 1 | Boxy PB 1, Box beżowy bez logo 3, Rolki do kas - typ 1 3 | — | — | not in app (before captains ordered Pago in the app) |
| KEN | G15 1, SW 1, Pita 2 | — | — | — | not in app (before captains ordered Pago in the app) |
| MEZE | G15 4, SK 8, Pita 6, Bif 2 | — | n/a (not an app location) | — | sheet only |
| Westfield Mokotów | G15 8, SK 10, SW 2, Pita 5 | Box beżowy bez logo 6, Serwetki PB 6 | n/a (not an app location) | — | sheet only |

### 2026-08-25 (Tue)

Sheet documents: `DRV-WAW-2026-08-25-20260824-205413` (driver list, stock issue posted); `ODB-WAW-2026-08-24-20260824-145953` (Lineage pickup order). Lineage release: WZ 163232 (25.08 14:45).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Wolska | G15 3, SK 12, SW 1, Pita 2 | Boxy PB 2, Box beżowy bez logo 2, Papier termiczny 1, Serwetki PB 6 | ORD-20260825-WOL-PAGO-a2b5c2 cancelled (abandoned app transport draft) | — | no live app order |
| Norblin | G25 6, SK 9, Pita 5 | Przyprawa 1, Box beżowy bez logo 4 | ORD-20260825-NOR-PAGO-49b7ff cancelled (abandoned app transport draft) | — | no live app order |
| Browary | G15 4, SK 8, SW 1, Pita 4 | Box beżowy bez logo 3 | — | — | not in app (before captains ordered Pago in the app) |
| Elektrownia | G25 4, SK 14, SW 2, Pita 5 | Przyprawa 1, Boxy PB 1 | n/a (not an app location) | — | sheet only |
| Bracka / Nocny | G15 3, SK 6, SW 1, Pita 3 | — | ORD-20260823/25-BRA-PAGO cancelled (abandoned app transport drafts) | — | no live app order |
| KEN | G15 1, SK 4, Pita 2 | Boxy PB 1, Papier termiczny 1 | ORD-20260823/25-KEN-PAGO cancelled (abandoned app transport drafts) | — | no live app order |
| MEZE | — | Boxy PB 1, Box beżowy bez logo 6, Papier do Pita PB 1, Papier termiczny 1, Serwetki PB 6 | n/a (not an app location) | — | sheet only |
| Westfield Mokotów | G15 6, SK 10, SW 2, Pita 7 | — | n/a (not an app location) | — | sheet only |

### 2026-08-29 (Sat)

Sheet documents: `DRV-WAW-2026-08-29-20260828-145546` (driver list, stock issue posted); `ODB-WAW-2026-08-29-20260828-145454` (Lineage pickup order). Lineage release: WZ 166294 (29.08 10:45).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Wolska | G15 2, SK 8, SW 2, Pita 2 | Boxy PB 2, Papier termiczny 1, Serwetki PB 6 | — | — | not in app (before captains ordered Pago in the app) |
| Norblin | G25 4, SW 9, Pita 4 | Box beżowy bez logo 4 | — | — | not in app (before captains ordered Pago in the app) |
| Browary | G15 6, SK 8, SW 2, Pita 3 | Boxy PB 1, Box beżowy bez logo 2, Serwetki PB 6 | — | — | not in app (before captains ordered Pago in the app) |
| Elektrownia | G25 5, SK 12, SW 2, Pita 7 | Box beżowy bez logo 4, Papier do Pita PB 1 | n/a (not an app location) | — | sheet only |
| Bracka / Nocny | G15 2, SK 2 | Boxy PB 1, Papier do Pita PB 1 | — | — | not in app (before captains ordered Pago in the app) |
| KEN | SW 1, Pita 3 | — | — | — | not in app (before captains ordered Pago in the app) |
| MEZE | G15 6, SK 8, SW 5, Pita 4 | ARMENONVILLE 1 | n/a (not an app location) | — | sheet only |
| Westfield Mokotów | G15 8, SK 10, Pita 5 | Przyprawa 1, Box beżowy bez logo 4, Papier termiczny 1, Rolki do kas - typ 1 2 | n/a (not an app location) | — | sheet only |

### 2026-09-01 (Tue)

Sheet documents: `DRV-WAW-2026-09-01-20260831-142932` (driver list, stock issue posted); `ODB-WAW-2026-09-01-20260831-142814` (Lineage pickup order). Lineage release: WZ 168134 (01.09 14:15).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Norblin | G25 4, SK 10, Pita 4 | Przyprawa 1 | — | — | not in app (before captains ordered Pago in the app) |
| Browary | G15 5, SK 12, Pita 1 | Boxy PB 1, Papier do Pita PB 1 | — | — | not in app (before captains ordered Pago in the app) |
| Elektrownia | G25 4, SK 10, Pita 3 | Boxy PB 1, Box beżowy bez logo 4, Papier termiczny 1 | n/a (not an app location) | — | sheet only |
| KEN | G15 2, SK 5, Pita 2 | Boxy PB 1 | ORD-20260901-KEN-PAGO-49137c cancelled (training data 01.09) | — | no live app order |
| Westfield Mokotów | G15 4, SK 10, Pita 3 | Boxy PB 1, Papier do Pita PB 1 | n/a (not an app location) | — | sheet only |

### 2026-09-02 (Wed)

Sheet documents: `DRV-WAW-2026-09-02-20260901-215542` (driver list, stock issue posted); `ODB-WAW-2026-09-02-20260901-143213` (Lineage pickup order). Lineage release: WZ 168759 (02.09 12:46).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Wolska | G15 7, SK 20, SW 1, Pita 3 | Przyprawa 1, Boxy PB 1, Box beżowy bez logo 2, Papier do Pita PB 1, Papier termiczny 1, Serwetki PB 6, Rolki do kas - typ 1 5 | ORD-20260831-WOL-PAGO-266502 cancelled 01.09 ("do złożenia od nowa"); G15 2, SK 20, SW 1, Pita 2 | — | no live app order |
| Bracka / Nocny | G15 7, SK 18, Pita 5 | Przyprawa 1, Box beżowy bez logo 3 | — | — | not in app (before captains ordered Pago in the app) |
| MEZE | G15 2, SK 6, Pita 2, Bif 1 | — | n/a (not an app location) | — | sheet only |

### 2026-09-05 (Sat)

Sheet documents: `DRV-WAW-2026-09-05-20260904-124311` (driver list, stock issue posted); `ODB-WAW-2026-09-05-20260904-123929 + corrected -124219` (Lineage pickup order). Lineage release: WZ 171053 (05.09 09:30, subject cites ODB …-124219).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Norblin | G25 5, SK 10, Pita 4 | Box beżowy bez logo 4, Papier do Pita PB 1, Serwetki PB 6 | — | — | NOT IN APP — ordered outside the app |
| Browary | G15 4, SK 8, Pita 3 | Boxy PB 1, Box beżowy bez logo 3 | — | — | NOT IN APP — ordered outside the app |
| Elektrownia | G25 3, SK 5, SW 1, Pita 5 | Box beżowy bez logo 3, Papier do Pita PB 1 | n/a (not an app location) | — | sheet only |
| KEN | G15 1, SW 1, Pita 2 | — | `ORD-20260904-KEN-PAGO-626d49` manager_claimed | G15 1, SW 1, Pita 2 | match |
| Westfield Mokotów | G15 3, G25 4, SK 10, Pita 4 | — | n/a (not an app location) | — | sheet only |

### 2026-09-08 (Tue)

Sheet documents: `DRV-WAW-2026-09-08-20260907-114104` (driver list, stock issue posted); `ODB-WAW-2026-09-08-20260907-113909` (Lineage pickup order). Lineage release: WZ 172916 or 172920 (08.09; KRK+KTW also picked up that day).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Norblin | G25 5, SK 9, Pita 4 | Box beżowy bez logo 4 | — | — | NOT IN APP — ordered outside the app |
| Browary | G15 6, SK 8, SW 2, Pita 4, Bif 1 | — | `ORD-20260906-BRO-PAGO-078562` manager_sent (email, 07.09 11:59) | G15 6, SK 8, SW 2, Pita 4, Bif 1 | match |
| Elektrownia | G25 4, SK 10, SW 2, Pita 5 | Boxy PB 1 | n/a (not an app location) | — | sheet only |
| KEN | G15 1, SW 1, Pita 2 | — | `ORD-20260907-KEN-PAGO-63620f` manager_claimed | G15 1, SW 1, Pita 1 | DIFF: Pita app 1 / sheet 2 |
| MEZE | — | ARMENONVILLE 9 | n/a (not an app location) | — | sheet only |
| Westfield Mokotów | G25 2, SK 6, SW 1, Pita 4 | Serwetki PB 6 | n/a (not an app location) | — | sheet only |

### 2026-09-09 (Wed)

Sheet documents: `DRV-WAW-2026-09-09-20260908-114617` (driver list, stock issue posted); `ODB-WAW-2026-09-09-20260908-114517` (Lineage pickup order). Lineage release: WZ 173527 or 173528 (09.09; GDN also picked up that day).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Wolska | G15 2, SK 20, SW 2, Pita 5 | — | `ORD-20260907-WOL-PAGO-e92ac9` closed (email 08.09 09:24; receipt 09.09) | G15 2, SK 20, SW 2, Pita 4 | DIFF: Pita app 4 / sheet 5 (receipt recorded 5) |
| Bracka / Nocny | G15 1, SK 10, SW 2, Pita 6 | — | `ORD-20260907-BRA-PAGO-ffdb4f` manager_claimed | G15 1, SK 10, SW 2, Pita 6, Bif 1 | DIFF: Bifteki app 1 / sheet 0 |
| MEZE | SK 8, Pita 3, Bif 2 | ARMENONVILLE 2 | n/a (not an app location) | — | sheet only |

### 2026-09-12 (Sat)

Sheet documents: `DRV-WAW-2026-09-12-20260911-142745` (driver list, stock issue posted); `ODB-WAW-2026-09-12-20260911-142329` (Lineage pickup order). Lineage release: WZ 175730 (12.09 09:30).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Norblin | G25 4, SK 6, SW 2, Pita 3 | Box beżowy bez logo 4 | — | — | NOT IN APP — ordered outside the app |
| Browary | G15 6, SK 10, SW 3, Pita 4 | Boxy PB 1, Papier do Pita PB 1 | — | — | NOT IN APP — ordered outside the app |
| Elektrownia | G25 4, SK 10, Pita 4 | Przyprawa 1, Boxy PB 1, Box beżowy bez logo 2, Papier do Pita PB 1, Serwetki PB 6 | n/a (not an app location) | — | sheet only |
| Bracka / Nocny | — | Przyprawa 1 | — | — | magazyn only; no app order |
| KEN | G15 2, SK 4, SW 1, Pita 1 | Boxy PB 1, Box beżowy bez logo 1, Papier termiczny 1 | — | — | NOT IN APP — ordered outside the app |
| MEZE | — | Boxy PB 3, Serwetki PB 2 | n/a (not an app location) | — | sheet only |
| Westfield Mokotów | G15 3, SK 6, Pita 4 | Boxy PB 1, Box beżowy bez logo 4, Papier do Pita PB 1 | n/a (not an app location) | — | sheet only |

### 2026-09-15 (Tue)

Sheet documents: `DRV-WAW-2026-09-15-20260914-200715` (driver list, stock issue posted); `ODB-WAW-2026-09-15-20260914-143259` (Lineage pickup order). Lineage release: WZ 177593 (15.09 11:00).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Norblin | G25 4, SK 7, SW 1, Pita 5 | — | — | — | NOT IN APP — ordered outside the app |
| Browary | G15 5, SK 9, SW 1, Pita 4, Bif 1 | Przyprawa 1, Boxy PB 1, Box beżowy bez logo 2, Papier termiczny 1 | — | — | NOT IN APP — ordered outside the app |
| Elektrownia | G25 4, SK 10, SW 2, Pita 4 | Przyprawa 1, Box beżowy bez logo 4 | n/a (not an app location) | — | sheet only |
| KEN | G15 1, SK 1, SW 1, Pita 1 | — | `ORD-20260914-KEN-PAGO-9ec6c9` manager_claimed | G15 1, SK 1, SW 1, Pita 1 | match |
| Westfield Mokotów | G15 4, G25 1, SK 10, Pita 5 | — | n/a (not an app location) | — | sheet only |

### 2026-09-16 (Wed)

Sheet documents: `DRV-WAW-2026-09-16-20260915-131555` (driver list, stock issue posted); `ODB-WAW-2026-09-16-20260915-113934 + revised -130744 (same thread)` (Lineage pickup order). Lineage release: WZ 178273 (16.09 12:00).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Wolska | G15 6, SK 18, SW 3, Pita 6 | Przyprawa 1, Boxy PB 2, Box beżowy bez logo 1, Papier termiczny 2 | `ORD-20260914-WOL-PAGO-61280b` manager_claimed | G15 6, SK 18, SW 3, Pita 6 | match |
| Bracka / Nocny | G15 8, G25 1, SK 12, SW 2, Pita 8, Bif 1 | Rolki do kas - typ 1 2 | `ORD-20260914-BRA-PAGO-dbb70d` manager_sent (email, 22.09 14:22) | G15 6, SK 7, SW 2, Pita 3, Bif 1 | DIFF: app = first sheet version (-114054); final sheet version added G15 +2, G25 +1, SK +5, Pita +5 |
| MEZE | G15 4, SK 8, Pita 6 | — | n/a (not an app location) | — | sheet only |

### 2026-09-19 (Sat)

Sheet documents: `DRV-WAW-2026-09-19-20260918-131825` (driver list, stock issue posted); `ODB-WAW-2026-09-19-20260918-131742` (Lineage pickup order). Lineage release: WZ 180688 or 180690 (19.09; GDN also picked up that day).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Norblin | G25 4, SK 10, SW 2, Pita 3 | Papier do Pita PB 1, Serwetki PB 6 | — | — | NOT IN APP — ordered outside the app |
| Browary | G15 4, SK 10, Pita 3 | Boxy PB 1, Box beżowy bez logo 2 | — | — | NOT IN APP — ordered outside the app |
| Elektrownia | G25 4, SK 10, SW 1, Pita 5 | Box beżowy bez logo 4, Papier do Pita PB 1 | n/a (not an app location) | — | sheet only |
| KEN | G15 2, SK 5, Pita 3 | Boxy PB 1 | — | — | NOT IN APP — ordered outside the app |
| Westfield Mokotów | G15 3, G25 3, SK 12, SW 1, Pita 5 | Boxy PB 1, Box beżowy bez logo 2, Papier termiczny 1, Serwetki PB 6 | n/a (not an app location) | — | sheet only |

### 2026-09-22 (Tue)

Sheet documents: `DRV-WAW-2026-09-22-20260921-140341` (driver list, stock issue posted); `ODB-WAW-2026-09-22-20260921-140322` (Lineage pickup order). Lineage release: WZ 182632 (22.09 10:15).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Norblin | G25 4, SK 9, Pita 4 | Boxy PB 1, Box beżowy bez logo 4 | — | — | NOT IN APP — ordered outside the app |
| Browary | G15 8, SK 10, SW 2, Pita 4 | — | `ORD-20260920-BRO-PAGO-f90e05` manager_sent (email, 21.09 13:58) | G15 8, SK 10, SW 2, Pita 4 | match |
| Elektrownia | G25 4, SK 10, SW 2, Pita 4 | Papier termiczny 1 | n/a (not an app location) | — | sheet only |
| KEN | G15 2, SK 2, SW 1, Pita 3 | Serwetki PB 6 | — | — | NOT IN APP — ordered outside the app |
| MEZE | — | Boxy PB 1 | n/a (not an app location) | — | sheet only |
| Westfield Mokotów | G15 1, G25 1, SK 10, Pita 5 | — | n/a (not an app location) | — | sheet only |

### 2026-09-23 (Wed)

Sheet documents: `DRV-WAW-2026-09-23-20260922-143627` (driver list, stock issue posted); `ODB-WAW-2026-09-23-20260922-143609` (Lineage pickup order). Lineage release: WZ 183256 (23.09 15:00).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Wolska | G15 7, SK 20, SW 2, Pita 7 | Boxy PB 2, Box beżowy bez logo 1 | `ORD-20260921-WOL-PAGO-bcdfe8` closed (email 21.09 11:42; receipt 23.09) | G15 7, SK 20, SW 2, Pita 7 | match |
| Bracka / Nocny | G15 2, SK 8 | Boxy PB 2 | `ORD-20260921-BRA-PAGO-b2d885` manager_sent (email, 22.09 14:31) | G15 2, SK 8 | match |
| MEZE | G15 4, SK 11, SW 5, Pita 4, Bif 3 | — | n/a (not an app location) | — | sheet only |

### 2026-09-26 (Sat)

Sheet documents: `DRV-WAW-2026-09-26-20260925-135557` (driver list, stock issue posted); `ODB-WAW-2026-09-26-20260925-135515` (Lineage pickup order). Lineage release: WZ 185594 (26.09 09:45).

| Location | Sheet — Pago | Sheet — Magazyn/Mory | App order (status) | App — Pago | Result |
|---|---|---|---|---|---|
| Norblin | G25 4, SK 6, SW 1, Pita 3 | Box beżowy bez logo 4 | — | — | NOT IN APP — ordered outside the app |
| Browary | G15 6, SK 10, SW 4, Pita 4 | — | `ORD-20260924-BRO-PAGO-ef3b5e` manager_sent (email, 25.09 13:53) | G15 6, SK 10, SW 4, Pita 4 | match (app requested date 29.09) |
| Elektrownia | G25 4, SK 12, SW 3, Pita 4 | Boxy PB 1, Box beżowy bez logo 3 | n/a (not an app location) | — | sheet only |
| KEN | SK 2, SW 1, Pita 1 | — | `ORD-20260925-KEN-PAGO-e1723f` manager_sent (email, 25.09 13:52) | SK 2, SW 1, Pita 1 | match (app requested date 29.09) |
| Westfield Mokotów | G15 3, G25 2, SK 8, SW 4, Pita 5 | Papier do Pita PB 1 | n/a (not an app location) | — | sheet only |

## Coverage per in-app location (pickups 04.09–26.09)

| Location | Sheet pickups with Pago lines | App orders matched | Not in app |
|---|---|---|---|
| WOLA (Wolska) | 09, 16, 23.09 | 3 (1 diff) | — |
| BRACKA (Bracka / Nocny) | 09, 16, 23.09 (+ 12.09 Przyprawa only) | 3 (2 diff) | — |
| KEN | 05, 08, 12, 15, 19, 22, 26.09 | 4 (1 diff) | 12, 19, 22.09 |
| BROWARY | 05, 08, 12, 15, 19, 22, 26.09 | 3 | 05, 12, 15, 19.09 |
| NORBLIN | 05, 08, 12, 15, 19, 22, 26.09 | 0 | all 7 |

Elektrownia, Westfield Mokotów and MEZE are sheet-only. The app has `ELEKTROWNIA` and `WESTFIELD` as inactive locations with no captain orders, and no MEZE location.

## Open app orders for the coming pickups (not yet on the sheet)

`ORDER_INPUT` still holds the 26.09 grid, and no Warsaw ODB has been sent after 25.09. Status as read on 28.09.

| App order | Status | Pago lines | Next pickup by Marek's calendar |
|---|---|---|---|
| `ORD-20260927-BRO-PAGO-142078` | captain_submitted | Bif 1, G15 8, Pita 4, SK 10, SW 1 + `extra_items`: "Serwetki - 10 Opak / Box pita bros - 2 Karton / T. bez logo - 4 Opak" | Tue 29.09 |
| `ORD-20260927-KEN-PAGO-81f35f` | captain_submitted | G15 1, Pita 1, SK 1 | Tue 29.09 |
| `ORD-20260928-WOL-PAGO-e4ce78` | captain_submitted (req. date 29.09) | G15 7, Pita 7, SK 20, SW 3 | Wed 30.09 (Wolska is a Wednesday location) |

## Magazyn / Mory (`SUP_MORY`) vs the sheet's MORY rows

Units differ between the systems, so counts are compared as numbers only. App units are opak / szt / box / kg; the sheet uses karton (Boxy PB, Serwetki PB, Rolki, Papier termiczny) and paczka (Box beżowy bez logo, Papier do Pita PB). The item name also differs: the app's "Tacki bez logo" appears to be the sheet's "Box beżowy bez logo". This is inferred from Wola 23.09 and the Wolska billing log, and has not been confirmed.

| App order | Status | App lines | Sheet (pickup, location) | Result |
|---|---|---|---|---|
| `ORD-20260907-WOL-MORY-482bb5` | manager_sent (manual, 08.09) | Boxy PB 1, Papier termiczny 1 | 09.09 Wolska: no MORY lines | not on sheet — unknown how it travelled |
| `ORD-20260914-BRA-MORY-0ff063` | manager_sent (manual, 14.09) | Koperty 1 box, Rolki 57×80 2 szt | 16.09 Bracka: Rolki typ 1 = 2 | Rolki match; Koperty is not a sheet item |
| `ORD-20260914-KEN-MORY-ea8850` | closed (receipt 21.09) | Skepasti box PB 1 | 19.09 KEN: Boxy PB 1. DRV 15.09 e-mail note: "Na KEN to boxy do Skepasti kwadratowe!" | probable match (19.09) |
| `ORD-20260914-WOL-MORY-46b752` | closed (receipt 16.09) | Boxy PB 2, Papier termiczny 2, Przyprawa 2 kg, Tacki 1 | 16.09 Wolska: Boxy PB 2, Papier termiczny 2, Przyprawa 1, Box beżowy 1 | Przyprawa 2 vs 1 (the sheet unit for Przyprawa is "do uzupełnienia") |
| `ORD-20260921-BRA-MORY-e17e0e` | manager_sent (manual, 22.09) | Boxy PB 2 | 23.09 Bracka: Boxy PB 2 | match |
| `ORD-20260921-WOL-MORY-0cdb48` | **manager_claimed** | Boxy PB 2, Druciak 4, Tacki 1 | 23.09 Wolska: Boxy PB 2, Box beżowy 1 | match except Druciak (not a sheet item) |
| `ORD-20260925-KEN-MORY-61b647` | cancelled ("blueservice") | Koperty 45 | — | — |
| `ORD-20260927-BRA-MORY-fb4d62` | captain_submitted | Boxy PB 1 | next Wed 30.09 | open |
| `ORD-20260927-BRO-MORY-5d8aa4` | captain_submitted | Boxy PB 2, Przyprawa 5 kg, Rolki 80×80 6, Serwetki PB 8, Tacki 4, Zszywki 3 | next Tue 29.09 | open |
| `ORD-20260927-KEN-MORY-79708d` | captain_submitted | Koperty 38, Przyprawa 1, Tacki 1, Zszywki 4 | next Tue 29.09 | open |
| `ORD-20260928-WOL-MORY-a64804` | captain_submitted | Boxy PB 3, Druciak 12, Papier termiczny 1, Rolki 57×30 30, Szczotka 1, Tacki 1 | next Wed 30.09 | open |

Browary's magazyn requests travel in free text, not as app lines:
- `captain_note` on 20.09: "Boxy pita bros-1, bez logo-2". The 22.09 sheet has no MORY lines for Browary; the earlier 19.09 pickup already had Boxy PB 1 and Box beżowy 2.
- `captain_note` on 24.09: "Boxy pita bros 2 karton, tacki bez logo -3, serwetki pita bros-4". The 26.09 sheet has **no** MORY lines for Browary.
- `extra_items` on 27.09: listed above.

Whether the 24.09 request was delivered cannot be told from these sources.

## App transports (`SUP_PAGO`)

| Transport | Status | Members | Assessment |
|---|---|---|---|
| `TRN-20260902-PAGO-aa283f` | draft (created 02.09 16:23, manager) | `ORD-20260902-BRA-PAGO-3a9bea`: G25 5, Bifteki 50, Feta blok 4, Boxy PB 5. `…-BRO-PAGO-a1fbe8`: Boxy PB 7, Długopisy 55. `…-ELE-PAGO-c11e06`: Boxy PB 6, Długopisy 55. All `manager_claimed`, `captain_user=manager-default` | Created after the 02.09 pickup. No sheet pickup has these quantities: the 05.09 sheet has no Bracka line and different Browary/Elektrownia lines. Feta blok, Boxy PB and Długopisy are inactive for `SUP_PAGO` since the move to `SUP_MORY`. Looks like a try-out. |
| `TRN-20260925-PAGO-2d5342` | draft (created 25.09 13:47) | 5 prefilled skeletons, **all quantities 0**: `ORD-20260925-BRO-PAGO-810239`, `…-ELE-PAGO-a141d9`, `…-KEN-PAGO-a3b234`, `…-NOR-PAGO-6702dd`, `…-WES-PAGO-f3732e` | Abandoned 8 minutes before the sheet ODB for 26.09 (13:55). |
| `TRN-20260901-PAGO-1fc493`, `-20260831-…-390c6b`, `-20260825-…` ×2, `-20260823-…` | cancelled | cancelled training/abandoned orders | Already clean. |
| `TRN-20260822-PAGO-b642d7` | legacy marker, no header | `ORD-20260730-WOL-PAGO-163f86` (manager_sent) | Before the window; leave. |

## Mail inventory (biuro@, read-only)

- **Pickup orders to Lineage (from the sheet):** 27 threads in Sent to `lineagelogistics.com` since 20.08: 16 Warsaw ODB threads, 3 POZ, 3 GDN, 4 KRK+KTW, plus the app e-mail from Wola on 21.09. The 26.09 ODB e-mail (opened) went to Finanse, Faktury, Biuro and the three Lineage addresses. `CITY_MASTER` lists the PAGO recipients as finanse@, fakturymeze@, manager@ and the three Lineage addresses.
- **Driver lists (from the sheet):** "Transport / odbior i rozwOz …" with a DRV PDF for every Warsaw pickup. The 23.09 one (opened) went to meteor9836, biuro@, gosia and a driver address. Its body says the stock issue was posted automatically, and its PDF has the per-location table.
- **Unsent ODB drafts** from duplicate sheet clicks, still in biuro@ Drafts: 01.09 14:31 and 18.09 13:23. `ORDER_LOG` also has ODB rows that were not sent: `-20260901-143114`, `-20260918-132303`, and `-20260922-143235` / `-143530` (created with pickup date 22.09, superseded by `-143609` for 23.09).
- **App e-mail drafts** "Zamówienie Pita Bros …" (never sent), still in biuro@ Drafts: Browary 07.09 ×2, Wola 08.09, Browary 21.09 ×2, Browary 25.09, KEN 25.09.
- **Lineage documents to biuro@** (unread, not opened): WZ releases 21.08–26.09, one per pickup per city, plus PZP (goods received by Pago) on 24.08, 08.09, 14.09, 23.09 and 28.09, and daily "STANY MAGAZYNOWE" stock files.

## Side observations (out of scope, for the operator)

- **Per-location "Dostawy z PAGO" billing logs** (owner malgorzatakv@): as of today the September tabs have columns for Wolska 02.09 and 16.09, Bracka 02.09, 12.09 and 16.09, and KEN 05.09, 12.09 and 15.09. Every value checked equals the sheet snapshot of that pickup; for Bracka 16.09 it equals the **revised** quantities. There is no column yet for Wolska/Bracka 09.09 and 23.09, or for KEN 08.09, 19.09, 22.09 and 26.09.
- **"Import PB v5 prod" `ZAMOWIENIA_PROSTE`** has two rows dated 28.09: Gyros 15 KG 180 and Gyros 25 KG 72, owner "Tata". This is a replenishment order to the producer (recipients teo@/gosia@vafidis.pl …), not a location order, so it is not part of this reconciliation.

## Limits of this reconciliation

- It covers Warsaw only.
- Quantities come from the sheet's `ORDER_LOG` snapshots. The only PDF checked by eye is the 23.09 DRV.
- WZ contents were not read; they are unread and were left that way. Reading them would give Lineage's released totals per pickup, a third independent source.
- Other mailboxes (manager@, location Gmail accounts) were not accessible. Point 3 of the key findings rests on biuro@ alone, where every app e-mail would have landed as DW unless the DW was removed.
- The 2026-09-28 operator note that three app e-mails reached the warehouse was not confirmed by biuro@ or by the WZ count. The coordinator session confirmed on 28.09 that the note was wrong.
