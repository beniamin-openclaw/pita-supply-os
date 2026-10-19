---
change_id: captain-case-double-entry
title: Captain [cases] + [loose] input — catch the same quantity typed into both fields (N1)
status: implemented
created: 2026-10-17
updated: 2026-10-17
---

## Trigger

Marek, Connecteam 02.10 19:08 (B46, Lane C item N1): "Beniu też coś namieszałeś, z tymi kartonami i sztukami. Dubluje zamówienie, daje X2" — Browary, Intermlecz. The bulk-pack inputs ("pełne opakowania + luzem", PR #53) had gone live that morning.

## Diagnosis (prod, read-only SELECT, 2026-10-17)

`ORD-20261002-BRO-INTE-b0cd66` (submitted 02.10 13:10 UTC, sent 17:00 UTC), the two lines with a bulk pack:

| product | case | stock stored | captain final | manager final |
|---|---|---|---|---|
| P015 halloumi (szt) | karton = 12 | 96 | 48 | 24 |
| P021 frytki (paczka) | karton = 4 | 32 | 40 | 20 |

Every other line of the order (no case) is unchanged by the manager. The manager halved exactly the case lines. Each stored number equals "N cases + the same quantity in loose units": 2 kartony + 24 szt = 48, 5 kartonów + 20 paczek = 40, and for stock 4 kartony + 48 szt = 96, 4 kartony + 16 paczek = 32.

The same pattern on other case lines that week (manager final ≠ captain final): Browary Bukat pomidor 72 → 36 (stock 0, suggestion 36 = 6 skrzynek; 6 skrzynek + 36 kg = 72), Bracka Intermlecz frytki 24 → 12 (3 kartony + 12 paczek). Orders after 05.10 at Browary are normal (halloumi 24, frytki 20).

The arithmetic is correct on both sides: `combinePackStock` = packs × upp + loose, the submit path stores `captain_final_qty_purchase` as received, and `order_qty.py` / `orderQty.ts` only pick Captain vs Manager final. There is no code path that multiplies twice. The doubling is a UX failure, by one of two paths that leave the same numbers:

1. Staff used to typing the quantity in szt/paczki typed it into the loose field AND filled the new cases field with the same amount.
2. Staff tapped the suggestion tile (which sets N whole cases, the input shows "N + 0") and then typed their own total into the loose field out of habit. The Bukat pomidor line (stock 0, suggestion 36 = 6 skrzynek, stored 72) fits this path as well as path 1.

The backend never sees the pair, so it cannot detect it.

## What changed

- `frontend/src/lib/packStock.ts`: `detectDoubleEntry({packs, loose, upp, mode, references})`.
  - Order: `duplicate` when packs > 0 and loose = packs × upp (carries the corrected quantity); `looseOverPack` when loose ≥ one pack next to packs (path 2).
  - Stock: "2 zgrzewki + 12 szt" is a normal fridge count, so `looseOverPack` never fires and `duplicate` only when the sum is above every reference (previous count, target): the 02.10 halloumi stock of 96 against a target of 72. No references, no prompt.
- `PackStockInput.tsx` (shared by the Captain stock field, the bulk-pack order field and the inventory count grid): an amber prompt while typing, never blocking submit; untouched / restored values never prompt.
  - Duplicate: "Razem 48 szt. Czy 24 szt i 2 kartony to ta sama ilość?" (no gendered agreement with the case unit) with "Tak, tylko 24 szt" (drops the loose part) and "Nie, razem 48 szt" (dismisses for that exact pair).
  - Loose over a pack (order only): "Razem 54 szt. Czy 30 szt to już cała ilość?" with "Tak, tylko 30 szt" (drops the cases) and "Nie, razem 54 szt".
  - On a stock count "Nie" is the main (first, filled) button: halving a true count over-orders. On an order the fix is the main button.
  - The prompt is in the fields' `aria-describedby` while it shows; after a button the focus returns to the loose field. Button colour amber-700 (white text AA).
- i18n: `packEntry.*` (pl + en).

## Tests

- Vitest:
  - `packStock.test.ts`: `detectDoubleEntry` — prod pairs, one carton, float sizes (3 × 4.2, 0.1 × 60), loose == upp, stock gating by references.
  - `ProductCard.test.tsx` N1 block: repro (2 kartony + 24 szt emits 48, prompt shown while the field has focus, fix to 24, focus back); one carton wording; stock above target asks with "Nie" first; stock under target never asks; real remainder; loose over a carton; tile path (tile 2 kartony + typed 30 → "Tak, tylko 30 szt" → 30); tapping the tile clears an open prompt.
  - `PackStockInput.test.tsx`: aria-describedby, per-pair dismissal, English copy.
- pytest: `test_captain_submit.py` — a case line is stored once (36 kg stays 36), and the e-mail wording of the Browary halloumi line (24 → "2 kartony (24 szt)", 48 → "4 kartony (48 szt)").

## Not covered

- Scope choice: the submit confirm dialog does not list doubled lines. The cards stay mounted while the dialog is open, so the pair could be lifted to `CaptainMP` (a callback feeding a list like `criticalMissing`), but `CaptainMP.tsx` and `ConfirmSubmitDialog` are being changed by WP6 and D6 in parallel. Follow-up candidate if the inline prompt proves easy to skip.
- Blind spots: a draft saved with a doubled 48 and reloaded comes back as "4 kartony + 0" (no pair, no prompt); the same in `OrderEditPage` (reuses `ProductCard`). The inventory count grid passes the previous count and target as references, so it asks only above them.

## Rollback

Revert the PR. No migration, no prod data written.
