# Captain kg reading — Plan Brief

> Full plan: `context/changes/captain-kg-reading/plan.md`

## What & Why

Kraków asked to count halloumi in kg. Ben (17.10, porzadek-2026-10 item 4.14): ordered halloumi
stays in pieces (200 g each); after the count is typed the Captain sees how many kg that is,
"12 szt (2,4 kg)". Cut halloumi (P192) is already counted in kg. One inventory unit per product
(D8/W49) stays.

## Starting Point

`lib/gramsHint.ts` already reads a per-piece weight from a product name for the "did you mean
0,5 szt?" prompt. Stock is typed in the count grid and on the order card, either in one field
(×1) or in `PackStockInput` (case + loose; halloumi is karton = 12 in prod).

## Desired End State

Piece-counted products (szt/słoik/opak) whose name carries one readable weight show a read-only
kg reading once a count > 0 is typed: "(2,4 kg)" under the grid field, "szt (2,4 kg)" in the order
card caption, "= 1 karton (12 szt · 2,4 kg)" in the pack reading. Stored value unchanged.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Which units | szt / słoik / opak (the existing piece list) | kg products excluded; other units have no per-piece meaning |
| Multipack names (`25g/30`, `12x200g`, `4,2kg/2,5kg`) | no reading | first weight is not one inventory unit's weight — "only when the per-piece weight can be read" |
| Names on pack rows of the order card | `product_name_pl` only | supplier name of a case product tends to describe the pack |
| Zero / empty count | no reading | "(0 kg)" is noise |
| Bulk-pack order input | unchanged | scope is the stock count |
| Copy | i18n keys `stock.kgReading`, `stock.readingKg`, `stock.readingBaseKg` | frontend rule |

## Scope

**In scope:** pure helpers + tests, count grid, order card stock field, `PackStockInput` stock reading.

**Out of scope:** backend, API, prod data/renames, Manager screens, e-mail, order input.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Helpers | `isPieceUnit`, `pieceGramsFromNames`, `formatPiecesAsKg` + tests | multipack regex too wide/narrow |
| 2. UI | reading on grid, order card, pack input + component tests | layout jump / wrap at 375 px |

**Prerequisites:** none. **Effort:** one short session.

## Open Risks & Assumptions

- Prod P015 is "Halloumi Reha 200gr" since 02.10 (feedback-1001 prod-sql-1.sql:139); seed still
  says plain "Halloumi". About 15 other piece products with a weight in the name also get a reading.
- Name weight is nominal; the reading is a convenience, not a weighed value.

## Success Criteria (Summary)

- Halloumi count of 12 shows 2,4 kg on the count and order screens; nothing changes in what is saved.
