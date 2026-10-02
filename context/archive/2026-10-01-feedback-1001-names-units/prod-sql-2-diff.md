# Phase 4 — diff for the operator (`prod-sql-2-cases.sql`)

## Do decyzji operatora

- **Cebula biała P018 (krok 4.2):** bez opakowania zbiorczego (pominąć 4.2 — rekomendacja), `keep` (worek 5 kg, progi
  bez zmian, jak D32) czy `raise` (worek 5 kg i cel = max = 5 kg we wszystkich 7 lokalach)? Plik ma domyślnie `keep`.
- **BRACKA rolki 80/80 i 80/20 (krok 4.4, `v_bracka`):** progi bez zmian (`keep`, domyślnie) czy cel = max = 6 rolek
  (`raise`)?
- **Produkty krytyczne z opakowaniem** (pomidor, cebula czerwona, halloumi, frytki): przy małym braku aplikacja
  zaproponuje 0 i nie zapyta o powód, gdy kapitan nic nie zamówi. OK?
- **Notatki:** wyczyszczone przy P016, P015 i P121 (powtarzały opakowanie); frytki dostają „1 szt = 1 paczka 2,5 kg”.
  OK?
- **Zamówienie testowe:** `ORD-20261001-WOL-INTE-1851ca` („TEST TEST TEST”) czeka jako przejęte. Anulować?

- **Source:** prod read-only SELECTs, 2026-10-02. Nothing was written when this diff was prepared. **Applied on 2026-10-02 (4.2 keep, 4.4 keep) — see `prod-run-2026-10-02.md`.**
- **Preconditions:**
  - migration 0028 is applied (checked: 2 columns, 3 CHECKs, no row has a case yet);
  - Phase 1 steps 1.1 and 1.8 are applied (P021 is `paczka`);
  - PR #53 is live (Railway `/health` and the new Vercel bundle). Confirm this before staff message part 2.
- **How it runs:** one `DO` block per product group, one block per execution. Each block re-checks the before-state
  below (case columns empty, unit, upp, rounding rule, note, and the thresholds it writes). If anything changed since
  this read, the block raises and changes nothing. No row is deleted.

## The 8 rows (before → after)

All rows: active, `units_per_purchase_unit` 1, case columns empty today. The case is counted in purchase units.

| Step | Supplier row | Purchase unit | Case: now → after | `order_note`: now → after |
|---|---|---|---|---|
| 4.1 | SP_BUKAT_P006 Pomidor | kg | ∅ → **skrzynka × 6** | ∅ (unchanged) |
| 4.1 | SP_BUKAT_P016 Cebula czerwona | kg | ∅ → **worek × 5** | „worek 5 kg” → ∅ |
| 4.2 | SP_BUKAT_P018 Cebula Biała | kg | ∅ → **worek × 5** (only if 4.2 runs) | „worek 5 kg” → ∅ (only if 4.2 runs) |
| 4.3 | SP_INTERMLECZ_P021 Frytki Aviko | paczka | ∅ → **karton × 4** | „1 paczka = 2,5 kg; karton = 4 paczki” → „1 szt = 1 paczka 2,5 kg” |
| 4.3 | SP_INTERMLECZ_P015 Halloumi Reha | szt | ∅ → **karton × 12** | „opak. zbiorcze 12 szt” → ∅ |
| 4.4 | SP_MORY_P129 Rolki 80/80 | szt | ∅ → **opak × 6** | ∅ (unchanged) |
| 4.4 | SP_MORY_P183 Rolki 80/20 | szt | ∅ → **opak × 6** | ∅ (unchanged) |
| 4.5 | SP_BLUESERV_P121 Gąbka do naczyń | szt | ∅ → **opak × 10** | „opak. zbiorcze 10 szt” → ∅ |

- 4.5 also renames P121 on screens: „Gąbka do naczyń” → **„Gąbka do naczyń 10szt”** (moved here from Phase 1). The
  supplier name in the e-mail stays „Gąbka do naczyń”.
- Inactive sibling rows (Selgros, Kuchnie Świata, Pago P129) get no case.
- **Notes.** The card now prints the case itself („1 worek = 5 kg”, „1 karton = 12 szt”), so a note that only repeated
  it is cleared. „opak. zbiorcze” would also contradict „karton”. Frytki keep the bag weight. The note also bridges two
  units: the stock field counts frytki in **szt** (the product's inventory unit) and the order field in **paczki**.
- **E-mail wording** (checked on the dry-run copy with the backend code): „6 kartonów + 2 paczki (26 paczek)”,
  „5 skrzynek + 0,5 kg (30,5 kg)”, „4 kartony (48 szt)”, „3 opak + 2 szt (20 szt)”. An order under one case prints
  only the base unit, for example „0,5 kg”.

## Rows where the case suggestion is always 0 (plan-review F5)

The suggestion is the need rounded to the nearest whole case. When the target is under half a case, the suggestion
is always 0. Ordering what is missing (for example 0,5 kg) needs no reason. Ordering one whole case always asks for
a reason. The uncounted path allows one case, because max is rounded up to a whole case.

| Product | Location | min / target / max | Case (half) | Engine check |
|---|---|---|---|---|
| Cebula biała P018 | WOLA | 0,5 / 1 / 1 kg | worek 5 kg (2,5) | need 0,5 → 0 worków; 1 worek = +900 %, reason |
| | BRACKA | 0,2 / 0,5 / 0,5 kg | | always 0 |
| | KEN | 0,1 / 1 / 1 kg | | always 0 |
| | BROWARY | 0,3 / 1 / 1 kg | | always 0 |
| | NORBLIN | 0,2 / 1 / 1 kg | | always 0 |
| | ELEKTROWNIA | 0,2 / 1 / 1 kg | | always 0 |
| | WESTFIELD | 0,2 / 1 / 1 kg | | always 0 |
| Rolki 80/80 P129 | BRACKA | 1 / 2 / 2 szt | opak 6 (3) | need 2 → 0; 1 opak = +200 %, reason |
| Rolki 80/20 P183 | BRACKA | 1 / 4 / 4 szt | opak 6 (3) | not always 0: stock ≤ 1 → 1 opak; stock 2 → 0, 1 opak = +200 %. Max is under one pack. |

Every other active row has a target of at least half a case. The lowest is gąbka P121 at BRACKA: target 10 = 1 opak.

**Cebula biała — recommendation: skip 4.2 (no case).**
- Every order since July was loose: 11 sent lines, all 0,5 or 1 kg (WOLA 7, BROWARY 2, BRACKA 1, NORBLIN 1).
- The KEN invoice F/0071174/2026 (17.08) bills „Cebula (waga)” 1,1 kg. Red onion is billed in 5 kg (5,6 once), so the
  bag fits P016, not P018.
- With `keep`, every P018 card shows `[worki] + [kg]` and „→ 0,5 kg ≈ 0 worków”. That is noise for a product whose max
  is 1 kg. Loose orders still need no reason.
- `raise` means 5 kg of white onion in stock everywhere (5 to 10 times today's max). Not recommended.
- If 4.2 is skipped, the note „worek 5 kg” stays on P018 as today.

**BRACKA rolls.** BRACKA has not ordered P129 or P183 since July. Its thresholds were provisional copies („baza: kopia
WOLA”, „ESTIM: kopia z BRACKA__P128”).
- Keep them if Mory can hand out single rolls (it is your own warehouse).
- Raise them to target = max = 6 if Mory issues only whole packs. Then one pack needs no reason: with stock 3, need 3
  rounds to 1 opak.

## Critical products with a case (impl-review F5)

Pomidor P006, cebula czerwona P016, halloumi P015 and frytki P021 are critical at product level, so at all 7 locations.
When the need is under half a case, the suggestion is 0:

| Product | Suggestion 0 while the need is under | Example (engine) |
|---|---|---|
| Pomidor | 3 kg | WOLA 40 / 42 kg: need 2 → 0. Order 0: no reason (today: critical reason). Order 6: +200 %, reason. |
| Cebula czerwona | 2,5 kg | KEN 8 / 10 kg: need 2 → 0. Order 0: no reason. Order 5: +150 %, reason. |
| Halloumi | 6 szt | KEN 55 / 60: need 5 → 0. Order 0: no reason. Order 12: +140 %, reason. |
| Frytki | 2 paczki | KEN 19 / 20: need 1 → 0. Order 0: no reason. |

This is D34 as designed: any order between 0 and the need is free. The change from today is that ordering nothing on
a critical product with a small shortfall no longer asks for a reason.

## Open orders on these products (information only)

A case changes how a quantity is worded, never the quantity, so no block waits for the queue.

- `manager_claimed` `ORD-20261001-ELE-MORY-c48d59`: P129 6 → copy list „1 opak (6 szt)”, P183 20 → „3 opak + 2 szt
  (20 szt)”.
- `manager_claimed` `ORD-20261001-WOL-INTE-1851ca`: P021 42 → e-mail „10 kartonów + 2 paczki (42 paczki)”. Its
  „Zamówił” is „TEST TEST TEST”. If it was a test, cancel it, so a dispatch never sends a real Intermlecz order.
- 30 `manager_sent` orders (57 lines, none with a receipt) carry these products. Only the wording of a later
  post-send edit or resend changes.
- No `captain_submitted` order has these products.

## Observations (no action in this batch)

- **Frytki szt vs paczka.** The stock field reads `[kartony] + [szt]`, the order field `[kartony] + [paczki]`. Staff
  message part 2 says „luzem: paczki”. Changing the inventory unit to `paczka` would print undeclined „44 paczka” in
  the thresholds, so the note bridges it instead. Suggest the staff message says „luzem: paczki (przy stanie: szt)”.
- **Thresholds that are not whole cases** read as fractions in the card header, for example „Cel: 8,3 kartonu
  (100 szt)”: halloumi NORBLIN 100 and WESTFIELD 80, frytki BRACKA 34, gąbka WOLA and BROWARY 12, KEN 24. The suggestion
  still rounds to whole cases. Round them later if wanted.
- **Other roll sizes** (57/20 P128, 57/30 P130, 57/80 P184) get no case. D23 lists only 80/80 and 80/20.
- **Gąbka price.** The P121 supplier-row notes say „cena 0,6 byla za opak”, while 0,60 is now stored per szt. If 0,60
  is the price of a pack of 10, Blue Service totals are overstated for this line. Worth checking against an invoice.

## Summary (row counts)

| Step | What | Rows |
|---|---|---|
| 4.1 | Pomidor skrzynka 6; cebula czerwona worek 5 (note cleared) | 2 supplier rows |
| 4.2 | **Separable.** Cebula biała worek 5 (note cleared); `raise` adds 7 threshold rows | 1 (+7) |
| 4.3 | Frytki karton 4 (new note); halloumi karton 12 (note cleared) | 2 supplier rows |
| 4.4 | Rolls 80/80 and 80/20 opak 6; `raise` adds 2 BRACKA threshold rows | 2 (+2) |
| 4.5 | Gąbka opak 10 (note cleared) + screen name „Gąbka do naczyń 10szt” | 1 supplier row, 1 product |

## Dry run (local Postgres 16, 2026-10-02)

- **Schema:** built from `supply-os-v1/migrations/0001…0028`. Column lists of the 8 touched tables match prod.
- **Data:** all 13 locations, 7 suppliers, the 8 products, their 14 supplier rows, their 91 threshold rows and the two
  claimed orders with their 3 lines.
- **Fidelity:** checksums of products, supplier rows (incl. notes) and threshold rows (incl. notes) equal prod's.
- **Run 1** (defaults: 4.2 `keep`, 4.4 `keep`): 5 blocks applied; audit 10 of 10 ok.
- **Run 2:** all 5 blocks raised on their guards; the state was unchanged.
- **STEP R:** restored products, supplier_products and location_product_settings byte-identical to the template.
- **Variants:**
  - 4.2 skipped: 4 applied; audit 10 of 10; run 2 raised all 4; STEP R byte-identical.
  - 4.2 `raise` + 4.4 `raise`: 5 applied; audit 10 of 10; run 2 raised all 5; STEP R byte-identical.
  - An invalid choice value raises in 4.2 and 4.4 with nothing written.
- **Drift:** with P016's note edited, 4.1 raised and P006 got no case either. With BRACKA P129 edited, 4.4 `raise`
  raised and the roll cases were rolled back too.
- **Code check:** the backend read the applied copy through `_choose_backend()`:
  - the orderable items and the inventory grid carry the cases;
  - the e-mail wording is as quoted above.
