## Verification report: what the meetings and mails asked for vs. what is in the repo (read-only, 2026-10-17)

There is no prod database access, so "SHIPPED" for master data means the repo records the prod SQL as applied. Paths in the table are relative to the repo root, `/Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e`. Absolute paths for the key files are listed at the end.

Source codes in the `src#` column: W = wispr-meetings.md, M = mail-2026-10-16.md, MD = mail-delta-2026-10-17.md, S24/S25 = laptop-sessions.md sections 24/25.

### 1. Status table

#### NOT SHIPPED

| src# | item | status | evidence | what's left |
|---|---|---|---|---|
| W61 / S24 | Westfield delivers until 10:00, not "od 11:00"; per-location hours | NOT SHIPPED | `supply-os-v1/app/gmail_url.py:357` has `od godziny 11:00` hardcoded; TS twin `frontend/src/pages/manager/lib/emailBody.ts:199` | Add per-location hours (new `locations` column, additive migration); change both builders and the golden tests |
| W62 / S24 | E-mail: company data first, then footer | NOT SHIPPED | `gmail_url.py:366` "Pozdrawiam," comes before the company/NIP block at `:381-387`; same order in `emailBody.ts:210` vs `:223-227` | Reorder in both builders and the golden test |
| W66 / S24 | Off-catalogue items as highlighted rows in the product table | NOT SHIPPED | They print as a separate section: `gmail_url.py:341`, `emailBody.ts:185` "Pozycje spoza katalogu:" | Render them as table rows with a marker in both builders and the PDF |
| W64 / S24 | Strip the bulk-pack suffix after "/" from names | NOT SHIPPED | No stripping code anywhere (grep). Suffixes sit in the data (`docs/pita-supply-os-v1/seed/products.csv:140-142`) and R-34 added more of them deliberately (`context/archive/2026-10-01-feedback-1001-names-units/names.md:14-49`) | Needs a decision first (D3) |
| W68 | Combine transport for Filber | NOT SHIPPED | Only Pago carries a companion supplier: `supply-os-v1/app/main.py:4674` `{"SUP_PAGO": ("SUP_MORY",)}` | Add SUP_FILBER as a companion, plus PDF/e-mail blocks (D4) |
| W34 | "Zamówione" button for Filber, like Cola | NOT SHIPPED | Filber's channel is e-mail (`context/archive/2026-09-28-order-line-zero-qty/research.md:198`). The e-mail branch has no mark-ordered button: `frontend/src/pages/manager/DispatchPanel.tsx:189` vs `:223-229` | Switch SUP_FILBER `ordering_method` (prod data), or merge into W68 |
| W70 / S24 | Pago and Mory back into one category | NOT SHIPPED | Still two suppliers. Only the transport combines them (PR #45 b24353b, `main.py:4674`). `context/changes/inventory-card-order/prod-sql-pago-mory.sql` is still waiting for the operator (laptop "Left undone" #1) | Needs a decision first (D4) |
| W71 / S24 | Small office items to the main warehouse (Mory) | NOT SHIPPED | No SQL in the repo. Marek's 29.09 answer #5 still says Blue Service, and the 12.10 decision supersedes it | Marek's list, then a prod SQL move |
| W72 / S24 / S23 | Spec Food missing from the Manager supplier list | NOT SHIPPED | The list is built only from suppliers with queued orders (`frontend/src/pages/ManagerPage.tsx:452-460`), and SUP_SPEC was never ordered (S23 prod SELECT) | Decide (D11); check that the P179 KEN setting is visible to the KEN captain |
| W57 / M6 | FORUM white onion, about 1 kg | NOT SHIPPED | FORUM P018 is 0,5/2/2 with the Warsaw case "worek 5 kg" copied over (rollout-notes on branch b844dfb `:84`, `:122`; case in `context/archive/2026-10-01-feedback-1001-names-units/plan.md:553-586`), so the suggestion is always 0 | Prod SQL: thresholds, and drop the case on SP_BUKAT_KRK_P018 |
| W58 / S24 | Souvlaki spice Browary 0,5/2/2 | NOT SHIPPED | No SQL in the repo | Prod SQL (data is complete) |
| W59 / M6 | PET counted in 12s at Norblin/Browary | NOT SHIPPED | No case rows for PET in the 0028 data. R-34 step 1.11h (PET rename) is blocked (`prod-run-2026-10-02.md` "Still open") | Marek's PET product list, then a case on each row |
| W60 / S24 | Mandatory stock entry, trial to month end (not Norblin/Elektrownia) | NOT SHIPPED | Blank stock is allowed by design: `frontend/src/i18n/strings.ts:987` "Puste = nie policzone"; uncounted path `main.py:815-877` | Per-location flag (migration) + submit gate + copy (D6) |
| W48 | Loss report | NOT SHIPPED | No loss code anywhere (grep "strat/loss") | L-size build (D12) |
| W40 / M10 | Ordering rules shown in the app | NOT SHIPPED | No rules copy in i18n (grep "zasad") | Marek's "Zasady zamawiania Warszawa" (waiting for Ben's approval) |
| W9 | Telegram alerts and reminders | NOT SHIPPED | R-32 is backlog only, "not shaped" (`context/foundation/roadmap.md:285`) | Marek's alert list; Ben to un-park R-32 |
| W75 / M4 | Halloumi split: in stock vs cut (production count) | NOT SHIPPED | Only P015 "Halloumi" exists, in szt (`products.csv:16`). Marked "not decided" (wispr #75, note 8) | D8 |
| M4 | Kraków Bukat cutoff 16:00 (app shows 17:00) | NOT SHIPPED | City suppliers were inserted with delivery_days/cutoff NULL (`context/changes/krakow-katowice-rollout/prod-sql-B-suppliers-catalog.sql:12-13`). With no rule the calendar falls back to 17:00: `supply-os-v1/app/delivery_calendar.py:39`, `:191-207` | Prod SQL: a delivery-rule row for SUP_BUKAT_KRK × FORUM (Mon/Wed/Fri, 16:00 the day before) |
| M4 | Pita counted per piece at Kraków | NOT SHIPPED | P026 is "Pita (opakowania) szt 10", unit opak (`products.csv:27`) | Conflicts with W49 "one unit per product" (D8) |
| M4 | Thamma Lemon / Mastiha; drinks in paper-list order | NOT SHIPPED | No such products (grep). Card order per location exists (0027, PR #44), but the FORUM override is not recorded | Marek: supplier and price; then a FORUM `inventory_order` override |
| M6 | Kraków/Katowice supplier e-mails, minimums, days, cutoffs (Dis-Pack 700 zł / day before; Bukat Mon/Wed/Fri / 16:00 / 500 zł; Kuchnie Świata, Selgros e-mails) | NOT SHIPPED | `prod-sql-B-suppliers-catalog.sql:12-13`: 7 suppliers manual, email/days/cutoff/minimum NULL. No later SQL | Prod SQL (data delivered 15.10) + D7 |
| M6 | Dis-Pack catalogue under Dis-Pack's own names and EANs | NOT SHIPPED | Names come from Marek's sheet; no EANs recorded (rollout-notes on branch) | Marek / Dis-Pack: the list |
| M6 | Supersam location e-mail `supersampitabros@gmail.com` | NOT SHIPPED | Before-state shows no Supersam mailbox (branch rollout-notes `:14`); step A predates 15.10 | One guarded UPDATE |
| M6 | Katowice tzatziki/tiro/feta collected from Bukat with the Pago run | NOT SHIPPED | SUP_WARSZAWA_KAT has 16 rows without P011/P012/P014 (`prod-sql-B2-katowice-warsaw-cola.sql:17-18`, `:79-91`). Katowice tzatziki is count-only (decision 8, branch rollout-notes `:88`) | Add the rows + thresholds (Marek) |
| M2-1 | Browary mayo/mustard targets entered in kg by mistake (halve) | NOT SHIPPED | `context/changes/master-data-followups/change.md:183` unchecked; not in the R-34 plan | Prod SQL (data is complete) |
| M2-2 / MD12 / MD13 | Fries Wola/Browary; KEN gyros over-ordering; KEN rolls/bags/gloves | NOT SHIPPED | `master-data-followups/change.md:185` unchecked; no SQL | Marek: targets |
| M2-6 | Mop (Selgros) / Tenzi 1 L and 5 L at Bracka | NOT SHIPPED | `master-data-followups/change.md` question 6 unchecked | Marek: which model; then prod SQL |
| S25 | Backup card looks empty / misleading | NOT SHIPPED | A backup card disables the suggestion (`frontend/src/pages/captain-mp/components/ProductCard.tsx:375-390`) and labels it "najpierw wpisz obecny stan" (`strings.ts:134-135`) | Backup-specific card variant (folded into WP5) |
| S25 | Supplier tab ✓ "wysłane" lost after refresh (risk of a second order to the same supplier) | NOT SHIPPED | Kept only in component state: `frontend/src/pages/captain-mp/CaptainMP.tsx:110` `useState<Set<string>>(new Set())` | Rebuild it from today's orders after reload |
| W76 / W77 / M7 / MD4-5 | Gdańsk (SLONY) rollout | NOT SHIPPED | `context/changes/gdansk-rollout/plan.md:295-326`: every progress box unchecked. Change folder is untracked; SLONY inactive with 115 rows at 0/0/0 (`rollout-notes.md` STEP 0) | Marek's Gdańsk reply, then apply SQL + Railway code `<kod demo SLONY>` |
| MD3 | Thermal paper outside Warsaw: 4 packs, reorder at the last one | NOT SHIPPED | No SQL; decision set for 19.10 | D9 |

#### PARTIAL

| src# | item | status | evidence | what's left |
|---|---|---|---|---|
| W61 | A date instead of "__________" in the e-mail | PARTIAL | Built behind a switch: `supply-os-v1/app/config.py:104` `order_email_delivery_date_enabled = False`; blank placeholder at `gmail_url.py:131`, `:356`. Marek saw the underscore on 12.10 | Set Railway `SUPPLY_OS_ORDER_EMAIL_DELIVERY_DATE_ENABLED=true` (D2) |
| W63 / S24 | "Wyślij" = create the Gmail draft and open it | PARTIAL | A draft is created ("Zrób draft w Gmailu", `DispatchPanel.tsx:439-454`), but the link opens the drafts folder, not the draft (`frontend/src/pages/manager/lib/orderEmailDraft.ts:207`, `OrderDetailPane.tsx:451`). There are still four buttons | One primary button that drafts, dispatches and opens that draft |
| W67 / S24 | Selgros extras as a list/dropdown with unit and price from invoices | PARTIAL | Backup rows exist (0029 `is_backup`; badge `strings.ts:146`; `ProductCard.tsx:100,183`) but render as full cards, not a list. Selgros prices are only indicative (branch rollout-notes) | List UI + invoice prices (WP5) |
| W65 | Product names carry the weight, unified | PARTIAL | R-34 1.1 applied 20 + 24 names on 2026-10-02 (`prod-run-2026-10-02.md`). Falafel got "…5kg" only as the supplier name (`names.md:63-87`); screen names are not unified | Finish the naming pass together with W64 (D3) |
| W38 | Must enter how many empty crates/gas bottles | PARTIAL | Crates prompt (empty / with bottles) exists only for SUP_COCACOLA (`frontend/src/pages/captain-mp/lib/supplierPrompts.ts:18-19`, `strings.ts:1094-1099`, df42a15). It is optional and written into captain_note; nothing for gas, beer crates or SUP_COCACOLA_KAT | Extend + optionally make mandatory (WP12); Marek/Bartek pickup rules |
| W73 / S24 / laptop #22 | Stale "w realizacji" orders block closing; "close without receipt" | PARTIAL | Cancel exists only for captain_submitted / manager_claimed (`main.py:2463-2522`). No close-without-receipt for manager_sent: no such route among the write endpoints | New close action with trace (WP9, D5); operator clean-up of the 16 stale claimed orders |
| W10 | Delivery plan per location triggers reminders | PARTIAL | Delivery rules + calendar done (R-26, `roadmap.md:279`, 0025). Only the Thursday Bukat/Intermlecz prompt; no reminders | Folded into the Telegram item (W9) |
| W51 | GoStock export of counts and PZ; manuals | PARTIAL | Generic Manager CSV of one count with values (`frontend/src/pages/manager/lib/inventoryCsv.ts:1-13`); `gostock_id` field only (`supply-os-v1/app/models.py:56`). No GoStock-format or PZ export | Format spec (D12) |
| W28 | "box" → karton; Cola skrzynka (glass) / zgrzewka (PET) | PARTIAL | Glass uses skrzynka (week2 B, R-34 1.11). Corfu is still `box`: `master-data-followups/change.md:51-52` | Prod SQL rename on P136/P137/P157 purchase_unit |
| W36 | Stock counts readable / sortable | PARTIAL | Search/grouping/sort shipped (week2 phase 4); card-order code merged (PR #44, 1c5dccb, migration 0027). Card-order data `context/changes/inventory-card-order/prod-sql.sql` "nothing below has run on prod" (`change.md` deploy order); no applied record | Confirm or apply the card-order prod SQL |
| M2-3 | Wola till rolls in packs, max 5 packs | PARTIAL | Pack input exists (0028 case `SP_MORY_P129`/`P183` opak 6, applied 02.10). R-34 1.9 changed rolls only at Norblin/Elektrownia/Westfield (`feedback-1001 plan.md:190-193`) | WOLA thresholds (data is complete) |
| M2-5 | Sponges "Gąbki do naczyń 10szt", 0,5/1,5 everywhere | PARTIAL | P121 renamed + case opak 10, applied 02.10 (`prod-run-2026-10-02.md` Phase 4). New thresholds not recorded | Prod SQL thresholds |

#### SHIPPED

| src# | item | status | evidence | what's left |
|---|---|---|---|---|
| W1 | Free-text line for ad-hoc items | SHIPPED (per supplier order, not per category) | 0013 applied 2026-09-02 (`context/archive/2026-09-01-training-feedback-0901/plan.md:322`); `frontend/src/pages/captain-mp/components/ExtraItemsControl.tsx`; Transport extras into the PDF (R-36, `roadmap.md:289`) | none |
| W2 | Remove bąbila | SHIPPED | `context/archive/2026-09-06-inventory-confirm-and-history/prod-sql.sql` (applied 09-06) + week2 F (applied 09-19) | none |
| W3 | Tiro 2 kg | SHIPPED | inventory-confirm prod-sql §2 (09-06); dairy pojemnik batch applied 28.09 (`master-data-followups/change.md:204-209`) | none |
| W4 | Edit a stock count with log, name suggestions | SHIPPED | 0014 applied 09-02 (training-feedback plan.md:338); `strings.ts:1222` "Liczył: {who}" | none |
| W5 | Tapes = rolls | SHIPPED | 3aa1138 (rolki-minima archive) | The Allegro/Selgros part is under SUPERSEDED |
| W6 | Gas bottle open/closed; crates empty vs with bottles | SHIPPED | P181/P182 split (09-06) + week2 E; Cola crates prompt df42a15 | none |
| W12 / W13 / W14 | Pago-only pickup doc; "LOTS" (actually the "LOC •" prefix) removed; units | SHIPPED | 0015 + data pass applied 09-02/03 (training-feedback plan.md:346-352); research.md:120; Tiro pojemnik + rolls (rolki-minima) | Live PDF check still open (plan.md:353) |
| W17 / W32 | Old orders folded away / archive / newest first | SHIPPED | d7e261a (week2 phase 5) on main | none |
| W20 / W21 / W24 / W25 / W27 / W29 | Bifteki 4,2; Cola can vs glass; sponges per piece; scourers/brush to Mory; Korfu 12; Florinis, pojemnik | SHIPPED | `context/archive/2026-09-17-week2-feedback-quantities/prod-sql.sql` A, B, C, D, G (applied 2026-09-19, header `:4-5`); Bukat pojemnik `master-data-followups/change.md:209` | `master-data-followups/change.md:16` (C-1) and `:51-52` (Tiro "wiadro") are stale |
| W22 / W23 / W49 | Two inputs (cases + loose); pay-unit principle with hints | SHIPPED | 0028 + PR #53 ec58b78; R-25/R-34 (`roadmap.md:278`, `:287`) | none |
| W11 | Crate rounding stays a soft override | SHIPPED | `training-feedback-0901/change.md:33-35`; R-34 "no reason needed between need and pack" | none |
| W31 | Location e-mail in DW | SHIPPED | 0019 + week2 I | none |
| W33 | Edit after send with log, lock after receipt | SHIPPED | 0020, b8c2143 on main | none |
| W35 | "Utwórz transport" combines Pago | SHIPPED | `context/archive/2026-08-21-to-ordering-pago/`; R-36 | R-36 operator E2E pending |
| W37 | Critical-product prompt; red onion on top; Bukat order | SHIPPED (mechanism) | `strings.ts:386-388` "Nie zamówiono produktów krytycznych"; R-24 Bukat order (`roadmap.md:277`) | Check the prod `is_critical` list against Marek's ~12 |
| W50 | Calendar only warns | SHIPPED | R-26, `delivery_calendar.py` (warning only) | none |
| M3 | Kraków/Katowice min/max by supplier | SHIPPED | 0029 + A/C/B/B2 applied, captain codes + GET smoke (branch `origin/claude/rollout-katowice-krakow-b96616` rollout-notes.md:539-545) | Branch docs not on main; R-37 row stale |
| MD16 | Katowice login | SHIPPED | SUPERSAM code in Railway (branch rollout-notes `:545`); Supersam counted 12.10 (S24) | Whether Sahil personally has the code: ask |

#### SUPERSEDED / DROPPED

| src# | item | status | evidence | what's left |
|---|---|---|---|---|
| W8 | Deviation threshold 20% with mandatory comment | SUPERSEDED (conflict) | The archived record of the same 09-01 meeting says "the 25% deviation threshold stays as-is" (`training-feedback-0901/change.md:33`). Code is 25% with a mandatory reason_code, not free text (`main.py:940`, `:1125`) | Ben confirms 25% (D1) |
| W39 | Weekend/weekday or dynamic targets | DROPPED to V2 | W52 (09-29) defers it; R-17 closed unmerged (`roadmap.md:270`) | none |
| W5 (part) | Activate Allegro + Selgros | SUPERSEDED | Kept inactive on purpose 09-06 (inventory-confirm prod-sql); successor is W67 | none |
| M2-5 (part) | Envelopes/staples/pens from Blue Service | SUPERSEDED | W71 (12.10): main warehouse | none |

#### NOT AN APP ITEM

- W7 Cola mixing rules: Marek / Bartek.
- W15 spice-pack feedback: Marek.
- W16 one lemonade order per supplier: Ben (matches the current app and W68).
- W18 logistics minimums: Marek. The minimum chip already exists (R-24).
- W19 Coca-Cola price list: Marek / Bartek.
- W26 freebies ban: Ben / Marek.
- W30 feta block check: Marek.
- W41 / W46 everyone orders via the app: Ben.
- W42 September count: Ben.
- W43 / W44 Blue Service quantities, min-max rules: Marek.
- W45 deposit info: Marek (Cola project).
- W47 Pago off the sheet: Ben / Marek. R-36 E2E is the app side.
- W52 dynamic target to V2: decision.
- W53 timeline / dashboard: Georgios / Ben.
- W54 / W55 receiving-issue analysis, tomato/onion test: Ben / Marek.
- W56 supplier contacts: Marek, delivered 15.10; the load is under M6.
- W69 keep the statuses as they are: Ben, nothing to build.
- W74 glitch list: Marek.
- W78 Trello priorities: team.
- M1 / MD6 week-1 correction questions: Marek. An optional per-line `manager_comment` already exists (`models.py:265`).
- M2-4 captains revise min/max after a month: Marek / captains.
- M5 / MD7 / MD8 all locations by end of October: Ben / Georgios / Marek.
- M9 / MD9 / MD10 Intermlecz price list and corrections: Marek / supplier.
- MD14 / MD15 / MD18 / MD19: information only.

#### CANNOT TELL

| src# | item | what to check |
|---|---|---|
| M8 / MD11 | KAN 1350 (Fillo kanaki) on the Browary 13.10 order | Not in the seed. Run `SELECT product_id, product_name_pl FROM products WHERE product_name_pl ILIKE '%fillo%'` and `supplier_products.supplier_sku='KAN1350'`. Check whether the 13.10 WAW pickup doc came from the app or from Marek's sheet |
| MD1 | "Incomplete entries force manual moving" (Kraków/Katowice) | Ask Marek: sheet or app, which rows |
| MD17 | Wola product name from Georgios → Tushar | Read that mail for the name |
| S25 | Two Transport columns with the same header | Inferred from code only, not reproduced; reproduce on a draft batch |
| M6 | Katowice min/max for 24 Coca-Cola/Pago/Magazyn/Lemoniady rows: loaded or 0? | SELECT SUPERSAM settings for SUP_COCACOLA_KAT / SUP_WARSZAWA_KAT products. S24 and the 15.10 mail disagree |

### 2. Backlog to build (deduplicated)

| WP | title | items | size | touches | blocked on |
|---|---|---|---|---|---|
| 1 | Supplier e-mail v2.1: footer order, extras as table rows, delivery date on | W62, W66, W61-date | S | backend + frontend (both builders, golden tests); Railway env | Ben D2 (switch) |
| 2 | Per-location delivery hours in the e-mail | W61 | M | migration (`locations`) + both builders + prod data | Marek (hours per location) |
| 3 | One "Wyślij" = draft + open that draft | W63 | S | frontend | none |
| 4 | Product-name display: strip the "/N" bulk suffix, unify weights | W64, W65 | M | frontend display helper or prod data | Ben D3 |
| 5 | Backup / Selgros extras as a list with unit and price; backup card stops looking empty | W67, S25 backup card | M | frontend + prod data (prices) | Ben D10; Marek prices |
| 6 | Captain double-order guard survives reload | S25 sent tab | S | frontend (and possibly the orders endpoint) | none |
| 7 | Kraków/Katowice supplier data load | M4 cutoff, M6 contacts/min/days, Supersam e-mail, Katowice tzatziki path, W57, Dis-Pack names/EANs, 24 Katowice thresholds | M | prod data (suppliers, delivery rules, locations, settings) | Ben D7; Marek (EANs, 24 thresholds, Selgros list) |
| 8 | Warsaw master-data batch | W58, W59, W71, W28, M2-1, M2-3, M2-5, M2-6, M2-2, MD12, MD13, R-34 carry-overs (DELETE blocks, 1.5, 1.11d/h) | M | prod data | Partly ready now (W58, M2-1, M2-3, M2-5, W28); rest waits on Marek |
| 9 | Pago+Mory one category; Filber in transport and/or marked as ordered | W70, W68, W34 (+ pending prod-sql-pago-mory) | M-L | backend (`main.py:4674`) + frontend + prod data | Ben D4 |
| 10 | Manager "close without receipt" with trace | W73, laptop #22 | M | backend + frontend (reuse the 0004 trace columns or additive migration) | Ben D5 |
| 11 | Spec Food / all active suppliers in the Manager filter | W72 | S | frontend | Ben D11 |
| 12 | Mandatory stock count (trial) | W60 | M | migration (location flag) + submit gate + i18n + prod data | Ben D6 |
| 13 | Empty crates / gas prompts beyond Coca-Cola | W38 | S | frontend (`supplierPrompts.ts`) | Marek/Bartek pickup rules |
| 14 | Kraków captain requests | M4 (halloumi cut, pita per piece, Thamma, drinks order), W75 | S-M | prod data (+ inventory_order override) | Ben D8; Marek (Thamma supplier, price) |
| 15 | Gdańsk rollout apply | W76, W77, M7 | M | prod data + Railway token | Marek (Gdańsk reply); operator apply |
| 16 | Consumables category / thermal paper rule | MD2, MD3 | S-M | prod data (maybe a category) | Ben D9 (19.10) |
| 17 | Ordering rules in the app | W40 | S-M | frontend copy / supplier notes | Marek rules + Ben approval |
| 18 | GoStock export (counts + PZ) | W51 | M-L | backend + frontend | Ben D12 (format) |
| 19 | Loss report | W48 | L | backend + frontend + migration | Ben D12 |
| 20 | Telegram reminders / visual calendar | W9, W10 | L | backend + infra | Ben (un-park R-32); Marek alert list |

### 3. Decisions Ben must make (only those that block a build)

- **D1:** Confirm the 25% deviation threshold. The repo says it stays; the 09-01 transcript says 20%.
- **D2:** Turn on the e-mail delivery date (`SUPPLY_OS_ORDER_EMAIL_DELIVERY_DATE_ENABLED`).
- **D3:** For the "/N" suffix and weights: strip in display code or rename in data, and on which screens (Captain, e-mail, PDF). R-34 added invoice names with "/12" on purpose.
- **D4:** Pago+Mory as one category: move Mory products under SUP_PAGO, or group only in the UI. Also, is Filber a transport companion, a mark-ordered supplier, or both? On 12.10 he said "no third aggregation layer".
- **D5:** Meaning of "close without receipt": a new status or a cancel variant, who may do it, and what happens to the 16 stale claimed orders.
- **D6:** Mandatory count: hard gate or warning, which locations, end date 31.10. Ali's agreement is open.
- **D7:** Kraków/Katowice suppliers: stay `manual` or move to `email`.
- **D8:** Kraków: halloumi cut split, and pita per piece vs the one-unit-per-product rule (W49).
- **D9:** Consumables category and who buys outside Warsaw (set for 19.10).
- **D10:** Pick the greying / double-tick options in the "Supply OS ze spotkań" artifact, and the shape of the backup list.
- **D11:** Should the Manager filter list every active supplier?
- **D12:** Are the loss report and GoStock export in V1, or after Georgios's "analyse first" (W55)?
- **D13:** Do Filber lemonades P075-P077 stay in the Katowice "Pago + Magazyn + Lemoniady" tab?

### 4. Data Marek must deliver

- Delivery hours per location; Westfield until 10:00 is the only one given so far.
- Katowice min/max for the 24 Coca-Cola/Pago/Magazyn/Lemoniady rows; Forum thresholds re-entered; which Selgros items get thresholds.
- Dis-Pack catalogue under Dis-Pack's names + EANs.
- Coca-Cola Katowice account and minimum.
- Minimums, days and cutoffs for Kuchnie Świata and Selgros Kraków/Katowice. Only e-mails were given on 15.10.
- Gdańsk package: all 8 points of the 12.10 mail, including whether Pago+Mory+Filber go as one order.
- List of PET products counted in 12s (Norblin/Browary).
- Office items to move to the main warehouse; which mop at Bracka.
- Selgros extras prices not on invoices.
- Targets: fries Wola/Browary, KEN gyros, KEN rolls/bags/gloves.
- KAN 1350 sheet mapping fix, and which roll Browary needed.
- "Zasady zamawiania Warszawa" for Ben's approval.
- Crate/gas pickup rules (with Bartek).
- Thamma Lemon/Mastiha supplier + price.
- What exactly is "incomplete" in the Kraków/Katowice tool (MD1).
- Answers to the 06.09 week-1 correction questions.

Key files:
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/supply-os-v1/app/gmail_url.py
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/frontend/src/pages/manager/lib/emailBody.ts
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/supply-os-v1/app/config.py
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/supply-os-v1/app/main.py
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/supply-os-v1/app/delivery_calendar.py
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/frontend/src/pages/manager/DispatchPanel.tsx
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/frontend/src/pages/manager/lib/orderEmailDraft.ts
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/frontend/src/pages/ManagerPage.tsx
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/frontend/src/pages/captain-mp/CaptainMP.tsx
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/frontend/src/pages/captain-mp/components/ProductCard.tsx
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/frontend/src/pages/captain-mp/lib/supplierPrompts.ts
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/frontend/src/i18n/strings.ts
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/context/changes/master-data-followups/change.md
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/context/changes/krakow-katowice-rollout/prod-sql-B-suppliers-catalog.sql
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/context/changes/gdansk-rollout/plan.md
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/context/archive/2026-10-01-feedback-1001-names-units/prod-run-2026-10-02.md
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/context/archive/2026-09-17-week2-feedback-quantities/prod-sql.sql
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/context/archive/2026-09-01-training-feedback-0901/change.md
- /Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS/.claude/worktrees/projekt-porzadek-plan-80179e/context/foundation/roadmap.md

Nothing was edited, committed or written to any database.

> Korekta 2026-10-17 (lane główny): wiersz Gdańsk mówi „SLONY inactive” — nieaktualne. Odczyt prod 17.10: SLONY active, own_catalog, 5 dostawców GDA, 130 aktywnych pozycji katalogu, 133 ustawienia (12 pozostałości szablonu), cutoff_time NULL u wszystkich GDA, funkcja gdansk_rollout_step1 nadal istnieje, 2 zamówienia SLONY.
