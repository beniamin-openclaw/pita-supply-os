---
change_id: multi-location-master-data
title: Per-location master data for every location, generated from inventory sheets
status: implemented
created: 2026-08-21
updated: 2026-08-22
archived_at: null
---

## Notes

Operator instruction (2026-08-21): "szukamy wszystkich i robisz dla każdego lokalu
odpowiednią bazę bazując na inwentaryzacji, dajesz tyle danych ile widać, a braki
uzupełnię po powrocie". Autonomous overnight run (~9h), tracks A + B + C together:

- **A — reconciliation engine**: a reusable parser for the per-location
  "Inwentaryzacja" Google Sheets producing per-location reports (missing products,
  sheet-vs-db supplier conflicts, in-sheet dual suppliers, unit mismatches, typo
  clusters). All 12 sheets are downloaded to `scratchpad/sheets/` (wolska, bracka,
  norblin, ken, stary_browar, browary, elektrownia, slony_spichlerz,
  kulinarna_kamienica, forum, supersam, westfield).
- **B — onboarding**: master data for the NEW locations (Stary Browar, Elektrownia,
  Słony Spichlerz, Kulinarna Kamienica, Forum, Supersam, Westfield) + reconciling the
  existing BROWARY / KAMIENICA / KULINARNA stubs (the latter two likely correspond to
  ONE sheet, "Kulinarna Kamienica"). Locations stay INACTIVE until the operator
  activates. Prod SQL as gated ready-to-run batches (diff-before → apply → audit-after);
  additive+inactive+audited writes may be attempted per the pattern consented
  2026-08-21 (Allegro), but a classifier block downgrades the batch to ready-to-run,
  never retried.
- **C — H-01 hardening** (roadmap, status proposed): backend lockfile, staged TS
  strict, wider ruff, mypy/pyright in CI. Filler after A+B.

Hard limits: never place a real supplier order; no PR merges; every data gap listed
explicitly per location so the operator can fill them on return.

Key evidence going in (2026-08-21): prod has 4 configured locations but only WOLA has
ever ordered (86 orders; BRACKA/NORBLIN/KEN zero). Westfield's sheet shows a different
supplier mix for the same products (Selgros/Kuchnie Świata where Warsaw uses
Bukat/Intermlecz) — the geographic-expansion case supplier-per-location (PR #26) was
built for. Builds on branch `claude/supplier-per-location` (source_supplier_id).

## Decision report — autonomous overnight run (2026-08-21 → 22)

Execution model per the operator's mid-run instruction: this session (Fable 5
high) orchestrated and reviewed; every implementation dispatch ran on an Opus 5
subagent; TDD throughout (453 → 522 tests, each feature test-first); every
implementer claim re-verified independently before acceptance.

### What was decided autonomously, and why

1. **Price list beats stock section** as the per-location catalog of record —
   the numbered, priced block is deliberate; the count section is where people
   type fast. Both still reported; conflicts surfaced (Supersam 23, Forum 20).
2. **Near-misses are never auto-linked; borderline new names are quarantined,
   not minted.** Round-1 batch 01 would have created 46 "new" products
   including six spellings of Rolki do kasy and two of Ręcznik papierowy;
   after the quarantine pass 21 confident products shipped and 25 names in 19
   groups await one human decision each (`prod-sql/01b-quarantined-names.md`).
3. **Onboarding rows land invisible-first**: locations inactive, new suppliers
   (Selgros, Spec Food) inactive, all new catalog pairs `active=FALSE`; pins
   live exclusively in per-location activation batches preconditioned on
   migration 0008 + PR #26. Per-location activation is a single operator-run
   file that also pins the four live locations for every product gaining a
   second carrier.
4. **KAMIENICA + KULINARNA are one location** — onboarded into KAMIENICA
   (renamed "Pita Bros Kulinarna Kamienica"); the KULINARNA stub was left
   untouched for the operator to delete or repurpose.
5. **target = max** wherever the sheet carried min/max (Forum 24 rows applied;
   Norblin's 107-row sheet coverage documented for the live-location
   reconciliation, NOT applied — live thresholds are never edited by this lane).
6. **H-01**: TS strict ON (codebase was already clean — one line);
   requirements.lock proven by full-suite runs on 3.14 AND CI's 3.12 before
   wiring; ruff I/B/UP (B905 caught a real latent zip-misalignment bug in the
   snapshot loader); pyright advisory in CI (60 pre-existing errors, dominated
   by the known seed-loader seam gap).

### Applied to prod (audited, diff-before/after in plan.md)

suppliers 11→13 (active 10→10) · products 154→175 (P155–P175) ·
supplier_products 154→228 (74 new, all inactive) · locations 7→13 (active
4→4) · settings 578→1486 (8 onboarding locations, counts matching the
generator exactly; live locations untouched).

### ⚠ FIRST ACTION FOR THE OPERATOR

Final review caught a sequencing miss: prod's PRE-PR-#26 code ignores
`sp.active`, so **14 of the 74 new pairs are visible today at the four live
locations** (Pago: Tzatzyki/Tirokafteri/Feta · Kuchnie Świata: 7 lines ·
Intermlecz: folie+pergamin · Eurofood: Bombilla). The rollback DELETE was
blocked twice by the session's permission classifier. Either run:

```sql
DELETE FROM supplier_products
 WHERE supplier_product_id IN
 ('SP_EUROFOOD_P135','SP_INTERMLECZ_P095','SP_INTERMLECZ_P096','SP_INTERMLECZ_P097',
  'SP_KUCHNIE_P013','SP_KUCHNIE_P015','SP_KUCHNIE_P017','SP_KUCHNIE_P021',
  'SP_KUCHNIE_P022','SP_KUCHNIE_P038','SP_KUCHNIE_P048',
  'SP_PAGO_P011','SP_PAGO_P012','SP_PAGO_P014')
 AND active = FALSE;
-- expect: DELETE 14; re-apply them from prod-sql/02-... AFTER PR #26 deploys
```

…or merge+deploy PR #26 first, which hides them via the `sp.active` filter and
makes the DELETE unnecessary. Until then: duplicate-visibility only, no
data/order corruption, and only WOLA actively orders.

### Remaining operator gaps (full detail in reports/_summary.md + 01b)

- 25 quarantined names (19 one-line decisions), 6 supplier-conflict clusters
  worth a look (kulinarna 44!), thresholds TBC for 7 of 8 onboarding locations
  (only Forum's sheet carried min/max), city/address/company + captain tokens
  for the 6 new locations, ordering_method for Selgros/Spec Food/Allegro,
  activation timing per location (each has its own 20-<loc>-activation.sql).
