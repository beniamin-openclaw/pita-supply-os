---
change_id: master-data-followups
title: Master-data follow-ups carried forward from archived lanes (operator decisions + prod SQL)
status: implementing
created: 2026-09-13
updated: 2026-10-01
archived_at: null
---

## Notes

Collected on 2026-09-13 while archiving shipped lanes so that no open operator item disappears with
its folder. Every prod change below follows lessons.md "Master-data ops: diff before, audit after".

From `week1-feedback-targets` (archived `context/archive/2026-09-06-week1-feedback-targets/`):
- [ ] C-1 bifteki carton weight → `prod-sql.sql` section PENDING (units per pack + target back in kg)
- [ ] C-3 Coca-Cola KEN (invoices + minimum 500) → possible correction 72/96 → 48/72
- [ ] A′ Tuesday-morning snapshots: halloumi KEN/BRACKA/BROWARY, gyros BROWARY (plan §2.5)
- [ ] D Monday e-mail send (operator)

From `ken-browary-master-data` (archived `context/archive/2026-08-31-ken-browary-master-data/`):
- [ ] BROWARY: `delivery_address` = TBD, `company_name` / `company_nip` empty — fill before the first dispatch from Browary
- [ ] Confirm the 3 held items (Halloumi ×2, Gyros 15 KG) — real pieces/kg
- [ ] KEN: gyros pork vs chicken — split into two SKUs?
- [ ] BROWARY: roll size "57 na 80"
- [ ] Export KEN/BROWARY thresholds to the seed CSVs (seed ↔ prod drift is growing)
- [ ] Token rotation — open since `feedback-r4`

From `feedback-r7-tushar` (archived `context/archive/2026-07-25-feedback-r7-tushar/`):
- [ ] Verify on prod that the Gmail window shows both Intermlecz addresses in "To" and biuro@ in "CC"
- [ ] Intermlecz delivery days/hours in `suppliers`

From the Connecteam group "Pita Supply OS", 21–27.09 (read 2026-09-28; prod values checked read-only
the same day):
- [ ] KEN, 21.09: add Bakoma jogurt typ grecki 370 g (pack of 12) to Intermlecz, max 2. Operator replied
  "ok" on 21.09; not in `products` on 2026-09-28.
- [ ] KEN, 25.09: Souvlaki Kurczak target 6 kg → "6 boxes, or 36 kg"; same for Souvlaki Wieprz (now 3 kg).
  Prod has 1 karton = 5 kg (`upp` 5), which disagrees with "6 boxes = 36 kg": confirm the carton weight first.
- [ ] KEN, 25.09: Koperty (SUP_MORY) target 60 "box" → 60 packs or pieces (unit label, `upp` 1).
- [ ] WOLA, 27.09: Cappy Jabłko / Pomarańcza — "1 case = 24 bottles"; prod has zgrzewka × 12, and the
  inventory card shows both "1 case = 12 szt" and "1 zgrzewka = 12 szt". Check all Cappy locations.
- [ ] Sławek, 22.09: Pago units — stock is entered in blocks/cartons while `inventory_unit` is kg
  (screenshot: Gyros 15 KG "4 kg (0,3 bloku)"). Decide: count Pago in purchase units, or a
  cartons toggle on the stock field (the ordering field already has "enter in cartons").
- [ ] Sławek, 25.09: product names sent to suppliers should name brand, variant and pack size
  (e.g. "ser na grilla Reha", "frytki Aviko 9,5 mm", Florinis 4 kg vs small). Naming pass on
  `supplier_product_name`, per supplier, with Marek/Sławek.

Status check 2026-09-28 (prod, read-only):
- Meeting 18.09 §1.10 naming: Tzatzyki (Bukat) is `pojemnik` — done. Corfu still `box` (→ karton) and
  Tirokafteri (Bukat, active) still `wiadro` (→ pojemnik) — open.
- BROWARY `delivery_address` and `company_nip` are filled; `company_name` not checked.
- `suppliers.delivery_days` / `cutoff_time` still `TBD` for 7 suppliers; SUP_PAGO is still
  `ordering_method = 'email'` (migration 0021 not applied, PR #33 conflicting after PR #34).

Prod change 2026-09-28 (operator-approved in chat):
- [x] SUP_PAGO `ordering_method` 'email' → 'manual' (stopgap; before = 'email', after = 'manual',
  checked with SELECT). PR #33 `prod-sql.sql` section B accepts 'manual' as its prior state.

Operator decisions 2026-09-28:
- Pago for all Warsaw locations keeps being SENT from the "Ordering PB v5 prod" sheet; the app records
  the Pago orders of in-app locations only. No transport or e-mail is sent from the app.
- Tzatzyki, Tirokafteri (renamed "Hot Feta") and Feta blok are counted in `pojemnik`
  (3 kg / 2 kg / 2 kg); old inventory values of these three products get converted.
- KEN: Bakoma jogurt typ grecki 370 g (max 2 szt) and Ser Gouda block ~3 kg (max 1), per Intermlecz
  invoices in the finance mirror. Frytura EFFO 15L active at both Intermlecz and Kuchnie Świata.

Operator decisions 2026-09-28, round 2 (answers to the Marek question list):
- Dairy thresholds in `pojemnik` approved for locations without a sheet value: WOLA 12 / 3 / 2,
  KEN 6 / 2 / 1, BROWARY 12 / 2 / 1 (Tzatzyki / Hot Feta / Feta, max = target).
- Meaning of a fractional max (Feta 0.5–1.5): usually order 1 container, reorder when stock falls to
  0.5. Proposed implementation: for `full_only` products set target = floor(max) (Feta: min 0.5,
  target 1, max 1.5) so the engine suggests 1 at stock 0.5 and 0 at stock 1.
- Thursday prompt on the Captain order screen: choose "1 day" or "3 days (to the end of the week)";
  informational only, text "Pamiętaj o ilościach na 3 dni!". Supplier scope to confirm with Marek.
- Delivery date: soft default from the delivery rules; the Captain may pick any other date; the
  Manager view marks a date that differs from the default, subtly (like the over-max marker).
- Supplier e-mail: add location phone and the ordering person's name + phone next to the delivery
  address. The new e-mail layout goes to the operator for approval before implementation.
- WOLA has no biuro@ alias: send from biuro@pitabros.pl; always CC the location mailbox unless it is
  the sender itself (wolskapitabros@gmail.com).
- "Helcom Papryka Grillowana Czerwona" is the same product as the DB's Florinis pepper (rename only).
- BRACKA "Torba na wynos z uszami": min 1.5, max 3 (the sheet showed a date instead of the min).
- Pago is ordered in blocks/cartons, but stock is often partial (half a carton, a cut gyros block).
  Proposal pending approval: keep kg as the stored unit (as GoStock does), add a two-field stock
  input "packs + loose kg" that shows both forms.
- New sources: KEN sheet `1PlApVFkF1Flc3UsaZaBbjdOivEH2cSM8xTUUgSKYFlM` (edited by the KEN captain),
  BROWARY sheet `1nubILkSTNDTxmsjflZ_dIM4W9bQdbfuvBxztMMi5E0Q`; BROWARY Blue Service needs correcting;
  run a product-name unification pass across locations.

Operator decisions 2026-09-28, round 3 (operator + transcript of the call with Marek):
- Approved: new supplier e-mail layout (lane task_86587470) and Pago stock input "packs + kg" with kg
  kept as the stored unit (lane task_5d0f9db3). Batch 1 (dairy → pojemnik) approved for after 17:00.
- Signature in supplier e-mails = the manager sending: Marek Złotopolski by default (~90% of orders),
  switchable to Sławomir Glanowski; location address + location phone in the body. No Captain phone.
- KEN: Jogurt = Bakoma typ grecki 370 g and Ser Gouda blok 3 kg, both from Intermlecz. Burn's supplier is
  Coca-Cola, but Marek: KEN does not order Burn → stays inactive for KEN.
- Souvlaki carton = 5 kg. Pita "box" = karton of 12 opak × 10 szt.
- Twice-weekly Pago locations keep their sheet min/max as set; only WOLA and BRACKA move to one Pago
  delivery per week (weekly min/max from their sheets).
- KEN chicken gyros is ordered from Spec Food, separately. WESTFIELD uses Gyros 25 KG (add it there;
  its sheet has 3–4 blocks). The Ordering sheet blocks Gyros 25 for Westfield — to fix in the sheet.
- Marek: Pago is always ordered through the Ordering sheet (the app orders are "accepted" in the app);
  the sheet is the source for month-end usage per location, Wola included.
- Thursday "1 / 3 days" prompt: Bukat and Intermlecz only; on "3 days" an informational "will it last
  through the weekend?" message; no per-day calculation.
- Coca-Cola: delivery days are per location (same for cans and bottles), e.g. WESTFIELD Mon/Tue/Thu/Fri;
  Marek is collecting the rest. Orders must be in by the evening two days before delivery (Coca-Cola's
  cutoff is 16:00 the day before); emergencies by phone to the manager before 16:00. Empty-crate entry
  stays as is.
- Min/max from Marek's sheets go live as written; review with the locations after ~2 weeks (≈ 12.10).
- Rucola = 100 g (invoices). Sałata bolero: 150 g everywhere (P170 500 g is unused).
- Feta: WOLA keeps max 2; elsewhere max 1.5, usually order 1 container.
- Cukier w kostkach Diament 1 kg: new product (staff coffee/tea), kept next to the sachets.
- Nothing is hidden from the product lists for now (no "rare products" sub-list).

Operator decisions 2026-09-28, round 4:
- Halloumi: 1 szt = 200 g, 12 szt = 1 karton (Intermlecz invoices bill per szt in multiples of 12);
  show the hint at the product. Existing thresholds in szt stay (KEN sheet 2–5 = cartons = 24–60 szt).
- Signatures: Marek Złotopolski +48 662 184 258, Sławomir Glanowski +48 692 840 194.
- Delivery days: Go Gastro, Blue Service, Spec Food, Kamino Mon–Fri; Kuchnie Świata Mon–Sat.
- Reminders: a Telegram bot in each location's group chat; rules to be designed against spam (later).
- Rolki do kasy 57/50 come from Magazyn własny Mory (bulk stock, collected by the Pago driver), so Mory
  items belong on the same list as Pago.
- SUP_EUROFOOD → rename to "Go Gastro", minimum order 500 zł.
- The Ordering sheet must allow Gyros 25 KG for Westfield (coordinator fixes it); the app must match.
- ELEKTROWNIA (Powiśle) and WESTFIELD have 0 of 113 / 107 thresholds set in prod; their sheets are ready.
- PR #33 merged by its lane: SUP_PAGO `ordering_method` = 'transport' on prod since 2026-09-28.
- Migration numbers across lanes: 0023 display order, 0024 zero quantity, 0025 delivery calendar,
  0026 order e-mail v2.
- Note for the future Pago + Mory lane (from the display-order lane): display order is per supplier;
  while Mory and Pago stay separate suppliers, one combined document needs its own cross-supplier
  ordering key (or Mory products move back under SUP_PAGO).

Findings 2026-09-28 (prod, read-only):
- Gyros 15 KG counts at BRACKA (21.09: 8, 27.09: 6) and BROWARY (27.09: 6, after 90 on 20.09) are block
  counts typed into the kg field; KEN and WOLA enter kg (multiples of 15).
- Pago thresholds are stored in mixed units although `inventory_unit` is kg/opak: Gyros 15 KG is 2–10 or
  4–8 at WOLA/KEN/BROWARY/BRACKA (blocks), Souvlaki 4–12 at WOLA and 3–8 at BRACKA (cartons), Pita 1–5 at
  WOLA and 1.5–4 at BRACKA (cartons); BROWARY souvlaki/pita and KEN pita are in kg/opak. With WOLA/KEN
  stock in kg, the Pago suggestion is 0 regardless of stock.
- New KEN sheet: 82 of 138 rows match prod, 55 differ (Bukat maxima, Coca-Cola family minima, oils,
  Halloumi in kg vs prod szt, KEN souvlaki 2–6 labelled "Kg" but consistent with cartons). KEN lists
  "Gyros kurczak 15 kg" under Pago; prod has chicken gyros for KEN from Spec Food. Jogurt naturalny (P162),
  Ser Gouda (P172) and Burn (P156) have only inactive supplier rows.
- New BROWARY sheet: 103 of 120 rows match; its 30 Blue Service rows match prod. Opakowanie Frytki
  (P088), Kubeczki papierowe (P144) and Słomki 250szt (P102) sit under the inactive Selgros with blank
  min/max; their active supplier is Blue Service. Gyros 3–8 "Szt" (blocks), Rolki 57 na 80 6–18 vs 10–30.
- Naming: NORBLIN/ELEKTROWNIA/WESTFIELD minmax tabs share brand + pack-size names (Intermlecz items,
  spices, Tzatzyki 3kg, Feta blok 2kg); BRACKA/WOLA/KEN/BROWARY and prod use the older names. Bukat
  invoices name the rocket "Rucola ... tacka 100g" (prod says 125 gr).
- Go Gastro already exists as SUP_EUROFOOD (recipient zamowienia@gogastro.com.pl).
- Location phones exist in `docs/pita-supply-os-v1/COMPANY_ENTITIES.md` for WOLA, BRACKA, KEN, NORBLIN
  and Elektrownia; BROWARY and WESTFIELD have none. ELEKTROWNIA and WESTFIELD have no delivery address
  or company in `locations`; WESTFIELD has no mailbox.

### Operator decisions 2026-09-28, round 5

- Lanes 1–4 go as recommended: lane 1 archives (manual checks 3.6/3.7 carried over if not verifiable
  read-only); lane 2 implements (0024), stop before merge; lane 3 answers — unset positions keep
  supplier_product_id order, a Manager-added product lands in its own position, inventory-layout phase
  postponed past 1.10 — implements (0023), stop before merge; lane 4 prepares the Pago cleanup SQL
  (diff before, audit after), nothing runs on prod before the operator sees the diff.
- SUP_INTERNAL ("Pita Bros (internal production)") must not appear anywhere in ordering: it is on-site
  production, counted in inventory only (prod: active, 0 orders ever). Folded into lane 3: hide it in the
  Captain order supplier picker, legacy /captain and the Transport supplier picker; backend 400 on captain
  submit. The supplier stays active in data, because `_primary_supplier_product` needs an active
  supplier for the inventory grouping.
- Target vs max: prod has target = max on all 649 settings with max > 0 and min > 0 on all of them, so
  target adds nothing and min only drives a warning; the app suggests a top-up whenever stock < max.
  Proposal (chip task_cdba5c9d, not started): classic min/max — suggestion 0 while counted stock > min,
  top up to max once stock ≤ min; weekly suppliers (Pago, Coca-Cola) keep topping up to max. Migration
  0027 if a supplier flag is needed. Ship after 1.10, before the 12.10 min/max review.
- Ordering sheet, Westfield × Gyros 25 KG (read-only inspection of an xlsx export): no data validation,
  formula or sheet protection blocks ORDER_INPUT row 11 in the file; ORDER_LOG shows Westfield Gyros 25
  entered on 07, 14, 18 and 28.09 but missing up to 01.09 and on 11.09, while Gyros 15 has Westfield
  since 07.08. CITY_LOCATIONS lists Westfield (row 14) outside the contiguous Warsaw block (rows 2–8).
  Protected ranges and the Apps Script are not visible in an export; nothing changed in the sheet yet.

Questions to Marek 2026-09-28 (Gmail draft to marek@pitabros.pl, not sent yet; from prod order lines
14–28.09 where the Captain deviated from the suggestion, read-only). Awaiting a point-by-point reply:
- [ ] 1. BROWARY Fanex majonez 4 kg (target 8) / Develey musztarda 3 kg (target 6): ordered 1 each time,
  SYSTEM_SUGGESTION_WRONG → real weekly usage, new targets.
- [ ] 2. Frytki Aviko: WOLA (target 44) orders above the suggestion, BROWARY (target 28) below → targets.
- [ ] 3. WOLA Rolki do kasy 57/30: target 80 (since 05.09), ordered 30 at stock 16 → is 80 right?
- [ ] 4. WOLA Bukat produce (papryka zielona, ogórek, cytryna, sałata bolero) + Blue Service chemia:
  ~1/3 below the suggestion with STOCK_UNTIL_NEXT_DELIVERY (code meant for ordering more) → targets too
  high, or under-ordering?
- [ ] 5. KEN Gąbka do naczyń: target 24, ordered 12 (LOW_STORAGE); Captain confuses gąbka (Blue Service)
  with druciak (Mory) → lower target, rename?
- [ ] 6. BRACKA: "płaski mop XXXL" nakładka written in the note; Vileda Ultra Max refill is only set up
  at WOLA → same model? add to BRACKA.
- Not asked (unclear source): BROWARY Coca-Cola order 20.09 carries note "za małe zamówienie".

### Applied 2026-09-28 — pago-data-unity cleanup (lane 4 SQL, run by the coordinator)

- Operator go in chat on 28.09. Script: `context/archive/2026-09-28-pago-data-unity/prod-sql.sql`.
- STEP 0 matched `cleanup-diff.md` row for row; saved as `cleanup-diff-before.md` next to it (the rollback source for STEP R).
- STEP 1 ran as the one `DO $$ … $$` statement, with no error. STEP 2 audit: 13/13 `ok = true`. After-state: `cleanup-diff-after.md`.
- Result: 8 manager-created orders of the 2 abandoned draft transports (02.09, 25.09) cancelled and both headers cancelled; 5 historical Pago orders (KEN 04.09, KEN 07.09, BRA 07.09, KEN 14.09, WOL 14.09) closed as `manager_sent` / `transport` with the sheet ODB times; KEN 07.09 Pita 1 → 2; BRA 07.09 Bifteki commented; BRA 14.09 moved to the revised 16.09 sheet version (G15 8, Pita 8, SK 12, + Gyros 25 KG 1; total 3879.00 → 6457.48).
- Untouched: the Mory order WOL 21.09 (waits for Marek), later Pago orders, biuro@ drafts, the Ordering sheet. Nothing was sent.

### Applied 2026-09-28 — Batch 1: dairy kg → pojemnik (run by the coordinator)

- Operator go in chat on 28.09 evening ("PARTIA 1 TEZ OK GO"). Script: `prod-sql-2026-09-28-dairy-pojemnik.sql`.
- Pre-check: KEN sheet `1PlApVFkF…` and BROWARY sheet `1nubILkSTN…` (Inwentaryzacja MIN/MAX tabs, in kg) match the approved rows after ÷3 / ÷2, except KEN Hot Feta max 3 kg = 1.5 pojemnik vs approved 2 — kept the approved 2; flagged to the operator.
- STEP 0: no open order_lines (draft / captain_submitted / manager_claimed) with P011/P012/P014, so the order_lines step touched 0 rows. Before-state saved as `rollback-2026-09-28-dairy-pojemnik.sql` (products, 4 Bukat supplier_products, 39 settings, 82 inventory_count_lines).
- STEP 1 ran in one transaction, no error. STEP 2 audit: 0 settings with min > target or target > max; 39 settings tagged `[2026-09-28 kg->pojemnik]`; products P011 Tzatzyki 3kg / P012 Hot Feta 2kg / P014 Feta blok 2kg = `pojemnik`, P007 Rucola 100 gr; Bukat supplier_products `pojemnik` × 1. Max historical count after conversion: P011 15 (WOLA 01.09, 45 kg), P012 3.35, P014 3.5 (WOLA 22.06, 7 kg). WOLA 27.09 count now Tzatzyki 9 / Hot Feta 1.5 / Feta 1.5.
- Generic conversion (no explicit row): FORUM 5/14/14, 1.5/4/4.5, 0.5/2/2; zero rows stay 0.
- Left as is: inactive SP_PAGO_P011/P012/P014 still carry `units_per_purchase_unit` 3/2/2 (kg/wiadro); harmless while inactive, fix if they are ever re-activated. Closed order_lines history not rewritten (purchase quantities keep their meaning).

### Status 2026-10-01 (WIP cleanup)

- WOLA Pago thresholds (gyros 10 → 150, pita 5 → 60, souvlaki 4 → 20): these come from the pago-stock-packs-plus-kg lane. It converted 14 pack-count thresholds on prod on 28.09 (blocks/cartons → kg/opak, audit clean; archived `context/archive/2026-09-28-pago-stock-packs-plus-kg/`). Not an unknown edit. The mixed-unit finding above is resolved for those 14 rows.
- Lanes closed alongside this one: pago-data-unity (R-28), order-line-zero-qty (R-29), pago-stock-packs-plus-kg (R-25), delivery-calendar (R-26), elektrownia-westfield-rollout (R-27).
- Still open here, in order:
  - Marek questions 1–6. The draft was not sent; the operator sends it.
  - KEN Hot Feta max: 2 vs 1.5 pojemnik.
  - Batches 2–5.
  - Souvlaki carton 5 vs 6 kg.
  - Bakoma: only inactive P161/P162 exist.
  - Gouda, Koperty, Cappy 12/24.
  - C-1 and C-3.
  - Stale orders: BRA-COCA 02.09 `manager_claimed` (cancel); WOL-MORY 21.09 (waits on Marek).
  - J2: 18 old `manager_sent` orders.
  - Token rotation.
  - Naming pass.
