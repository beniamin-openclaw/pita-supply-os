# Research: legacy "Ordering PB v5 prod" spreadsheet (manual Pago master-ordering process)

Source: markdown table export of ALL tabs of the Google Sheet "Ordering PB v5 prod", ~537k characters / 991 lines, read in full (sequential chunks + targeted grep/awk passes for the long repetitive log sections). This document is the durable artifact; the orchestrator conversation only received a compact summary.

**Scope note:** this workbook ("Orders" / "Ordering PB v5 prod") is downstream of a *separate* spreadsheet called **"Import PB v5 prod"** (referenced everywhere by URL `https://docs.google.com/spreadsheets/d/1whIXDcMImQaq75pNlxypTJHGKZcK_GrHOL42YckJTg8/edit`, and an older workbook `1aa74gZTPa1oNnFwS2kPm3SZvODmBNXzYqzC8KF89WiU` for early snapshots). "Import PB" is where real physical stock counts / POS sales data presumably originate (the "PB_SYNC_EXPORT" source). **This dump does not contain that workbook** — it only contains the *consumer* side (the Orders workbook that imports a stock snapshot, lets a human place a Pago order, and logs the resulting stock decrement). That other workbook is a gap for this research.

---

## 1. Tab inventory

The Apps Script menu comment (found in the `PB SYSTEM v5` tab, see §2) lists the canonical tab names:

```
ORDER_INPUT, DRIVER_PICKLIST, DRIVER_BY_LOCATION, PDF_PAGO, PDF_DRIVER,
ORDER_LOG, STOCK_MASTER, STOCK_MOVEMENTS, SETTINGS
```

Plus two front-matter blocks (city-selection panel) and two config sub-tables (CITY_MASTER, CITY_LOCATIONS) embedded inside/near SETTINGS, and one more historical-snapshot log tab whose canonical name is not stated but functions as a `PB_SYNC_EXPORT` history. Mapping dump sections (by line range in the extracted markdown, 991 lines total) to tabs:

### 1.1 "PITA BROS - PANEL WYBORU MIAST" (city selection panel) — lines 1–18
Front/landing tab. Two blocks:
- **City list** — columns: `Kod miasta | Miasto | Aktywne | ORDER_ON`. 5 rows: WAW/Warszawa, POZ/Poznan, GDN/Gdansk, KRK/Krakow, KTW/Katowice — all `Aktywne=Y`, `ORDER_ON=Y` here (contrast with CITY_MASTER's ORDER_ON below — see §5 quirks).
- **"WYBÓR DO FORMULARZA"** (selection-for-form) — columns: `Wybierz (checkbox) | Kod miasta | Miasto | (blank) | FLOW instructions (merged, repeated per row)`. 5 rows; at snapshot time `Wybierz=TRUE` only for KRK and KTW, FALSE for WAW/POZ/GDN — i.e. the operator had multi-selected Kraków+Katowice as the "active city" for this session.
- The merged FLOW text (verbatim, Polish, with escaped periods): **"FLOW  1. Zaznacz miasta 2. Odśwież widok roboczy 3. Uzupełnij ORDER_INPUT 4. Utwórz draft odbioru lub transportu"**.
- Top instruction (verbatim): **"Zaznacz miasta checkboxami, potem użyj menu: PB Orders -> 1. Odśwież widok roboczy."**

### 1.2 ORDER_INPUT ("PITA BROS — ORDERING | SIMPLE VIEW") — lines 20–55
The operator-facing order-entry screen for the currently active city (here: "KRK + KTW", a combined 2-location run). Header instruction: *"Uzupełniasz tylko żółte pola. Dla standardowego dnia używaj tylko akcji z kolumny AKCJE."* (fill only the yellow cells; for a normal day use only the AKCJE column actions).

Header block (rows 24–30) has 4 groups of columns:
1. **DANE ZAMÓWIENIA** (order data): Miasto (city), and elsewhere a "Data zamówienia" style field.
2. **TRANSPORT**: Kierowca (driver name), Samochód (vehicle plate), a free-text guard note *"---> Przed draftem transportowym zawsze sprawdź kierowcę, auto i wagę. <----"* and *"Źródło stanów pozostaje bez zmian: Import PB v5 prod."* (stock source stays Import PB v5 prod).
3. **TRANSPORT / WAGA** (weight): `Data odbioru` (pickup date), `Godzina odbioru` (pickup time), `Handoff`, `Finanse + Transport`, `Limit kg` (=700), `Łączna waga kg` (=920, computed), `Do limitu` (=0), `Ponad limit` (=220, computed = 920−700) — a driver weight-capacity check.
4. **AKCJE** (menu actions, merged label column): *"1. Wyczyść formularz / clearForm"*, *"2. Utwórz draft odbioru + PDF / createPagoDraft"*, *"3. Utwórz draft transportu + PDF / createTransportDraft"*, *"Serwis: ręczny ruch magazynowy / addManualStockMovement"*.

**Product grid** — header row (29) names active-location columns (here `KRK • Forum`, `KTW • Supersam`, then 6 more blank/unused slots — the template supports up to 8 locations per city), followed by `Razem` (sum) and a `PROD` column. Product row columns: `Group | Source Type (=supplier) | Product Name | Unit | <loc1 qty> | <loc2 qty> | ... <loc8 qty> | Razem | PROD`.

20 product rows, e.g.:
```
Mięso   | PAGO  | Gyros 15 KG              | szt      | 18 | 4 | 0×6 | 22 | 44
Mięso   | PAGO  | Gyros 25 KG              | szt      |  0 | 0 | 0×6 |  0 |  0
Mięso   | PAGO  | Souvlaki Kurczak         | karton   | 30 | 7 | 0×6 | 37 | 74
Mięso   | PAGO  | Souvlaki Wieprz          | karton   |  3 | 2 | 0×6 |  5 | 10
Pieczywo| PAGO  | Pita                     | karton   | 12 | 2 | 0×6 | 14 | 28
Mięso   | PAGO  | Bifteki Black Pork       | karton   |  0 | 0 | 0×6 |  0 |  0
Sosy/nabiał | BUKAT | Tzatziki             | pojemnik | 48 | 18| 0×6 | 66 |132
Sosy/nabiał | BUKAT | Tirokafteri/Hot Feta | pojemnik |  5 | 1 | 0×6 |  6 | 12
Sosy/nabiał | BUKAT | Feta 2 KG             | szt      |  1 | 0 | 0×6 |  1 |  2
Sosy/nabiał | BUKAT | Jogurt 5KG            | szt      |  0 | 0 | 0×6 |  0 |  0
Przyprawy   | MEZE  | Przyprawa             | do uzupełnienia | 0 | 0 | 0×6 | 0 | 0
Opakowania  | MORY  | Boxy PB               | karton   |  0 | 0 | 0×6 |  0 |  0
Opakowania  | MORY  | Box beżowy bez logo   | paczka   |  0 | 0 | 0×6 |  0 |  0
Opakowania  | MORY  | Papier do Pita PB     | paczka   |  0 | 0 | 0×6 |  0 |  0
Mat. operac.| MORY  | Papier termiczny      | karton   |  0 | 0 | 0×6 |  0 |  0
Opakowania  | MORY  | Serwetki PB           | karton   |  0 | 0 | 0×6 |  0 |  0
Mat. operac.| MORY  | Rolki do kas - typ 1  | karton   |  0 | 0 | 0×6 |  0 |  0
Mat. operac.| MORY  | Rolki do kas - typ 2  | karton   |  0 | 0 | 0×6 |  0 |  0
Mat. operac.| MORY  | Rolki do kas - typ 3  | karton   |  0 | 0 | 0×6 |  0 |  0
Inne        | PAGO  | CIASTO FILLO KANAKI 20X450G | karton | 0 | 0 | 0×6 | 0 | 0
Inne        | PAGO  | ARMENONVILLE          | karton   |  0 | 0 | 0×6 |  0 |  0
Sosy/nabiał | BUKAT | Feta 12 kg            | pojemnik |  0 | 0 | 0×6 |  0 |  0
Mięso       | PAGO  | Buffalo (próba)       | karton   |  0 | 0 | 0×6 |  0 |  0
Mięso       | PAGO  | Gyros Makedonikos 15kg (próba) | szt | 0 | 0 | 0×6 | 0 | 0
```
(23–24 product rows total; two are explicitly marked "(próba)" = trial/test SKUs, always zero, never actually ordered anywhere in the log — see §5.)

`PROD` is exactly `2 × Razem` for every single row in this snapshot — see §5 (ambiguous/likely-formula-artifact).

### 1.3 PDF_PAGO ("THE GREEK GOURMET — ZLECENIE ODBIORU WŁASNEGO") — lines 56–73
The actual **Pago order document** (a "self-pickup order" / zlecenie odbioru własnego — Pago is picked up by Pita Bros' own driver, not delivered). Legal-entity header:
- Pełna nazwa: "The Greek Gourmet Małgorzata Kubiak-Vafidis"; NIP 5222467646; Adres: "W. Laskonogiego 9", "02-496 Warszawa" (Pago's own legal identity — this is the recipient/orderer entity printed on the doc, likely Pago's own trading name used for the pickup authorization).
- Document metadata: Nr dokumentu (= generated Document No, e.g. `ODB-KRK + KTW-2026-08-24-20260821-145034`), Data odbioru, Miasto, Typ = "Odbior wlasny" (self pickup), Kierowca, Samochod, Godzina odbioru.
- Line items table — columns: `Lp. | Nr katalogowy (merged, spans 5 cols) | Jm. | Ilość`. **`Nr katalogowy` = the Pago SKU/catalog code** (e.g. `GYRSW15KG`, `SUVKUR5kg`, `SUVSW5kg`, `PITTA018`), NOT the product's friendly name — this is the code Pago's own systems need. Only rows with quantity > 0 appear (4 rows in this snapshot, matching the PAGO-sourced products from ORDER_INPUT with qty>0).

### 1.4 PDF_DRIVER intro ("PITA BROS — LISTA DLA KIEROWCY") — lines 74–97
Driver-facing pickup/delivery list header: Miasto, Data, Godzina, Document No (`DRV-...`), Kierowca, Samochód, a `PAGO / LINEAGE` merged banner (Lineage = the cold-storage/logistics partner used for Pago pickups — see email lists in SETTINGS), then a **"WSZYSTKIE PRODUKTY — TOTAL + PER LOKALIZACJA"** (all products, total + per location) mini-table:
`Lp. | Produkt | Jm. | <loc1 qty> | <loc2 qty> | Razem`. Only products with qty>0 are listed (7 rows here: Gyros 15KG, Souvlaki Kurczak, Souvlaki Wieprz, Pita, Tzatziki, Tirokafteri/Hot Feta, Feta 2 KG) — this is the driver's per-location drop-off breakdown for a multi-stop run.

### 1.5 DRIVER_PICKLIST ("PITA BROS — DRIVER PICKLIST | PER PRODUKT") — lines 98–128
Subtitle: *"Podgląd operacyjny. Czysty wydruk i PDF powstają z menu PB Workflow."* (operational preview; the clean printout/PDF is generated via the PB Workflow menu). Columns: `Source Type | Produkt | Jm. | Do zabrania (= "to take", the driver's total pickup qty) | <loc1> | <loc2> | 6× empty loc slots`. Full product list (all 20+ rows, including zero-qty ones — unlike PDF_DRIVER which filters to >0). This is the picklist the driver uses at the Pago/Lineage warehouse to physically collect goods, organized "how much of each product, split by which location it goes to."

### 1.6 ORDER_LOG ("PITA BROS — ORDER LOG") — lines 129–319 (184 data rows)
Subtitle: *"Historia draftów i dokumentów. Można sortować po dacie i usuwać testowe rekordy."* (history of drafts/documents; sortable, testing rows may be deleted).

Columns: `Timestamp | Pickup Date | City | Action Type | Mail Type | Created By | Mail Subject | Document No | PDF Name | Status | Snapshot | File URL`.

- **Action Type** — only 2 distinct values across all 184 rows: `DRAFT_PAGO`, `DRAFT_TRANSPORT`.
- **Mail Type** — only 2 distinct values: `PAGO`, `TRANSPORT` (mirrors Action Type).
- **Status** — only 2 distinct values: `"Draft created"` (for DRAFT_PAGO rows) and `"Draft created + stock issue posted"` (for DRAFT_TRANSPORT rows only) — i.e. **only the transport draft actually decrements stock**, the Pago draft is purely a document.
- **City** — free text, wildly inconsistent across the log's history (see §5): `WAW`, `Warszawa`, `POZ`, `Poznan`/`POZNAN`/`Poznań`, `GDN`, `Gdansk`/`Gdańsk`, `KRK`, `Krakow`/`Kraków`, `KTW`, `Katowice`, `KRK + KTW`, `Kraków - Katowice`, `Katowice Kraków`, `GDA/KAT`, `WAW + GDN`.
- **File URL** column is always empty in this log.
- **Snapshot** (last real column before File URL) is a long pipe-delimited free-text summary of every product/location/qty in that draft, e.g. `Gyros 15 KG [POZ • Stary Browar:9, POZ • Kamienica Kulinarna:7] total=16 | Souvlaki Kurczak [...] total=21 | ...` — this is effectively a denormalized JSON-ish audit trail baked into one cell.
- Row cadence: roughly one WAW/POZ/KRK/GDN cycle every 2–4 days from 2026-04-28 through 2026-08-21 (the file's "as-of" date), each cycle producing 1 DRAFT_PAGO + 1 DRAFT_TRANSPORT row (sometimes duplicated 2–4× per day — see §5, likely re-generated/corrected drafts, since old rows are never deleted per the "usuwać testowe rekordy" note being manual/optional).

### 1.7 DRIVER_BY_LOCATION ("PITA BROS - DRIVER VIEW | PER LOKAL") — lines 320–378
Subtitle: *"Podglad per lokalizacja. W PDF trafiaja tylko pozycje z iloscia > 0."* (view per location; only qty>0 lines make it into the PDF). One repeated block **per active location** (here: `KRK • Forum`, `KTW • Supersam`), each block: `Produkt | Jm. | Ilosc | Source`, listing all 20+ products (zero and non-zero) tagged with their supplier (`PAGO`/`BUKAT`/`MEZE`/`MORY`).

### 1.8 SETTINGS ("PB CITY ORDERS — SETTINGS") — lines 380–430
Key/value config table (`Parametr | Wartość | (blank) | Opis`) for the **currently active city context** of this workbook instance:
- Miasto = "Krakow + Katowice", Kod miasta = "KRK + KTW" (dropdown hint: "Wpisz kod miasta: WAW, POZ, KRK, GDN" — notably KTW is NOT listed as a valid standalone code hint, only WAW/POZ/KRK/GDN, even though KTW rows exist elsewhere — a quirk).
- Legal entity for PDF_PAGO: Pełna nazwa firmy = "The Greek Gourmet Małgorzata Kubiak-Vafidis", Marka skrócona = "The Greek Gourmet", NIP, Adres 1/2, Notatka odbioru = "Odbiór własny z magazynu The Greek Gourmet".
- Strefa czasowa = "Europe/Warsaw".
- Archiwum PDF PAGO / DRIVER (Google Drive Folder IDs) — both empty (not configured).
- Import PB URL (aktywny city) — points at the shared Import PB v5 prod sheet.
- Ostatni sync stock = 6/8/2026; Snapshot ID = (empty).
- A block of recipient emails (finanse@pitabros.pl, fakturymeze@gmail.com, manager@pitabros.pl, PBTransporterBro@gmail.com, biuro@pitabros.pl, gosia@vafidis.pl, plus several `emea.pl.*@lineagelogistics.com` addresses) — these are the distribution lists for PAGO vs DRIVER/TRANSPORT mail types.
- `Aktywne lokalizacje` = "KRK • Forum", "KTW • Supersam" (the 2 active locations for this workbook instance).
- **"MASTER PRODUKTÓW (auto z Import PB / awaryjnie można nadpisać ręcznie)"** — a 20-row product table (`Group | Source Type | Product Name | Unit | Sort | Active`) explicitly marked **DEPRECATED**: *"DEPRECATED (2026-06-08): lista produktow do ORDER_INPUT pochodzi ze STOCK_MASTER (PB Orders -> Serwis: Sync stock z Import PB). Ten blok NIE steruje formularzem - trzymac tylko jako referencje, nie edytowac."* (product list for ORDER_INPUT now comes from STOCK_MASTER via a sync menu action; this block is reference-only, do not edit). This is the authoritative product catalog snapshot (Group/Supplier/Name/Unit/Sort/Active) even though it's flagged stale.

### 1.9 "PB SYSTEM v5" (meta/README tab) — lines 432–453
Numbered operator runbook (verbatim, translated inline below) + the canonical tab list (§1, intro). See §2 for full flow.

### 1.10 STOCK_MASTER ("PITA BROS — STOCK MASTER | EXPECTED ON HAND") — lines 454–486
Subtitle: *"Stock źródłowy do podglądu pochodzi z Import PB → PB_SYNC_EXPORT. STOCK_MOVEMENTS zostaje jako log operacyjny zejść / korekt."* (source stock for viewing comes from Import PB → PB_SYNC_EXPORT; STOCK_MOVEMENTS remains the operational log of decrements/corrections). Color-code note: *"Blue text = input manualny, Black = formuły. Expected Stock = Opening + Manual Receipts + Manual Adjustments - Auto Issues."*

Columns: `Group | Source Type | Product | Unit | Physical Stock | In Transit | Expected Stock | Control Date | Active | Last Sync Timestamp | Source Snapshot ID | Source Workbook | Notes | PAGO NrKat`.

24 rows (the full product catalog including the 2 "(próba)" trial SKUs and Feta 12 kg). `PAGO NrKat` (Pago catalog code) is populated only for a handful of PAGO products (`GYRSW15KG`, `GYRSW25KG`, `SUVKUR5kg`, `SUVSW5kg`, `PITTA018`, `BURG-200GR`, `KAN1350`, `ARM-100GR` — note ARM-100GR is reused for both "ARMENONVILLE" and appears tagged to "Tzatziki" too, a possible data error, see §5); most BUKAT/MEZE/MORY rows have it blank. `Physical Stock` carries real numbers (e.g. Gyros 15 KG = 721.0, Souvlaki Kurczak = 1774.0) but **`Expected Stock` is 0.0 for every single row** — the formula described in the header comment is not actually populated/working in this snapshot (or its inputs are all zero) — flagged in §5.

### 1.11 STOCK_MOVEMENTS ("PITA BROS — STOCK MOVEMENTS | APPEND LOG") — lines 487–739 (246 data rows)
Subtitle: *"Automatyczne zejścia z draftów są logowane tutaj. Stock źródłowy do podglądu pochodzi z Import PB → PB_SYNC_EXPORT."* (automatic decrements from drafts are logged here).

Columns: `Timestamp | Movement Type | Document No | Pickup Date | Product | Unit | Qty Change | Signature | Note | Created By`.

- **Movement Type**: only `ISSUE_AUTO` appears in the entire dump (246/246 rows) — no manual RECEIPT/ADJUSTMENT rows exist despite the STOCK_MASTER header describing that model; manual receipts/adjustments, if they happen, are evidently entered elsewhere (probably directly in Import PB) rather than logged here.
- **Document No** prefixes: only `DRV-*` (transport draft docs) — confirms only `createTransportDraft` posts stock movements, never `createPagoDraft`.
- `Qty Change` is always negative (e.g. `-178`, `-2`, `-6`) = a per-product-per-draft decrement, one row per product per draft (so one DRV- document explodes into N movement rows, one per product ordered that day).
- `Signature` is a pipe-delimited composite: `<City> || <Pickup Date> || <Time> || <Driver Name> || <Vehicle> || <same denormalized product/location/qty summary as ORDER_LOG's Snapshot column>`.
- `Note` = `"Auto ruch z draftu transportowego | <City> | <Time>"`.
- `Created By` = an operator email (`beniaminv7@gmail.com`, `biuro@pitabros.pl`).
- One row (a very early 2026-03-14 entry for POZ) has a corrupted/placeholder time value: `Sat Dec 30 1899 23:44:00 GMT+0124 (czas środkowoeuropejski standardowy)` inside the Signature — a classic spreadsheet epoch/time-only-cell artifact (see §5).

### 1.12 CITY_MASTER (embedded config table, part of SETTINGS/PB SYSTEM v5 area) — lines 740–748
Columns: `City Code | City Name | Active | Import PB URL | Default Driver Recipients | Default PAGO Recipients | Notes | ORDER_ON`.
5 rows: WAW/POZ/GDN/KRK all `Active=Y, ORDER_ON=FALSE`; **KTW is the only city with `ORDER_ON=TRUE`**, with a Notes value `"Supersam onboarding 2026-06-15"`. This directly contradicts the front-panel's `ORDER_ON=Y` for all 5 cities (§1.1) — see §5.

### 1.13 CITY_LOCATIONS (embedded config table) — lines 749–765
Columns: `City Code | Sort | Location Name | Active`. 13 rows — the full location roster across all cities:
```
WAW 1 Wolska              Y
WAW 2 Norblin             Y
WAW 3 Browary             Y
WAW 4 Elektrownia         Y
WAW 5 Bracka / Nocny      Y
WAW 6 KEN                 Y
WAW 7 MEZE                Y
WAW 8 Westfield Mokotów   Y
POZ 1 Stary Browar        Y
POZ 2 Kamienica Kulinarna Y
GDN 1 Slony Spichlerz     Y
KRK 1 Forum               Y
KTW 1 Supersam            Y
```
(Note: "WAW 7 MEZE" is a *location* named MEZE, distinct from the "MEZE" *supplier* code used elsewhere for the "Przyprawa"/spice product — a naming collision, see §5.)

### 1.14 PB_SYNC_EXPORT history log (unnamed in dump; snapshot/import log) — lines 766–991 (224 data rows)
Columns: `Snapshot ID | Sync Timestamp | Source Workbook | City Code | SKU_ID | Product Name | Physical Stock | In Transit | Expected Stock | Control Date | Triggered By`.

This is the append-only history of every stock sync pulled from "Import PB" into this Orders workbook (via the `INIT / Sync from Import` menu action, see §2). Each sync event stamps one row per product for one city (or combined city group). Distinct `City Code` values seen: `WAW`, `POZ`, `GDN`, `POZ + GDN`, `GDN + KRK` — i.e. some early syncs were done for combined multi-city groups rather than per-city (matching the ORDER_LOG's inconsistent city-grouping quirk). `Source Workbook` is a URL to Import PB (two different workbook IDs appear across history — an older one `1aa74gZTPa1oNnFwS2kPm3SZvODmBNXzYqzC8KF89WiU` and the current one `1whIXDcMImQaq...`, i.e. Import PB itself was migrated/recreated at some point).

`SKU_ID` values follow a coded scheme: `PAGO-001`..`PAGO-008` (mapped 1:1 to Gyros 15KG, Gyros 25KG, Souvlaki Kurczak, Souvlaki Wieprz, Pita, Bifteki Black Pork, CIASTO FILLO KANAKI, ARMENONVILLE), `BUKAT-001`..`BUKAT-005`, `MORY-001`..`MORY-009`, and **`NOWE-01`..`NOWE-12`** — 12 rows per sync with **blank Product Name and all-zero values**, i.e. reserved/placeholder SKU slots for "new products not yet mapped" baked into the Import PB template (a template quirk carried through every historical snapshot).

---

## 2. The end-to-end flow

**Verbatim FLOW instruction (front panel, §1.1):** *"FLOW  1. Zaznacz miasta 2. Odśwież widok roboczy 3. Uzupełnij ORDER_INPUT 4. Utwórz draft odbioru lub transportu"* — i.e.:
1. **Zaznacz miasta** (check the city checkboxes) on the front panel.
2. **Odśwież widok roboczy** (Apps Script menu "PB Orders -> 1. Odśwież widok roboczy" — refresh the working view) — this presumably re-filters ORDER_INPUT/DRIVER_PICKLIST/DRIVER_BY_LOCATION to only the checked cities' active locations.
3. **Uzupełnij ORDER_INPUT** (fill in the yellow current-stock/order-qty cells per location, per product) on the SIMPLE VIEW screen.
4. **Utwórz draft odbioru lub transportu** (create a pickup-order draft or transport draft) via the AKCJE menu actions.

**Full operator runbook (from the "PB SYSTEM v5" README tab, §1.9, translated):**
1. In Orders, fill in CITY_MASTER and CITY_LOCATIONS (one-time/rare setup).
2. In Apps Script, paste the final code from the package (deployment step).
3. In Import PB, set the Orders URL in USTAWIENIA (settings), if you want to push the snapshot log.
4. **First**, in Import PB run "Rebuild PB Sync Export / Zatwierdź stany" (approve/finalize stock levels) — this is where the real physical counts get frozen into an exportable snapshot, in the *other* workbook.
5. **Then**, in Orders run "INIT / Sync from Import" — pulls that snapshot into STOCK_MASTER (§1.10) and appends a row per product to the PB_SYNC_EXPORT history log (§1.14).
6. Adding a new city = add rows to CITY_MASTER + CITY_LOCATIONS.
7. Stock shown in Orders is only a *read-only preview* of Import PB; STOCK_MOVEMENTS is the operational decrement log.
8. The dynamic-location template supports up to 8 active locations per city in the current PDF template.

**Per-order-cycle operator flow (reconstructed from ORDER_INPUT + AKCJE + ORDER_LOG evidence):**
1. Operator selects/confirms the active city (or combined city group, e.g. "KRK + KTW") via the front panel checkboxes and "Odśwież widok roboczy".
2. Operator fills current stock or desired order quantities per product per active location directly into ORDER_INPUT's yellow grid (columns per location).
3. Sheet computes `Razem` (per-product location sum) and total transport weight (`Łączna waga kg` vs `Limit kg`) live.
4. Operator sets Kierowca (driver) + Samochód (vehicle) + Data/Godzina odbioru (pickup date/time) in the header.
5. **"2. Utwórz draft odbioru + PDF / createPagoDraft"** — generates the Pago pickup-order document (PDF_PAGO tab, using Pago catalog codes and the "Greek Gourmet" legal-entity self-pickup letterhead), assigns a `Document No` = `ODB-<City>-<PickupDate>-<Timestamp>`, appends a `DRAFT_PAGO` row to ORDER_LOG with Status = "Draft created" (no stock effect), and (implicitly, per the SETTINGS recipient lists) emails it to the PAGO/finance/Lineage distribution list.
6. **"3. Utwórz draft transportu + PDF / createTransportDraft"** — generates the driver-facing transport/pickup list (PDF_DRIVER, DRIVER_PICKLIST, DRIVER_BY_LOCATION tabs), assigns `Document No` = `DRV-<City>-<PickupDate>-<Timestamp>`, appends a `DRAFT_TRANSPORT` row to ORDER_LOG with Status = "Draft created + stock issue posted", **and this is the action that writes N rows (one per ordered product) to STOCK_MOVEMENTS as negative `ISSUE_AUTO` quantities** — i.e. stock is decremented against the *transport* draft, not the Pago order itself. Emails go to the DRIVER/TRANSPORT distribution list.
7. **"1. Wyczyść formularz / clearForm"** — resets ORDER_INPUT's yellow cells for the next cycle.
8. **"Serwis: ręczny ruch magazynowy / addManualStockMovement"** — an escape hatch to manually append a STOCK_MOVEMENTS row outside the normal draft flow (for corrections) — never actually exercised in this log's history (§1.11: 0 manual rows found).

**What is the OUTPUT of the process?** Two separate documents per order cycle, generated together but logically distinct:
- **A Pago order** (`ODB-*`): a self-pickup order document addressed to Pago under the "The Greek Gourmet" legal entity, listing Pago catalog codes + quantities, used to authorize the driver's pickup at Pago/Lineage's warehouse. This is *not* an email-to-supplier in the Supply OS sense — Pago fulfillment here is a warehouse **self-pickup**, not a delivery.
- **A transport/driver plan** (`DRV-*`): the driver's picklist + per-location drop plan (this is effectively a **multi-location consolidated order + delivery-route sheet in one document** — closer to Supply OS's non-goal "Pago internal warehouse pipeline… driver delivery plan").
- There is **no separate "usage/zużycie" report or document** — the closest thing is the STOCK_MOVEMENTS append-log (decrements only) and the STOCK_MASTER "Expected Stock" formula (never actually populated in this snapshot).
- No supplier email is visibly composed inside this workbook itself (no Gmail-draft equivalent found); dispatch appears to rely on the sheet's own PDF-attachment + distribution-list mail merge (SETTINGS recipient emails), driven by Apps Script, not visible as content in this dump.

---

## 3. Data model

**Products** (from STOCK_MASTER / deprecated SETTINGS master, 24 rows total, `Group | Source Type | Name | Unit`):

| Group | Source Type (supplier) | Product | Unit |
|---|---|---|---|
| Mięso | PAGO | Gyros 15 KG | szt |
| Mięso | PAGO | Gyros 25 KG | szt |
| Mięso | PAGO | Souvlaki Kurczak | karton |
| Mięso | PAGO | Souvlaki Wieprz | karton |
| Pieczywo | PAGO | Pita | karton |
| Mięso | PAGO | Bifteki Black Pork | karton |
| Sosy / nabiał | BUKAT | Tzatziki | pojemnik |
| Sosy / nabiał | BUKAT | Tirokafteri / Hot Feta | pojemnik |
| Sosy / nabiał | BUKAT | Feta 2 KG | szt |
| Sosy / nabiał | BUKAT | Jogurt 5KG | szt |
| Sosy / nabiał | BUKAT | Feta 12 kg | szt (deprecated master) / pojemnik (STOCK_MASTER) — **unit mismatch, see §5** |
| Przyprawy | MEZE | Przyprawa | do uzupełnienia (literally "to fill in" — unit never set) |
| Opakowania | MORY | Boxy PB | karton |
| Opakowania | MORY | Box beżowy bez logo | paczka |
| Opakowania | MORY | Papier do Pita PB | paczka |
| Materiały operacyjne | MORY | Papier termiczny | karton |
| Opakowania | MORY | Serwetki PB | karton |
| Materiały operacyjne | MORY | Rolki do kas - typ 1 | karton |
| Materiały operacyjne | MORY | Rolki do kas - typ 2 | karton |
| Materiały operacyjne | MORY | Rolki do kas - typ 3 | karton |
| Inne | PAGO | CIASTO FILLO KANAKI 20X450G | karton |
| Inne | PAGO | ARMENONVILLE | karton |
| Mięso | PAGO | Buffalo (próba) | karton — trial SKU, always 0, never ordered |
| Mięso | PAGO | Gyros Makedonikos 15kg (próba) | szt — trial SKU, always 0, never ordered |

Additionally, STOCK_MOVEMENTS/ORDER_LOG history references two more purchase-unit variants not in the master list: `"Rolki do kas - 80/80"` and `"Rolki do kas - 57/30"` (seen in a 2026-05-11/12 WAW order, §1.6/1.11) — these look like a later, more specific renaming/split of "Rolki do kas - typ 1/2/3" that was never reconciled back into the master (see §5).

**Suppliers / "Source Type"**: `PAGO`, `BUKAT`, `MEZE` (also used inconsistently as a *location* name at WAW — collision), `MORY`. Only PAGO products get a `PAGO NrKat` catalog code and appear on the PDF_PAGO document; the others (BUKAT/MEZE/MORY) appear to be tracked in this same sheet for the driver/stock workflow but are NOT part of the Pago order document — i.e. **this sheet conflates "Pago order" with "generic multi-supplier consolidated stock-out tracking for whatever the driver carries that day."**

**Locations** (CITY_LOCATIONS, §1.13) — 13 rows across 5 cities, each with a `Sort` order and `Active` flag; no location IDs, only free-text names scoped by City Code + Sort.

**Cities** — 5: WAW, POZ, GDN, KRK, KTW, each with `Active` (Y/N) and `ORDER_ON` (TRUE/FALSE) flags in CITY_MASTER, plus default recipient email lists split by mail type (PAGO vs DRIVER).

**Per-location ordered quantities**: stored ONLY transiently in ORDER_INPUT's live grid (one column per active location, up to 8 slots) — never persisted as a normalized "quantity per product per location per date" table; that data survives only inside the denormalized free-text `Snapshot`/`Signature` strings in ORDER_LOG and STOCK_MOVEMENTS (e.g. `"Gyros 15 KG [POZ • Stary Browar:9, POZ • Kamienica Kulinarna:7] total=16"`).

**Aggregation columns**: `Razem` (= sum of all location columns for that product, that order) and the still-unexplained `PROD` column (= `2 × Razem` in this snapshot, §5).

**Usage / zużycie / consumption**: the literal words "zużycie", "rozchód", "konsumpcja", "consumption" do **not** appear anywhere in the dump. The closest concept is the STOCK_MASTER header formula comment: *"Expected Stock = Opening + Manual Receipts + Manual Adjustments - Auto Issues"* — i.e. usage is implicitly `Auto Issues` (= the sum of negative STOCK_MOVEMENTS `Qty Change` rows, which are themselves just "however much was ordered/dispatched", not actual sales/consumption at the location). **There is no independent measurement of true consumption (e.g. from POS/GoStock) in this workbook** — "usage" here means "what we sent out," not "what got used up." `Physical Stock` in STOCK_MASTER is a manually-synced snapshot from Import PB (presumably itself fed by a real inventory count or GoStock elsewhere), and `Expected Stock` — the field that would combine physical stock with issues/receipts to project current holdings — is **not actually computed/populated** in this snapshot (always 0.0), so even the "issues-based" usage proxy is not wired up end-to-end in the visible data.

**Prices**: no price/cena/PLN/koszt field exists anywhere in this workbook (confirmed by full-text search) — this manual process carries no cost data at all.

**Pago SKU codes** (`PAGO NrKat` / "Nr katalogowy" on the PDF): `GYRSW15KG`, `GYRSW25KG`, `SUVKUR5kg`, `SUVSW5kg`, `PITTA018`, `BURG-200GR`, `KAN1350`, `ARM-100GR` — populated for only 8 of the 24 products (all PAGO-supplied, minus the 2 trial SKUs and 2 KANAKI/ARMENONVILLE rows which get different codes than expected — see §5 for the ARM-100GR reuse anomaly).

---

## 4. Aggregation & math

- **Per-order aggregation**: `Razem` = arithmetic sum, across the up-to-8 active-location columns, of the operator-entered quantity for that product, in **purchase units already** (e.g. `karton`, `szt`, `pojemnik`, `paczka`) — there is no separate "kg vs cartons" conversion visible; the sheet works entirely in each product's fixed purchase unit as defined in the master (no `units_per_purchase_unit` concept, no rounding rule, unlike Supply OS's `SupplierProduct.units_per_purchase_unit` / `RoundingRule`). Quantities are always small whole numbers (0–66 in the samples), consistent with manual entry of whole purchase units.
- **`PROD` column**: computed as exactly `2 × Razem` in every observed row of this snapshot. No comment/label explains the multiplier. Plausible explanations (unverified — the Apps Script source is not in this dump): (a) a leftover/broken formula referencing the wrong range and double-counting, (b) a "2-day buffer" or "next cycle forecast" column, (c) a unit-conversion column (e.g. some products come 2-per-case) that happens to be 2× for every product in this particular snapshot by coincidence. **Flagged as an open question for the operator** rather than resolved here.
- **No aggregation of quantities across separate cities** happens automatically — when the operator groups two cities together (e.g. "KRK + KTW"), it is because they manually selected both as "Wybierz=TRUE" on the front panel and the workbook processes them as one combined order/transport cycle sharing one `Document No` and one driver/vehicle/date. This is an **operator-driven grouping decision**, not a fixed city→order mapping — the same city has sometimes been ordered solo (`KRK`, `KTW` separately) and sometimes combined (`KRK + KTW`), inconsistently, across the log's history (§1.6).
- **Weight math**: `Łączna waga kg` (total weight) appears to be a separate manual or formula-driven field (not derivable from the visible per-product data, since products aren't tagged with a per-unit weight anywhere) checked against `Limit kg` (transport capacity, e.g. 700kg) to compute `Do limitu` / `Ponad limit` (under/over capacity) — a **pre-dispatch capacity guardrail with no Supply OS equivalent**.
- **Usage/"zużycie" derivation**: as noted in §3, the intended formula is `Expected Stock = Opening + Manual Receipts + Manual Adjustments − Auto Issues`, where `Auto Issues` = the STOCK_MOVEMENTS negative decrements posted automatically whenever a `DRAFT_TRANSPORT` is created (one row per product per draft, `Qty Change` = −(that product's `Razem` for that draft)). In practice, in this snapshot, `Expected Stock` is always 0 and no Manual Receipt/Adjustment rows exist, so the formula is described but not demonstrably operating end-to-end on real data.
- **Rounding**: no rounding logic is visible; all observed quantities are already-whole numbers entered by the operator (no fractional kg, no purchase-unit conversion math shown).

---

## 5. Quirks & gotchas

1. **`PROD` column = 2× `Razem` for every row, unexplained.** No label/comment justifies the multiplier (§4). Needs operator clarification before any migration decision treats it as meaningful.
2. **`ORDER_ON` flag conflict**: the front-panel city list (§1.1) shows `ORDER_ON=Y` for all 5 cities, but the CITY_MASTER config table (§1.12) shows `ORDER_ON=TRUE` only for KTW (with all others FALSE, and a note "Supersam onboarding 2026-06-15" suggesting KTW was mid-rollout at snapshot time). Two same-named flags, two different sources of truth, disagreeing.
3. **Inconsistent city naming throughout ORDER_LOG's `City` free-text column** over its ~4-month history: `WAW`/`Warszawa`, `POZ`/`Poznan`/`POZNAN`/`Poznań`, `GDN`/`Gdansk`/`Gdańsk`, `KRK`/`Krakow`/`Kraków`, `KTW`/`Katowice`, plus combined forms `KRK + KTW`, `Kraków - Katowice`, `Katowice Kraków`, `GDA/KAT`, `WAW + GDN` — free text entered per cycle, not a controlled/looked-up value, so any downstream reporting keyed on "City" has to fuzzy-match.
4. **Inconsistent city grouping**: sometimes each city is ordered independently (one `Document No` per city per day), sometimes two cities are combined into one order/transport cycle (`KRK + KTW`, `POZ + GDN`, `GDN + KRK`, `WAW + GDN`) sharing one driver/vehicle/pickup slot — an operator judgment call with no fixed rule, and it changed over time (early history has more solo-city entries; later history — closer to the snapshot date — leans toward combined KRK+KTW runs).
5. **Duplicate/near-duplicate draft rows same day**: several dates in ORDER_LOG show 2–4 `DRAFT_PAGO`/`DRAFT_TRANSPORT` rows with the same Pickup Date and near-identical Snapshot content but different timestamps/Document Nos (e.g. GDN 2026-04-30/05-01 has 4 draft rows within ~1.5 hours) — likely the operator regenerating/correcting a draft rather than 4 separate real orders; the sheet has no cancel/void mechanism, old drafts are just left in the log ("Można... usuwać testowe rekordy" — deletion is a manual, optional cleanup the operator may or may not do).
6. **Unit mismatch for "Feta 12 kg"**: `szt` in the deprecated SETTINGS product master (§1.8, row marked DEPRECATED) vs `pojemnik` in the authoritative STOCK_MASTER (§1.10) — the two "master" tables disagree with each other even though one explicitly defers to the other.
7. **"MEZE" name collision**: used both as a *supplier/Source Type* code (for the "Przyprawa" spice product) and as a *location name* at WAW ("WAW 7 MEZE" in CITY_LOCATIONS) — genuinely ambiguous without context which "MEZE" a given cell refers to.
8. **"Rolki do kas" unit fragmentation**: master list has generic "typ 1/typ 2/typ 3", but at least one real WAW order (2026-05-11/12) instead ordered "Rolki do kas - 80/80" and "Rolki do kas - 57/30" (paper-roll sizes) — a more specific naming that appears in STOCK_MOVEMENTS/ORDER_LOG free text but was never added back to the product master, so it's untraceable as a catalog SKU.
9. **Trial/test SKUs live permanently in the master**: "Buffalo (próba)" and "Gyros Makedonikos 15kg (próba)" appear in every product list (ORDER_INPUT, STOCK_MASTER, DRIVER_PICKLIST, DRIVER_BY_LOCATION) but are always 0 and never appear in any real order in the 4-month ORDER_LOG history — dead weight in the catalog, or forward-looking placeholders for products still being negotiated.
10. **`Expected Stock` is always 0.0** in STOCK_MASTER despite a documented formula (`Opening + Manual Receipts + Manual Adjustments − Auto Issues`) — either the formula isn't actually wired into these cells, or all its inputs genuinely evaluate to a net that always rounds to the raw value shown as 0 — cannot be resolved from a static export; needs the live sheet (with formulas, not just values) to confirm.
11. **`PAGO NrKat` "ARM-100GR" reused**: the same code `ARM-100GR` is recorded against BOTH "Tzatziki" and "ARMENONVILLE" in STOCK_MASTER — either a genuine shared/repackaged Pago SKU or a copy-paste error in the master data.
12. **Corrupted timestamp artifact**: one very early (2026-03-14) STOCK_MOVEMENTS `Signature` field contains a broken time value `Sat Dec 30 1899 23:44:00 GMT+0124 (czas środkowoeuropejski standardowy)` — a classic Google Sheets "duration/time-only" cell being read as an absolute date epoch, meaning at least one historical draft's pickup time was garbled at source (Apps Script likely read an empty/malformed time cell).
13. **`NOWE-01`..`NOWE-12` placeholder SKUs**: every PB_SYNC_EXPORT snapshot carries 12 blank-name, all-zero rows for "new product" slots — a fixed-width template artifact from Import PB, not real products; must be filtered out of any downstream product catalog.
14. **Snapshot ID mostly blank in the later history**: only the very first row (`SNAP-20260314-115446`) carries a Snapshot ID; the remaining 223 PB_SYNC_EXPORT rows have this column empty, so most sync events cannot be grouped/deduplicated by snapshot after the first one.
15. **Merged-cell markup**: the export represents Google Sheets merged cells as a literal `[merged] <repeated text>` in every physically-merged cell of that block (escaped as `\[merged\]` in the raw markdown) — this repeats section titles/instructions once per underlying column and must be de-duplicated by anyone parsing this dump programmatically.
16. **KTW absent from the SETTINGS city-code hint**: the "Kod miasta" field's helper text says *"Wpisz kod miasta: WAW, POZ, KRK, GDN"* — KTW is not listed even though KTW is actively used and is the only city flagged `ORDER_ON=TRUE` in CITY_MASTER — the hint text was seemingly never updated after Katowice/Supersam onboarding.
17. **PDF_PAGO's legal entity ("The Greek Gourmet") is not "Pita Bros"** — the self-pickup document is issued under a different registered business name/NIP than the brand name used everywhere else in the sheet, worth clarifying with the operator whether this is a deliberate related-entity structure.

---

## 6. Mapping hints to Supply OS

| Legacy sheet concept | Supply OS app concept | Notes |
|---|---|---|
| CITY_MASTER / CITY_LOCATIONS rows | `Location` (per-location, not per-city) | App has no "city" grouping level at all — every legacy city+location pair (e.g. "KRK • Forum") would map to one `Location.location_id`. The legacy "combine two cities into one order" behavior (§5.4) has **no Supply OS analog** — the app is strictly per-location, per-supplier. |
| PAGO / BUKAT / MEZE / MORY "Source Type" | `Supplier.supplier_id` | Direct match — these are supplier codes. Only PAGO currently exists as `SUP_PAGO`-equivalent context in the PRD; BUKAT is already a known supplier in prod. MEZE and MORY appear to be additional suppliers not yet modeled in Supply OS at all (gap). |
| Product master rows (Group/Source Type/Name/Unit) | `Product` + `SupplierProduct` | `Group` ≈ `Product.product_category`; `Name` ≈ `product_name_pl`; `Unit` ≈ `SupplierProduct.purchase_unit`; `Source Type` ≈ the `supplier_id` a `SupplierProduct` row belongs to. `PAGO NrKat` ≈ `SupplierProduct.supplier_product_name`/an external SKU field (app currently has no dedicated Pago-catalog-code field distinct from `supplier_product_name` — worth checking if that's sufficient). |
| ORDER_INPUT per-location quantity grid | Captain Submit screen (`/captain-v2`), `OrderLineSubmit.captain_final_qty_purchase` | Direct conceptual match, but the legacy sheet lets ONE operator enter quantities for MULTIPLE locations at once in one grid (no per-Captain-token, per-location scoping) — Supply OS's model is one Captain token = one location, submitting separately. The legacy multi-location-at-once entry is closer to a **Manager-side bulk/consolidated view than a Captain flow**. |
| "Razem" (per-product sum across locations) | No direct equivalent | Supply OS doesn't aggregate across locations into one supplier order — each location submits its own order independently, and the Manager dispatches per-order, not per-consolidated-city-run. **This is the biggest structural gap**: the legacy process is fundamentally a **multi-location consolidated purchase + delivery run**, while Supply OS is single-location-order-at-a-time. |
| PDF_PAGO (self-pickup order doc, "Zlecenie odbioru własnego") | `ManagerDispatchResponse` / dispatch (currently email-only for Bukat pilot) | No self-pickup / portal-order concept exists yet for Pago specifically; PRD's `OrderingMethod` enum (email/portal/phone/manual) could hold "self-pickup" under `manual` or a new value — open design question. |
| PDF_DRIVER + DRIVER_PICKLIST + DRIVER_BY_LOCATION (driver route/picklist, split by product and by location) | **No equivalent** | Supply OS's Non-Goals explicitly exclude "Pago internal warehouse pipeline… driver delivery plan" — this is precisely that pipeline. This is the single largest capability gap the new feature will need to fill if it's meant to replace this manual process end-to-end. |
| ORDER_LOG (draft history, denormalized per-product Snapshot text) | `Order` + `OrderLine` (normalized, persisted rows) | Direct conceptual replacement — Supply OS already does this properly (structured rows vs. free-text blobs) for the pilot suppliers. Extending to Pago/multi-location would reuse this as-is. |
| STOCK_MASTER "Physical Stock" (synced from Import PB) | `InventoryCount` / `InventoryCountLine` (Location Inventory Count, FR-015–019) | Conceptually close — a location-wide stock snapshot — but STOCK_MASTER's stock is aggregated (not obviously per-location; the dump doesn't show per-location physical stock, only totals per product) whereas Supply OS's `InventoryCount` is explicitly per-location. Import PB itself (the true source of physical counts) is entirely outside this dump and outside Supply OS today — a real gap to investigate before assuming inventory counts map cleanly. |
| STOCK_MOVEMENTS (auto stock decrements per dispatched draft) | No direct equivalent (closest: `OrderLine.captain_final_qty_base`/`manager_final_qty_base` implicitly represents "what was ordered," but Supply OS does not maintain a running stock ledger) | The PRD's `receipts` (GR-01, goods-receiving/WZ confirmation) is closer to "stock movement" but records deliveries, not order-triggered issues from a warehouse. This legacy log is really tracking "how much Pago issued from ITS warehouse," which is a supplier-side concept Supply OS doesn't model at all. |
| "zużycie"/consumption via `Expected Stock` formula (not actually working) | **No equivalent, and arguably not even working in the legacy system either** | Neither system has real consumption tracking from POS/GoStock; both rely on manual stock counts. This confirms the PRD's Non-Goal framing ("GoStock integration… postponed") is consistent with the legacy system's actual (non-)state, not a regression. |
| CITY_MASTER default recipient email lists (PAGO vs DRIVER split per city) | `Supplier.email` + `settings.order_cc_email` | Conceptually similar (a fixed distribution list per dispatch channel) but the legacy system has TWO parallel recipient lists per city (order vs transport) where Supply OS has one `supplier.email` + one global CC. Modeling a Pago-style dual-recipient dispatch would need either two suppliers (PAGO-order vs PAGO-transport) or a schema extension. |
| Pago-specific weight/capacity check (`Limit kg` / `Ponad limit`) | **No equivalent** | Supply OS has no transport-capacity concept at all today. |
| "Wybierz" city checkboxes / multi-city combined run | **No equivalent** | Confirms Supply OS's single-location, single-supplier order model is a deliberate simplification versus the legacy multi-city/multi-location consolidated-run reality; any Pago-replacement feature needs an explicit decision on whether to preserve or drop that consolidation capability. |

**Overall gap summary**: Supply OS today cleanly replaces the *record-keeping* half of this process (ORDER_INPUT quantities → structured `OrderLine` history, replacing the denormalized ORDER_LOG/STOCK_MOVEMENTS text blobs) but has **no equivalent at all** for: (a) multi-location consolidated ordering/dispatch in one document, (b) the driver pickup/route planning documents (PDF_DRIVER/DRIVER_PICKLIST/DRIVER_BY_LOCATION), (c) the self-pickup ("Odbiór własny") dispatch method and its distinct legal-entity letterhead, (d) transport weight/capacity checking, and (e) the STOCK_MASTER/STOCK_MOVEMENTS stock-ledger concept sourced from an external "Import PB" system that is itself outside this dump's and today's Supply OS's scope. These are exactly the areas the PRD's Non-Goals section calls out as "Pago internal warehouse pipeline" and "stays out of week 1" — this research confirms that framing is accurate to what the legacy process actually does.
