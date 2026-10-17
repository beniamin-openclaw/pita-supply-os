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

The arithmetic is correct on both sides: `combinePackStock` = packs × upp + loose, the submit path stores `captain_final_qty_purchase` as received, and `order_qty.py` / `orderQty.ts` only pick Captain vs Manager final. There is no code path that multiplies twice. The doubling is a UX failure: staff used to typing the quantity in szt/paczki typed it into the loose field AND filled the new cases field with the same amount. The backend never sees the pair, so it cannot detect it.

## What changed

- `frontend/src/lib/packStock.ts`: `detectDoubleEntry({packs, loose, upp})` — `duplicate` when packs > 0 and loose = packs × upp (carries the corrected quantity), `looseOverPack` when loose ≥ one pack next to packs, else null.
- `PackStockInput.tsx` (shared by the Captain stock field, the bulk-pack order field and the inventory count grid): an amber prompt while typing — "Razem 48 szt. Czy 24 szt to te same 2 kartony?" with "Tak, tylko 24 szt" (drops the loose part) and "Nie, razem 48 szt" (dismisses for that exact pair). Loose over a carton gets a warning line without a fix. Never blocks submit; untouched / restored values never prompt.
- i18n: `packEntry.*` (pl + en).

## Tests

- Vitest: `packStock.test.ts` (`detectDoubleEntry`, including the four prod pairs), `ProductCard.test.tsx` N1 block (repro: 2 kartony + 24 szt emits 48; fix to 24; stock field; "Nie"; real remainder; restored draft).
- pytest: `test_captain_submit.py` — a case line is stored once (36 kg stays 36), and the e-mail wording of the Browary halloumi line (24 → "2 kartony (24 szt)", 48 → "4 kartony (48 szt)").

## Not covered

- The submit confirm dialog does not list doubled lines: the line state keeps only the combined value, so a doubled 48 cannot be told apart from 4 real cartons after the fact. The prompt shows while typing for that reason.

## Rollback

Revert the PR. No migration, no prod data written.
