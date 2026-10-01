# Phase 1 — diff for the operator (`prod-sql-1.sql`)

- **Source:** prod read-only SELECTs, 2026-10-01 ~16:30 CEST. **Nothing has been written to prod.**
- **Scope:** the 7 active locations (WOLA, BRACKA, KEN, BROWARY, NORBLIN, ELEKTROWNIA, WESTFIELD). The 6 inactive
  locations are not touched.
- **How it runs:**
  - One `DO` block per step, one block per execution.
  - Each block re-checks the before-state below. If anything changed since this read, that block raises and changes
    nothing.
- **Held:** 1.5 (gyros nieścięty) waits until you confirm the staff message has gone out.
- **Blocked today:** 1.11d (Cappy at KEN), by a claimed order (see "Open orders").
- **Moved to `prod-sql-1b.sql`:** papryka P017 (name, unit, Helcom row) and the Prymat spice units and prices.

## Summary (row counts)

| Step | What | Rows |
|---|---|---|
| 1.1 | Names N1 | 25 products, 28 supplier rows, 1 order_note (P055 500 g → 600 g) |
| 1.2 | Oliwki P013 → 1/1/2 kg | 7 setting rows |
| 1.3 | Liść P054 → 0/0/1 opak; price 13,67 → 14,70 | 7 setting rows, 1 supplier row |
| 1.4 | Gyros `blok` → `szt` (label only) | 3 supplier rows |
| 1.5 | **HELD.** Gyros nieścięty P177 + P185 → inactive | 2 products |
| 1.6 | Miód saszetki P139 → inactive (WOLA included) | 1 product; its 3 setting rows are kept |
| 1.7 | Cukier P189 price ∅ → 4,08 | 1 supplier row |
| 1.8 | Frytki P021 `opak` → `paczka`, 22,55 → 18,86; batat P022 `opak` → `paczka` | 2 supplier rows |
| 1.9 | Rolls at NORBLIN / ELEKTROWNIA / WESTFIELD | 6 setting rows (all exist, none created) |
| 1.10a | ELEKTROWNIA Coca-Cola → glass | +2 / −2 setting rows |
| 1.10b | WESTFIELD Coca-Cola glass re-rounded | 2 setting rows |
| 1.10c | BROWARY Coca-Cola → glass | +2 / −2 setting rows |
| 1.11a | Cappy glass P190/P191; P064/P065 → "… 0,33 l PET" | +2 products, +2 supplier rows, 2 + 2 renames |
| 1.11b, c, e, f, g | Cappy glass at WOLA, BRACKA, WESTFIELD, ELEKTROWNIA, BROWARY | +10 / −10 setting rows |
| 1.11d | **BLOCKED.** Cappy glass at KEN | +2 / −2 when retried |

## 1.1 Names (screen name / supplier name in the e-mail)

| ID | Screen: now → new | Supplier name: now → new |
|---|---|---|
| P001 | Masło MR 500g (no change) | Masło MR 500g → KRUSZWICA MASŁO ROŚLINNE 500g/12 kubek |
| P012 | Hot Feta 2kg → Tirokafteri 2kg | Hot Feta (Tirokafteri) 2kg (no change) |
| P013 | Oliwki kalamata → Oliwki kalamata 2kg Bidon | Oliwki kalamata → GREEK OLIWKI KALAMATA Z PESTKĄ 2kg/6 BIDON |
| P015 | Halloumi → Halloumi Reha 200gr | Halloumi → EURIAL REHA HALLOUMI SER DO GRILLOWANIA 200g/12 |
| P021 | Frytki Aviko (opakowania) → Frytki Aviko Super Crunch 9,5mm 2,5kg | → AVIKO FRYTKI SUPER CRUNCH 9,5mm 2,5kg/4 |
| P022 | Frytki z batatów (opakowania) → Frytki z batatów Aviko 2,27kg | → AVIKO FRYTKI Z BATATÓW 9,5mm 2,27kg/5 |
| P023 | Fasolka Szparagowa (op.) → Fasolka Szparagowa mrożona 2,5kg | → IMF FASOLKA SZPARAGOWA ZIELONA CIĘTA 2,5kg/4 |
| P038 | Frytura Eppo 15L → Frytura Effo 15L | → EFFO DEEP FRY FRYTURA ROŚLINNA 15L BIB |
| P040 | Woda 5l pracownicza → Woda 5L | → KURACJUSZ WODA NIEGAZOWANA 5L |
| P041 | Olej Rzepakowy 5 L (no change) | → OLEJ UNIWERSALNY RZEPAKOWY 5L (4) |
| P042 | Ketchup Fanex VII 1,1 kg (no change) | → FANEX KETCHUP VII 1,1kg/4 PREMIUM |
| P043 | DEVELEY MUSZTARDA 3 kg → Develey Musztarda 3 kg | → Develey Musztarda 3 kg |
| P044 | FANEX MAJONEZ 4kg → Fanex Majonez 4kg | → FANEX MAJONEZ 4kg SAŁATKOWY WYŚMIENITY |
| P045 | Oliwa z Oliwek 1L (no change) | → GREEK OLIWA Z OLIWEK POMACE HELCOM 1L/15 plastik |
| P046 | CIECIORKA → Cieciorka w zalewie 400g/240g | → ROLNIK CIECIORKA W ZALEWIE 400g/240g (12) puszka |
| P047 | (no change) | → MELVIT KASZA PĘCZAK 900g/10 |
| P048 | (no change) | → ASIA SOS SRIRACHA CHILI PIKANTNY FG 730ml/12 |
| P049 | (no change) | → CD MIÓD WIELOKWIATOWY 1kg/6 |
| P050 | Pieprz → Prymat Pieprz czarny mielony 820g | → PRYMAT PIEPRZ CZARNY MIELONY 820g/9 pet |
| P051 | Oregano → Prymat Oregano 110g | → PRYMAT OREGANO 110g/6 pet |
| P052 | Papryka słodka - mielona → Prymat Papryka słodka mielona 720g | → PRYMAT PAPRYKA SŁODKA 720g/9 pet |
| P053 | Sól 1kg → Sól kamienna 1kg | → Sól kamienna 1kg |
| P054 | Liść Laurowy → Prymat Liść Laurowy 80g | Liść Laurowy 80g → PRYMAT LIŚĆ LAUROWY 80g/10 pudełko |
| P055 | Ziele Angielskie → Prymat Ziele angielskie 600g | Ziele Angielskie 500g → PRYMAT ZIELE ANGIELSKIE 600g/9 pet; note "1 opak = 500 g" → "1 opak = 600 g" |
| P084 | Opakowaie … jednocześciowe 750ml → Opakowanie … jednoczęściowe 750ml | same fix |
| P085 | … jednocześciowe 250ml → … jednoczęściowe 250ml | same fix |
| P094 | Torby fałdowane pojedycze do pity → … pojedyncze … | same fix |
| P095 | Folia Alumiuniowa → Folia Aluminiowa | same fix (active Blue Service row) |
| P121 | Gąbka do naczyń → Gąbka do naczyń 10szt | (no change) |
| P140 | KAWA JACOBS CRONAT GOLD ROZPUSZCZALNA 200g/6 → Kawa Jacobs Cronat Gold Rozpuszczalna 200gr | (no change) |
| P141 | LIPTON HERBATA YELLOW LABEL 100szt./12 koperta → Herbata Lipton Yellow Label 100szt | (no change) |
| P189 | Cukier w kostkach Diament 1kg → Cukier w kostkach Diament 0,5kg | Cukier w kostkach Diament 1 kg → DIAMANT CUKIER KOSTKA BIAŁY 0,5kg/10 |

Inactive supplier rows (Selgros, Kuchnie Świata) keep their old names. Pago "Pita (opakowania) szt 10" keeps its name
(names.md).

## 1.2 / 1.3 / 1.9 / 1.10b Thresholds (min / target / max)

| Location | Oliwki P013 (kg) | Liść P054 (opak) |
|---|---|---|
| WOLA | 0,5/1,5/1,5 → **1/1/2** | 1/1/1 → **0/0/1** |
| BRACKA | 0,5/1,5/1,5 → 1/1/2 | 0,5/1,5/1,5 → 0/0/1 |
| KEN | 0,5/2/2 → 1/1/2 | 0,1/0,5/0,5 → 0/0/1 |
| BROWARY | 1/3,3/3,3 → 1/1/2 | 0,02/0,08/0,08 (kg-like) → 0/0/1 |
| NORBLIN | 1/3/3 → 1/1/2 | 0,5/1,5/1,5 → 0/0/1 |
| ELEKTROWNIA | 1/3/3 → 1/1/2 | 0,5/1,5/1,5 → 0/0/1 |
| WESTFIELD | 1/3/3 → 1/1/2 | 0,5/1,5/1,5 → 0/0/1 |

ELEKTROWNIA counted 8,1 kg of olives on 27.09, so it will show above max until that is used up.

| Location | Rolls 80/20 P183 (rolls) | Rolls 80/80 P129 (rolls) |
|---|---|---|
| NORBLIN | 5/40/40 → **12/30/30** | 3/20/20 → **12/24/24** |
| ELEKTROWNIA | 0/0/0 → 12/30/30 | 0/0/0 → 12/24/24 |
| WESTFIELD | 0/0/0 → 12/30/30 | 0/0/0 → 12/24/24 |

Other locations' roll rows are unchanged. P142 (57/50) stays inactive.

## 1.4 / 1.6 / 1.7 / 1.8 Units, prices, deactivations

| Row | Now → after |
|---|---|
| SP_PAGO_P024 Gyros 15 KG | `blok` × 15 → `szt` × 15 |
| SP_PAGO_P025 Gyros 25 KG | `blok` × 25 → `szt` × 25 |
| SP_SPEC_P179 Kebab z Kurczaka 15KG | `blok` × 15 → `szt` × 15 |
| P177 Gyros wieprzowy nieścięty, P185 Gyros kurczak nieścięty | active → inactive (**1.5, held**) |
| P139 AGROS ŁOWICZ MIÓD … 25g/30 | active → inactive. Rows at WOLA (0,5/1,5), BRACKA (0/0/0) and NORBLIN (0/0/0) are kept. |
| SP_INTERMLECZ_P189 cukier | price ∅ → 4,08 |
| SP_INTERMLECZ_P021 frytki | `opak` → `paczka` (upp 1); 22,55 → 18,86; note "1 opak = worek 2,5 kg" → "1 paczka = 2,5 kg; karton = 4 paczki" |
| SP_INTERMLECZ_P022 frytki z batatów | `opak` → `paczka` (upp 1); note "1 opak = worek 2,27 kg" → "1 paczka = 2,27 kg"; price 46,08 unchanged |

## 1.10 Coca-Cola glass (crates of 24; target = max)

| Location | Before | After |
|---|---|---|
| ELEKTROWNIA | cans P068 50/120/120, P069 70/150/150 | glass P186 **48/120/120**, P187 **72/144/144**; can rows deleted |
| WESTFIELD | glass P186 50/100/100, P187 70/130/130 | P186 **48/96/96**, P187 **72/120/120** |
| BROWARY | cans P068 24/72/72, P069 48/96/96 | glass P186 24/72/72, P187 48/96/96; can rows deleted |
| NORBLIN | cans | unchanged (cans) |

Critical / allow-over-max flags are copied from the location's can row. These are false/false at all three
locations. Coca-Cola products are critical at product level anyway.

## 1.11 Cappy: glass 0,25 l (crate 24) vs PET 0,33 l (zgrzewka 12)

**New products:**

| ID | Screen and supplier name | Supplier row | Unit | Price |
|---|---|---|---|---|
| P190 | Cappy Jabłko 0,25 l szkło | SP_COCACOLA_P190 | skrzynka × 24 | 100,32 |
| P191 | Cappy Pomarańcza 0,25 l szkło | SP_COCACOLA_P191 | skrzynka × 24 | 100,32 |

- Copied from P186: category Napoje, `up_for_critical`, counts toward minimum, note "1 skrzynka = 24 szt".
- `is_critical = false` (see Decisions).
- P064/P065 are renamed "Cappy Jabłko 0,33 l PET" / "Cappy Pomarańcza 0,33 l PET" (screen and supplier name).

**Positions:** `inventory_order` and `display_order` stay NULL. No product and no setting on prod has an
`inventory_order` today, and no Coca-Cola supplier row has a `display_order`. P190/P191 therefore sort by ID, after
P189, not next to P064/P065. When the inventory-card-order positions are filled in, put them right after P064/P065.

**Thresholds** (min = PET min, target = max = PET max rounded to a whole crate, never 0; flags copied from the PET row):

| Location | PET now (szt) | Glass after (szt) | Note |
|---|---|---|---|
| WOLA | 12/36/36 (allow-over-max) | **12/48/48** | **Ambiguous:** 36 = 1,5 crates. Default 48 (half up); alternative 24 (`v_max` in 1.11b) |
| BRACKA | 5/12/12 (allow-over-max) | 5/24/24 | 0,5 crate → 1 crate (never 0) |
| KEN | 12/36/36 (allow-over-max) | **12/48/48** | **Ambiguous** as WOLA; **blocked today** |
| WESTFIELD | 10/24/24 | 10/24/24 | exact |
| ELEKTROWNIA | 10/24/24 | 10/24/24 | exact |
| BROWARY | 6/12/12 | 6/24/24 | 0,5 crate → 1 crate |
| NORBLIN | 10/24/24 | PET kept, no glass | D26 |

The PET rows are deleted at the six glass locations.

## Open orders on touched products (read 2026-10-01)

- **Delete guards (1.10, 1.11).** A location's block raises while that location has a `captain_submitted` or
  `manager_claimed` line for the product whose setting row it deletes.
  - **KEN 1.11d blocked:** `ORD-20260930-KEN-COCA-b8acbc` (manager_claimed since 30.09). Lines: Cappy Pomarańcza P065
    2 zgrzewki, P186 2, P187 2. Retry 1.11d once it is dispatched or cancelled.
  - Not blocked: ELEKTROWNIA and BROWARY have no open Coca-Cola orders.
  - BRACKA's sent order `ORD-20260927-BRA-COCA-acce0a` (P065) does not block. A receipt does not need the setting row.
- **Information only. Label changes keep their meaning, so there is no guard:**
  - Gyros (1.4) shows "szt" instead of "blok" on these lines:
    - `captain_submitted`: BRA d249a6, BRO a85cc6, ELE dd368c, NOR a0a6d4.
    - `manager_claimed`: KEN 81f35f, WOL e4ce78.
    - 12 `manager_sent` orders without a receipt.
  - Frytki (1.8) shows "paczka" instead of "opak" on these lines:
    - `manager_claimed` `ORD-20261001-WOL-INTE-1851ca` (P021 42, P022 4);
    - 12 `manager_sent` orders with P021 or P022 (WOLA 8, BRACKA 2, BROWARY 1, ELEKTROWNIA 1).
  - Thresholds only (1.2, 1.9), nothing on the line changes: WOL 1851ca (oliwki 1), and ELEKTROWNIA's Mory order
    `ORD-20261001-ELE-MORY-c48d59` (`captain_submitted`, P129 6, P183 20).

## Decisions I made (please confirm or change)

1. **P017 screen name moved to Phase 1b.**
   - In Phase 1 the old supplier row (Florinis, opak = 3,6 kg) is still the active one.
   - "Helcom 4,2kg/2,5kg" next to "1 opak = 3,6 kg" would mislead.
   - The name, the unit and the new row go together in 1b.1.
2. **Prymat names.**
   - Screen name: "Prymat <name> <weight>".
   - Supplier name: the invoice text verbatim ("PRYMAT … 820g/9 pet"), from `inputs/README.md` and the KEN invoice.
3. **Typo fixes** (P084, P085, P094, P095) are also applied to the supplier names. Batch N2 is not approved, so
   otherwise the typos would stay in supplier e-mails.
4. **Cappy glass `is_critical = false`.**
   - The plan text says to copy `is_critical` from P186, which is critical (Coca-Cola).
   - Cappy PET is not critical, and plan-review F4 assumed the glass Cappy are not critical either.
   - To make them critical, change `false` to `true` in the 1.11a products insert.
5. **Mins and flags.** Cappy glass mins are kept from PET, not rounded to crates; the plan rounds only max. Flags are
   copied per location from the PET row (Cappy) or the can row (Coca-Cola), as in `prod-sql-2-westfield.sql`.
6. **Ambiguous Cappy max** (WOLA, KEN 36): default 48, half up as in D33. 24 would supply less than today's 36
   bottles.
7. **Notes on threshold rows.** Every updated threshold row gets the suffix
   "[2026-10-01 feedback-1001 <step>, przed a/b/c]". The rollback strips it.
8. **1.6 guard.** Step 1.6 also checks for open P139 lines (there are none today).

## Open points / observations

- **Stale claimed Coca-Cola order at BRACKA.** `ORD-20260902-BRA-COCA-c673c7` (`manager_claimed` since 02.09)
  carries P068/P069 lines. BRACKA has had no P068/P069 setting row since 19.09 (week2-feedback). If it is sent back to
  the Captain, the edit fails with 400 today. This batch does not touch it. Suggest the Manager cancels or dispatches
  it.
- **Coca-Cola glass prices.** P186/P187 have no price (`price_estimate_pln` NULL), so Coca-Cola totals skip them.
  Cappy glass gets 100,32. Do you want Coca-Cola glass prices from the KEN invoices?
- **Names to confirm:**
  - P001 Kruszwica: names.md flags the price, 6,58 on the invoice vs 6,27 in prod.
  - P121 "Gąbka do naczyń 10szt" while it is counted per sponge. It becomes clearer when Phase 4 adds the opak-10
    case.
- **No receipts on any sent order.** All 54 `manager_sent` orders on prod have no receipt, the oldest from 23.06.
  This matters for Phase 1b (see `prod-sql-1b-diff.md`).

## Dry run (local Postgres 16, 2026-10-01)

- **Schema:** built from `supply-os-v1/migrations/0001…0027`. Column counts match prod on all 21 tables.
- **Data loaded from prod reads:**
  - all 13 locations, 14 suppliers and 189 products;
  - 80 supplier rows (every row of the touched products);
  - 194 threshold rows (touched products, all locations);
  - the 37 open orders (`captain_submitted`, `manager_claimed`, `manager_sent`) with their 66 lines on touched
    products;
  - the last spice counts.
- **Run 1:**
  - 18 blocks applied, including 1.5 so that it is exercised.
  - **1.11d raised:** "KEN: 1 open Cappy PET line(s)".
  - Audit: 18 of 19 rows ok. Row 16 (KEN Cappy) is pending.
- **Run 2:** all 19 blocks raised on their guards. The state is byte-identical to after run 1.
- **Rollback:** STEP R, uncommented and run, restored products, supplier_products and location_product_settings
  byte-identical to the before snapshot.
- **Unblock test:** with the KEN order set to `manager_sent`, 1.11d applied and the audit showed 19 of 19 ok.
