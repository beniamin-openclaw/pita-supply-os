# Feedback 2026-10-01 — names, units, bulk packs — Plan Brief

> Full plan: `context/changes/feedback-1001-names-units/plan.md`
> Decision record (D1–D30, Q1–Q13): `context/changes/feedback-1001-names-units/plan-draft.md`

## What & Why

Staff at Elektrownia and Norblin read generic product names and wrong units, and they were tripped by these
master-data problems:

- olives target 0,8 opak;
- gyros in "blok";
- an uncut-gyros row;
- tomatoes bought in 6 kg crates.

The operator also wants:

- units that are easy to read;
- a bulk reason that keeps applying to lines added later;
- products bought in cartons, crates or bags to be counted and ordered that way, while invoices, receipts and
  history stay in the invoice unit.

## Starting Point

Names and thresholds are master data on prod (Supabase), not code. The app knows only one pack level
(`units_per_purchase_unit`). Every D23 product has it set to 1, so there is no carton level at all. Units render as
small grey text, and "Powód zbiorczo" is one-shot.

## Desired End State

- Prod names follow the invoices or Marek's sheet, and the thresholds and units match the operator's decisions.
- Captain screens show units in bold.
- Pomidory, cebula, frytki, halloumi, rolls and gąbka:
  - are entered as `[karton/skrzynka/worek] + [luz]`;
  - get a suggestion in whole packs;
  - need no reason when the Captain orders either the raw need or the pack suggestion;
  - print in the supplier e-mail as "6 kartonów + 2 paczki (26 paczek)".

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Bulk-pack model | Optional `case_unit` + `units_per_case` on supplier_products (migration 0028) | History, receipts and finance stay in the invoice unit; no new rows | Draft D22 |
| Products with a case | Pomidory 6 kg, cebula czerwona + biała 5 kg, frytki 4, halloumi 12, rolls 6, gąbka 10 | 90-day orders are almost always whole packs | Draft D23 + Plan D32 |
| Case rounding | Nearest whole pack, half up (`floor(x+0.5)` both sides) | Operator choice, avoids surplus on small gaps | Plan D33 |
| Reason gates | No reason for the need or the case suggestion | No sensible Captain choice needs a reason | Plan D34 |
| E-mail format | "6 kartonów + 2 paczki (26 paczek)" | Supplier sees pack and total | Plan D35 |
| Manager input | One field in the invoice unit + read-only case hint | Matches what is invoiced | Plan D36 |
| Browary Cola | Glass, same thresholds | Browary serves glass | Plan D31 |
| Migration number | 0028 | 0026/0027 taken by PRs #43/#44 | Plan |

## Scope

**In scope:**

- the prod data batch (names N1, oliwki, liść, gyros, miód, cukier, frytki unit, rolls, Coca-Cola and Cappy glass,
  papryka, Prymat spices);
- the readability PR;
- the bulk-pack PR plus its data;
- WESTFIELD DW;
- the checklist;
- the staff message;
- the 0/0/0 cleanup once the operator has ticked the list.

**Out of scope:**

- cases on Transport/Pago documents;
- Tzatzyki and other partial-pack products;
- persisting the raw need;
- invoice-only name batch N2;
- Transport `From:`.

## Architecture / Approach

Data first (no code, separately gated), then one PR with two commit groups (readability, bulk packs).

The bulk-pack PR threads two nullable columns through the seam and the five API builders. It extends the
suggestion engine and its frontend twin with a case step and a two-reference gate. It reuses the existing two-field
`PackStockInput` for stock and order, and adds a twin `formatCaseQty` / `_format_case_qty` pinned by the golden
e-mail fixtures.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Prod data batch | Names, thresholds, units, glass/PET | Deletes under open orders; guarded per location |
| 1b. Spice/papryka units | Per-jar counting, Helcom row | Old counts re-read; full-count day |
| 2. PR readability | Bold units; sticky bulk reason | Text tests splitting into spans |
| 3. PR bulk packs | Migration 0028, engine + parity, inputs, e-mail | Engine/frontend drift; gate regressions |
| 4. Bulk-pack data | Cases on 8 supplier products | Must follow 0028 + live code |
| 5. Leftovers | WESTFIELD DW, checklist, staff message | — |
| 6. 0/0/0 cleanup | Ticked rows removed | Waits on operator list |

**Prerequisites:** Supabase connector (read now; writes only after approval in chat); CI green on `main`.
**Estimated effort:** about 2–3 sessions.

## Open Risks & Assumptions

- Spices and papryka (Phase 1b) change what stored counts mean.
  - Thresholds are already in packs at 5 locations; only BROWARY is converted, and KEN is decided in the diff.
  - Applied on a full-count day with the staff message.
- Cappy glass maxima that do not round cleanly are listed for the operator.
- Gyros nieścięty is switched off only after the staff message is sent.

## Success Criteria (Summary)

- A Captain at any location reads invoice-like names and bold units, and orders tomatoes in crates without being
  asked for a reason.
- The supplier e-mail shows packs and totals.
- Every prod change has a saved diff and audit.
