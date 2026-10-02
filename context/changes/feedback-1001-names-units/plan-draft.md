# Plan — feedback-1001-names-units

Status: planned, nothing applied. Prod reads only (Supabase `lpzhphufjwrndfogkfub`, 2026-10-01).
**Read "Decisions round 2" first** — it answers Q1–Q12 and supersedes parts of D4, Phase 2, Phase 5 and Phase 8.
This draft is the input for `/10x-plan` (rewrite into the skill format), run in a cloud session — see
"Order of work (round 2)" at the end.
Every prod data step: (1) SELECT-diff saved before the write = the rollback, (2) one guarded `DO $$` block,
(3) audit after + log in this folder (lessons.md "Master-data ops: diff before, audit after").

## Decisions recorded (operator, 2026-10-01)

| # | Topic | Decision |
|---|---|---|
| D1 | Names | Check all products. Marek's Norblin sheet names are correct; names = invoice name or close to it. Change both the screen name and the supplier name (screen may be shorter). See `names.md`. |
| D2 | Same products everywhere | Yes — the KEN invoice items (Aviko Super Crunch, Reha halloumi, …) are what every location buys. |
| D3 | Frytki Aviko | Enter stock with the carton option; 1 carton = 4 bags. |
| D4 | Oliwki | min 0,5 bidon, max 1 bidon (= 1 kg / 2 kg). |
| D5 | Liść laurowy | Order the 80 g pack everywhere (400 g rejected). min 0, max 1 pack. |
| D6 | Miód w saszetkach (AGROS ŁOWICZ 25g/30, P139) | Remove the product. |
| D7 | 0/0/0 rows | Produce a review list; remove nothing without explicit approval → `zero-thresholds-review.md`. |
| D8 | Gyros nieścięty | Remove (pork P177 and chicken P185); explain clearly to staff where cut vs uncut goes. |
| D9 | Gyros unit | blok → szt for all three gyros (Pago 15 KG, Pago 25 KG, Spec Food chicken). |
| D10 | Powód zbiorczo | New lines get the bulk reason; Apply overwrites existing reasons; add the control on the order edit screen. |
| D11 | Units on Captain screens | Bold and darker everywhere the Captain orders and counts. |
| D12 | WESTFIELD mailbox | Location mailbox `westfieldpitabros@gmail.com`; mails are to be sent from the alias `mokotow@pitabros.pl`. |
| D13 | Rolki do kasy (Norblin sheet) | 57/50: min 2, max 5 packs; 80/80: min 2, max 4 packs; 6 rolls per pack. |
| D14 | Own production at ELEKTROWNIA/WESTFIELD | No thresholds — produced and recorded at inventory, never ordered. Rows stay 0/0/0. Closes the rollout-notes item. |
| D15 | Coca-Cola delivery days ELEKTROWNIA/NORBLIN | Waiting for the operator; no action. |
| D16 | Cukier w kostkach (P189) | Invoice item "DIAMANT CUKIER KOSTKA BIAŁY 0,5kg/10", 4,08 zł netto / 4,41 brutto. |

## Open questions (block only the step named)

| # | Question | Blocks |
|---|---|---|
| Q1 | Pomidory: where does "case = 5 kg" come from, and should the app only show "1 skrzynka ≈ 6 kg" as a hint, or order tomatoes in crates? | Phase 1 step 1.10 |
| Q2 | ELEKTROWNIA Coca-Cola → glass 0,25 like WOLA/WESTFIELD? Same thresholds (Cola 50/120, Zero 70/150 — 150 = 6,25 crates)? NORBLIN stays on cans? | 1.9 |
| Q3 | P139 honey sachets: WOLA uses it (0,5/1,5, counted 1 pack every week). Deactivate everywhere incl. WOLA, or remove only at NORBLIN and BRACKA (both 0/0/0, never counted)? ELEKTROWNIA has no P139 row. | 1.6 |
| Q4 | Cukier w kostkach: 0,5 kg (invoice) or 1 kg (sheet/prod name)? | 1.8 name |
| Q5 | Liść laurowy with min 0 / max 1: the engine tops up to target, so with target = max = 1 it proposes 1 pack whenever stock < 1 pack (counts are 0,05–0,6) — almost every order. Set target 0 instead (no proposal; order by hand when empty)? | 1.3 |
| Q6 | Rolls: do 6-roll packs apply to 80/80 at every location (WOLA 6/60, KEN 6/12, BROWARY 6/12, BRACKA 1/2) and does Mory issue whole packs? Keep 80/20 (P183) at NORBLIN/ELEKTROWNIA/WESTFIELD (Sławek's 05.09 table) or remove it (not on Marek's sheet)? | 1.11 |
| Q7 | Sender alias: the app has no notion of a sender — Gmail opens in the browser's default account. Enough to document "send from mokotow@" for the Manager, or build it (store an alias per location, show "Wyślij z: …" in the dispatch panel, set `From:` in Transport Gmail drafts)? | Phase 5 |
| Q8 | Frytki Aviko in cartons means ordering whole cartons only (4 bags; KEN invoices are always 24 = 6 cartons). OK? Carton price = 4 × 22,55 (prod) or 4 × 18,86 (KEN invoice, Aug)? Frytki z batatów stay per bag (invoices 2 and 4 bags, carton is 5)? | Phase 2 |
| Q9 | P017 papryka: the sheet says "Helcom Papryka Grillowana Czerwona 4,2kg/2,5kg", prod says Florinis with 3,6 kg per pack. Which product, and how many kg per pack? | names N1 row P017 |
| Q10 | Prymat pieprz / oregano / papryka słodka: count and order in packs (opak) instead of kg? Papryka słodka is a 720 g jar; BROWARY counts in kg (0,72), others count packs into a kg field. | optional step 1.12 |
| Q11 | Cappy: which locations buy 0,25 l glass (skrzynka 24) and which 0,33 l PET (zgrzewka 12)? KEN invoices show glass; prod has only zgrzewka × 12 everywhere. | Phase 8.1 |
| Q12 | Halloumi (karton 12) and Gąbka (opak 10): switch to pack-based (two-field stock input, ordering in whole packs)? | Phase 8.2 |

## Decisions round 2 (operator, 2026-10-01 evening) — answers Q1–Q12

Operator inputs are in `inputs/` (Marek's Norblin sheet, Sławek's roll table, Prymat prices; transcriptions in
`inputs/README.md`). The operator approved every recommendation below ("idziemy z twoją rekomendacją").

| # | Topic | Decision | Supersedes |
|---|---|---|---|
| D17 | Oliwki P013 | min 1 kg, **target 1 kg**, max 2 kg at all 7 locations: the engine proposes 1 bidon (2 kg) only when stock is below 1 kg ("zamawiam przy mniej niż pół bidonu, max 1 sztuka = 2 kg"). Deliberate exception to target = max. | D4, step 1.2 target |
| D18 | Liść laurowy P054 (Q5) | min 0, **target 0**, max 1 opak: no proposal, ordered by hand when empty. Exception to target = max. | step 1.3 |
| D19 | Miód saszetki P139 (Q3) | Deactivate everywhere, WOLA included (`products.active = false`). | step 1.6 scope |
| D20 | Cukier w kostkach P189 (Q4) | 0,5 kg per the invoice ("DIAMANT CUKIER KOSTKA BIAŁY 0,5kg/10"), 4,08 zł netto. | Q4 |
| D21 | Frytki Aviko unit (Q8) | Base purchase unit is **paczka** (2,5 kg bag): relabel SP_INTERMLECZ_P021 `opak` → `paczka` in place (upp stays 1, label-only like D9) and add `paczka/paczki/paczek` to `frontend/src/i18n/packUnits.ts`. Price per the KEN invoice: 18,86 zł netto per paczka. Ordered in whole cartons ~99% of the time, not always. Frytki z batatów stay per paczka, no case. | Q8, Phase 2 unit |
| D22 | **Bulk packs ("opakowania zbiorcze"), approach B** | Optional case on `supplier_products` (new migration, **0027** — 0026 is taken by order-email-v2): `case_unit` (e.g. karton) + `units_per_case` (in purchase units), both nullable. Where set: stock and order inputs become two fields `[cases] + [loose purchase units]`; the engine rounds the suggestion **up to full cases** (backend `compute_suggestion` + frontend `compute.ts` parity), the Captain may still order loose units; the supplier e-mail and documents print "6 kartonów (24 paczki)". Order lines, receipts, history, finance and thresholds stay in the base purchase unit, so nothing is relabelled and no new supplier_product rows are needed. | Phase 2 technique, Phase 8.2 / 1.11 new-row technique |
| D23 | Products that get a case (D22) | Pomidory P006 — skrzynka 6 kg; Cebula czerwona — worek 5 kg; Frytki Aviko P021 — karton 4 paczki; Halloumi P015 — karton 12; Rolki 80/20 P183 + 80/80 P129 (SP_MORY_*) — opak 6, at every location that uses them; Gąbka P121 — opak 10. **Not now:** Tzatzyki, Cieciorka, Batat, Masło, Ketchup (90-day prod data: mostly partial cases). Evidence (sent/closed orders, last 90 days, full-case share): pomidory 42/42, cebula 36/36, frytki 31/34, halloumi 33/35, tzatzyki 33/39, cieciorka 7/24, masło 0/34, batat 2/29, ketchup 3/14, gąbka 1/3. | Q1, Q12, 8.2 |
| D24 | Rolls (Q6) | Sławek's table is authoritative. NORBLIN, ELEKTROWNIA and WESTFIELD (Sunmi V3 Mix): POS roll 80/20 (P183) min 2 / max 5 opak = 12/30 rolls; printer roll 80/80 (P129) min 2 / max 4 opak = 12/24 rolls. Marek's "57/50" row means the Sunmi POS roll, i.e. 80/20. P142 57/50 stays inactive. Other locations already match the table since 2026-09-05 (archive `rolki-minima-master-data`) — thresholds unchanged there, only the case (D23) is added. | D13 (57/50 → 80/20), step 1.11 |
| D25 | Coca-Cola glass (Q2) | ELEKTROWNIA → glass P186/P187 (like WESTFIELD), max rounded to full crates of 24: Cola min 48 / max 120, Zero min 72 / max 144. WESTFIELD re-rounded: Cola 50/100 → 48/96, Zero 70/130 → 72/120. WOLA/BRACKA/KEN already in full crates. NORBLIN stays on cans. | Q2, step 1.9 |
| D26 | Cappy (Q11) | Glass 0,25 l (skrzynka 24) wherever the location has glass: WOLA, BRACKA, KEN, WESTFIELD, ELEKTROWNIA, **BROWARY** (operator: "na Browarach mamy szkło też"). PET 0,33 l (zgrzewka 12) only at NORBLIN. Glass price 100,32 zł netto per crate (KEN invoice). Glass thresholds: max rounded to a full crate (never 0), min ≤ max; ambiguous roundings (e.g. WOLA/KEN max 36) go to the operator in the diff. | Q11, 8.1 |
| D27 | Papryka P017 (Q9) | Helcom Papryka Grillowana Czerwona 4,2kg/2,5kg (Marek's sheet), counted and ordered per opak, min 0,5 / max 1,5. | Q9 |
| D28 | Prymat spices (Q10) | Count and order per piece (1 szt = 1 jar/box; invoice prices are per szt). Names and netto prices: Pieprz czarny mielony 820 g 47,60; Oregano 110 g 11,30; Liść laurowy 80 g 14,70; Ziele angielskie 600 g 43,90 (Prymat replaces Kamis); Papryka słodka 720 g (name from the KEN invoice, price from the KEN mirror). | Q10, step 1.12 |
| D29 | Bold units (D11 widened) | Also in order history/detail, inventory history and receipts (Phase 3 point 3 is now in scope). | Phase 3 point 3 |
| D30 | Sender alias (Q7) | Built and live by order-email-v2 (PR #43, migration 0026 on prod): `locations.sender_email`, Gmail API draft with the alias as From, WOLA = NULL (sends from biuro@). Read `context/changes/order-email-v2/handoff-feedback-1001.md`. What stays here: step 1.7 (WESTFIELD `locations.email`) and the NEW_LOCATION_CHECKLIST line. Transport drafts keep the order mailbox (a batch spans several locations) — no `From:` change. | Phase 5 |

Still open (blocks only its step):

| # | Question | Blocks |
|---|---|---|
| Q13 | BROWARY prod has Coca-Cola in cans (P068 24/72, P069 48/96, zgrzewka 24). The operator says Browary has glass — switch Browary Cola to glass P186/P187 too (same thresholds, already full crates)? | Browary Cola rows only |

## Phase 1 — Prod master data batch (no code)

Can run as soon as the operator approves the diff; independent of the code phases. One `DO` block per
logical step, each with a guard that re-checks the before-state.

1.1 **Names, batch N1** (`names.md`, Intermlecz + other suppliers on the Norblin sheet): update
`products.product_name_pl` and `supplier_products.supplier_product_name` for ~30 products. Guard: current names
equal the "Now" column. P017 and P189 wait for Q9/Q4. Batch N2 (supplier-only names from invoices) only if the
operator approves it separately.
- Effect: Captain/Manager screens show the new names at once; supplier e-mails and Transport documents print
  the supplier name. Old orders also show the new names (names are joined live) — acceptable, same product.
- Seed CSVs (`docs/pita-supply-os-v1/seed/`) get the same names in the code PR, so tests and local dev match.

1.2 **Oliwki P013** — all 7 active locations: min 1 kg, target = max 2 kg (D4). Today: WOLA/BRACKA 0,5/1,5,
KEN 0,5/2, BROWARY 1/3,3, ELEKTROWNIA/NORBLIN/WESTFIELD 1/3. Note: ELEKTROWNIA counted 8,1 kg on 27.09 — it will
show far above max until used up.

1.3 **Liść laurowy P054** — all 7 locations: min 0, max 1 pack; target per Q5 (recommended 0). Name and supplier
name per `names.md` ("Prymat Liść Laurowy 80g"); unit stays `opak`, 1 opak = 80 g (D5). Today: 0,5/1,5 in most
locations, BROWARY 0,02/0,08, KEN 0,1/0,5, WOLA 1/1.

1.4 **Gyros unit blok → szt** (D9): `purchase_unit` 'blok' → 'szt' on SP_PAGO_P024, SP_PAGO_P025, SP_SPEC_P179;
`units_per_purchase_unit` unchanged (15/25/15). Label-only change, so re-labelling old orders ("3 blok" → "3 szt")
keeps the meaning. Effect: inventory/order fields read "3 szt + 10 kg", prompt "Czy chodziło o 6 szt (90 kg)?",
e-mails and Transport documents "N szt". No code needed ("szt" is in the declension table). Three test files
mention "blok" — they test the helper, not this data.

1.5 **Gyros nieścięty** (D8): `products.active = false` for P177 (Gyros wieprzowy nieścięty — WOLA, BRACKA,
BROWARY, KEN, NORBLIN, ELEKTROWNIA) and P185 (Gyros kurczak nieścięty — KEN). Inventory history stays; the
product disappears from inventory lists. Before applying: send the staff message (Phase 6) — last counts were
NORBLIN 20,7 kg, BRACKA 11,8, KEN 8 (pork) and KEN 10 (chicken), so from the next count those kilos move into
"Gyros 15 KG" / "Gyros 25 KG" / "Gyros z Kurczaka (Kebab)" as loose kg, and the gyros suggestion will drop
accordingly (it was under-counting stock).

1.6 **P139 honey sachets** (D6, scope per Q3): remove the NORBLIN and BRACKA rows, or deactivate the product.

1.7 **WESTFIELD mailbox** (D12): `locations.email = 'westfieldpitabros@gmail.com'` (CC on supplier e-mails);
`notes` updated. The sender alias is Phase 5.

1.8 **P189 Cukier w kostkach** (D16): `price_estimate_pln = 4.08` (prices are stored netto — checked against
Halloumi 7.73 and Oliwki 45.31, which equal the invoice netto). Name per Q4.

1.9 **ELEKTROWNIA Coca-Cola** (Q2): same pattern as `prod-sql-2-westfield.sql` — glass P186/P187 rows with the
can thresholds, can rows P068/P069 deleted.

1.10 **Pomidory** (Q1): if a hint only — `order_note = '1 skrzynka ≈ 6 kg'` on SP_BUKAT_P006. Ordering in crates
would be a Phase-2-style unit change (new supplier_product row) and changes the Bukat e-mail to crates.

1.11 **Rolls** (D13, Q6): activate P142 "Rolki do kasy 57 na 50" (product + SP_MORY_P142, both inactive today)
and add NORBLIN/ELEKTROWNIA/WESTFIELD rows min 12 / max 30 rolls; P129 80/80 at the same three: min 12 / max 24
rolls (NORBLIN today 3/20, the others 0/0). If Mory issues 6-roll packs: new supplier_product rows `opak × 6`
(same technique as Phase 2) so the two-field input shows "2 opak + 3 szt". 80/20 per Q6.

1.12 **Optional — Prymat spices in packs** (Q10).

Audit after Phase 1: every touched row matches the target; `min ≤ target ≤ max`; no active location row on an
inactive product; names have no leftover "(opakowania)" on Intermlecz rows; diff + audit saved here.

## Phase 2 — Frytki Aviko in cartons (data, carefully sequenced)

> **Superseded by D21–D23** (bulk-pack case on the existing row, no new supplier_product). Kept for the analysis of
> why upp must not change in place — that reasoning still holds and is why D22 keeps the base unit.

Why not edit the existing row: units and pack sizes are joined live, so changing SP_INTERMLECZ_P021 from opak × 1
to karton × 4 would re-label every past order line (an old "42" would read "42 karton" = 168 bags), the open
`manager_claimed` order with 42 bags would be dispatched as 42 cartons, receipts and the suggestion review would
mix units, and the finance match multiplies by the current pack size.

Technique (history-safe): add a NEW supplier_product row and retire the old one.
- New `SP_INTERMLECZ_P021_K`: supplier name per `names.md`, purchase_unit `karton`, units_per_purchase_unit 4,
  rounding `full_only`, price = 4 × bag price (Q8), `order_note` "1 karton = 4 worki 2,5 kg", same
  display_order / counts_toward_minimum / warehouse_pickup as the old row.
- Old `SP_INTERMLECZ_P021`: `active = false`. Old order lines keep pointing to it, so they still read in bags.
  The open 42-bag order keeps its row and dispatches correctly.
- `location_product_settings` P021, all 7 locations: `allow_over_max_due_to_packaging = true` (rounding up to whole
  cartons can pass max, e.g. BRACKA max 34 bags = 8,5 cartons; P021 is critical at WOLA/BRACKA/KEN). Thresholds
  stay in bags (`inventory_unit` szt).
- Guard: no `captain_submitted` order line on SP_INTERMLECZ_P021 when applied (a claimed one is fine).
- Edge: a Captain draft saved before the switch still carries the old row; submit accepts it (the submit check
  reads every supplier row, active or not) and it is ordered in bags. Acceptable; staff message covers it.
- Effect: Captain card and inventory grid show [kartony] + [szt]; suggestion in whole cartons; e-mail "N karton".
- Known side effect: the Manager suggestion review averages purchase quantities per product, so P021 will mix
  bags (old lines) and cartons (new lines) there. Acceptable; noted for the 12.10 threshold review.

## Phase 3 — Code: units bold and darker on Captain screens (frontend only)

Scope: Captain ordering (new order `CaptainMP` and edit `OrderEditPage`, both via `ProductCard`) and inventory
(`InventoryCountGrid`, `PackStockInput`). Manager screens use none of these components, so they are not affected;
the shared helpers (`lib/packUnits.ts`, `lib/packStock.ts`, `DecimalInput`) stay unchanged.

1. One small presentational component in `pages/captain-mp/components/` (e.g. `UnitLabel`) with the unit style
   (`font-bold text-slate-900`; captions under inputs also 10 px → 11 px). Use it, or the same classes, at:
   - `ProductCard.tsx` captions under the stock and order inputs (:280-285, :385-390);
   - `PackStockInput.tsx` pack and loose captions (:134-136, :155-157);
   - `InventoryCountGrid.tsx` unit under the product name (:215).
2. Units inside one string (number + unit together) need the string split into parts:
   - `ProductCard.tsx` header "Cel / Max / 1 karton = 4 opak" (:156-199), suggestion detail (:323-352);
   - `PackStockInput.tsx` live reading "= 1 szt + 5 kg (20 kg)" (:159-165);
   - `InventoryCountGrid.tsx` pack hint (:246-254), and "ostatnio {qty}" gets its unit (:262-268).
   Approach: an additive i18n helper that returns the interpolated template as parts (strings + React nodes), so
   copy stays in `src/i18n/` and the existing `t()` is untouched; plus an additive `formatPacksParts` next to
   `formatPacks` (the old function stays for Manager).
3. Out of scope unless the operator asks: order history / detail (`OrderDetailPage`), `InventoryHistoryPage`,
   receipts (`ReceiptLineCard` is already bold), the red below-minimum warning, `order_note` text.
4. Tests: no test asserts classes; text-matching tests that split into spans must move to
   `toHaveTextContent` / regex — ProductCard.test.tsx:84-110, PackStockInput.test.tsx:72/117/153.

Verify: `npm run build && npm run lint && npm run test`; screenshots of the order card and the inventory grid at
375 px and desktop, against a backend with auth ON and only a Captain token (lessons.md).

## Phase 4 — Code: "Powód zbiorczo" (frontend only)

Today: one-shot. `overruleAll` (lib/overruleAll.ts:46-57) patches only lines that require a reason at the moment
of Apply and skip lines that already have one (:50); the control resets after Apply and nothing is remembered.

1. `overruleAll` gets a mode: `overwrite` (explicit Apply — replaces existing reasons on every line that requires
   one, D10) and `fillMissing` (auto-apply — only lines without a reason). When it switches a line to a reason other
   than OTHER, drop the stale OTHER comment (:56).
2. Sticky bulk reason: `bulkReason: {code, comment} | null` state in `CaptainMP`, set on Apply, reset on supplier
   switch (:258-268). An effect runs `overruleAll(items, lines, bulkReason, "fillMissing")` whenever lines change —
   loop-safe because `overruleAll` returns the same object when nothing changed. A line the Captain then changes by
   hand keeps the hand-picked reason (fillMissing never overwrites).
3. The control shows the active bulk reason ("Powód zbiorczo: Impreza — stosowany do nowych pozycji") with a
   "Wyłącz" action; copy in `src/i18n/`.
4. Draft: `DraftState` gets optional `bulkReason`; saved and restored with the draft (auth.ts saveDraft path,
   CaptainMP :280-305, `draftHasValues`).
5. `OrderEditPage`: same control above the product list (:290), same sticky behaviour (no drafts there).
6. Hide the control for suppliers with `suggestion_alerts_enabled = false` (Pago) — today it shows and applies to
   0 lines (`showOverruleAllControl`, CaptainMP :799-800).
7. A line that stops requiring a reason keeps its reason (today's behaviour for hand-picked reasons; the backend
   stores it without a gate). Assumed, not changed.
8. Tests: invert overruleAll.test.ts "never replaces an existing reason" (:98-137) for `overwrite`; new cases for
   `fillMissing`, OTHER comment handling, alerts-off; a component test for the sticky flow on both screens.

## Phase 5 — Sender alias for WESTFIELD (pending Q7)

> **Mostly done by order-email-v2 (D30).** The "Facts" below describe `main` before PR #43 and are stale.

Facts: dispatch builds a Gmail compose URL with to/cc/subject/body only (gmail_url.py:224-231,
emailBody.ts:184-197) — no sender; Transport Gmail API drafts write only `To:` and `Subject:` (gmailDraft.ts:101-102).
`master-data-followups` already records a related rule ("send from biuro@; CC the location mailbox unless it is the
sender") that was never implemented.
- Minimum (no code): add "Westfield — wysyłka z mokotow@pitabros.pl" to `docs/pita-supply-os-v1/COMPANY_ENTITIES.md`
  and NEW_LOCATION_CHECKLIST.md; the Manager picks the From alias in Gmail.
- Full: migration adds `locations.sender_email`; ManagerOrderDetail returns it; DispatchPanel/ResendPanel show
  "Wyślij z: …"; Transport drafts add `From:` (works only if the alias is a verified send-as of the signed-in account).
  A compose URL cannot choose the sender alias.

## Phase 6 — Staff message (operator sends; draft in Polish)

> **Zmiany w Supply OS od [data]**
> 1. **Gyros nieścięty znika z inwentaryzacji.** Napoczęty, nieścięty blok wpisujecie przy bloku, z którego
>    pochodzi: „Gyros 15 KG” lub „Gyros 25 KG” (na Norblinie 25 KG) — pełne bloki w polu **szt**, napoczęty
>    w polu **kg**, np. 3 szt + 10 kg. Kurczak (KEN): „Gyros z Kurczaka (Kebab)” tak samo — pełne bloki w szt,
>    napoczęty w kg.
>    **Gyros ścięty** (już pokrojony, w pojemnikach) wpisujecie jak dotąd w „Gyros wieprzowy ścięty” /
>    „Gyros kurczak ścięty”, w kg.
> 2. **Gyros liczymy w sztukach, nie w blokach** — to tylko nazwa jednostki, 1 szt = 1 blok (15 kg lub 25 kg).
> 3. **Frytki Aviko w kartonach:** 1 karton = 4 paczki 2,5 kg. Wpisujecie pełne kartony i osobno luźne paczki.
>    Zamawiamy pełne kartony.
> 4. **Liść laurowy:** opakowanie 80 g, max 1 opakowanie — zamawiamy, gdy się kończy.
> 5. **Nowe nazwy produktów** Intermleczu — takie jak na fakturze (np. „Frytki Aviko Super Crunch 9,5mm 2,5kg”,
>    „Halloumi Reha 200gr”). To te same produkty.
> 6. **Powód zbiorczo** [po wdrożeniu fazy 4]: wybrany raz, wpisuje się też do pozycji, które dodacie później.

## Phase 7 — 0/0/0 cleanup (after the operator ticks `zero-thresholds-review.md`)

Delete the ticked `location_product_settings` rows (history unaffected); for products 0/0/0 everywhere
(Ocet spirytusowy, Top Glass Tenzi, mini łyżeczki, 2 l wines, Burn, Cif) consider `products.active = false` instead.

## Phase 8 — Pack variants and pack expansion (added 2026-10-01 from the pago-stock-packs-plus-kg lane)

Source: operator via the pago-stock-packs-plus-kg session, 2026-10-01. Review items, nothing decided yet.

8.1 **Cappy — split by package.** Operator: Cappy 0,33 l PET = zgrzewka 12; Cappy 0,25 l glass = skrzynka 24 (like
Coca-Cola 0,25 glass). Prod has only P064 Cappy Jabłko and P065 Cappy Pomarańcza, both zgrzewka × 12, at all
7 locations (WOLA/KEN 12/36, BRACKA 5/12, BROWARY 6/12, ELEKTROWNIA/NORBLIN/WESTFIELD 10/24). KEN invoices
(Aug) bill "0.25 RGB X24 CAPPY APPLE / ORANGE" — glass crates. Proposed: two new products "Cappy Jabłko 0,25 l szkło"
/ "Cappy Pomarańcza 0,25 l szkło" (Coca-Cola, skrzynka × 24, price from invoice 100,32 zł netto per crate);
rename P064/P065 to "… 0,33 l PET"; per location, move the thresholds to the variant it buys and delete the other
row (same pattern as `prod-sql-2-westfield.sql`). New products, so order history stays on the old ones. **Q11:**
which locations take glass, which PET?

8.2 **Pack expansion for products bought in packs but set up × 1.** Candidates (order_note already names the pack):
- P015 Halloumi — karton 12 szt (invoices: 24/36/48, always whole cartons) → strong candidate.
- P121 Gąbka do naczyń — opak 10 szt (Norblin sheet counts in packs; thresholds already ×10) → candidate.
- P021 Frytki Aviko — karton 4 → Phase 2. Rolls 80/80 and 57/50 — opak 6 → step 1.11.
- Not proposed: P140 Kawa (karton 6) and P141 Lipton (karton 12) — 0,5/1,5 thresholds, single items are ordered;
  P011 Tzatzyki (karton 6) — 2–24 pojemniki, mostly fewer than a carton.
Effect of upp > 1: the two-field stock input and packs-first thresholds switch on automatically, but ordering also
moves to whole packs (suggestion rounds up to full packs, e-mail prints "N karton") — confirm per product. **Q12.**

**Technique (applies to 8.2, Phase 2 and 1.11):** thresholds need no conversion while `inventory_unit` stays, but
`units_per_purchase_unit` must NOT be changed in place on a row with order history: pack size and unit are joined
live, so old order lines and receipts would be re-labelled ("42" bags → "42 karton"), and open claimed/sent orders
are re-computed and dispatched with the new pack size. Add a new supplier_product row with the pack and set the old
one `active = false`; guard on no `captain_submitted` lines for the old row; diff before, audit after.

## Order of work (round 2 — runs in a Claude Code cloud session)

Execution model (operator, 2026-10-01): subagent-driven. The main loop (Opus 5.5) orchestrates;
`.claude/agents/impl-sonnet.md` (Sonnet 5.5) takes the lighter, well-specified steps (UI, i18n, tests, lookups);
`.claude/agents/review-opus-xhigh.md` (Opus 5.5, xhigh effort) takes the heavy steps (migration, engine, e-mail,
prod SQL drafts) and every review/verification. The operator approves each gate from the phone.

0. Setup: install like CI (`supply-os-v1`: `pip install -e ".[dev]"`, Python 3.12; `frontend`: `npm ci`, Node 20),
   baseline `python -m pytest -q` + `npm run test`; check the Supabase connector answers a read.
1. `/10x-plan` — rewrite this file into the skill format using round 2; phases: data batch, readability PR (D29 +
   Phase 4), bulk packs PR (D22/D23), small leftovers (1.7, checklist), staff message, 0/0/0 cleanup.
2. `/10x-plan-review` (Opus xhigh), fix loop → **gate: operator approves the plan**.
3. Data batch (Phase 1 with D17–D21, D24–D28): SQL prepared as diff → one guarded DO block per step → audit,
   reviewed by Opus xhigh → **gate: operator approves the diff** → apply → audit saved here. The staff message
   (Phase 6) goes out with 1.5.
4. PR "readability": bold units (Phase 3 + D29) and "Powód zbiorczo" (Phase 4) → `/10x-impl-review` → `/verify` →
   PR → CI → **gate: merge** → confirm the Vercel bundle before any live test.
5. PR "bulk packs" (D22): migration 0027, engine + parity, Captain card / inventory grid / edit screen, Manager
   detail, e-mail + Transport documents. Migration on prod **before** merge (gate), then the D23 cases as a
   diff → apply → audit batch (gate).
6. Leftovers: step 1.7, NEW_LOCATION_CHECKLIST line, Phase 7 after `zero-thresholds-review.md` comes back.
7. Archive: roadmap row + `AGENTS.md` check in the same commit (lessons.md).

Original order (round 1, kept for reference):

1. Operator answers Q1–Q12 (only the blocked steps wait).
2. Phase 1 (approved steps) + Phase 2 — one prod session, diff → apply → audit. Phase 6 message goes out the same
   day, before or with 1.5 and Phase 2.
3. Phases 3 + 4 — one PR (frontend only), CI green, Vercel deploy confirmed before any live test (lessons.md).
4. Phase 5 per Q7; Phase 7 after the review list comes back; Phase 8 after Q11/Q12 (data, same diff → apply → audit).
5. Archive: roadmap row (Horizon 3 table) + `AGENTS.md` check in the same commit (lessons.md).
