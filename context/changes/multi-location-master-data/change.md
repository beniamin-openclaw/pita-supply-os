---
change_id: multi-location-master-data
title: Per-location master data for every location, generated from inventory sheets
status: new
created: 2026-08-21
updated: 2026-08-21
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
