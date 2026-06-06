---
change_id: subkg-rounding-rule
title: Engine sub-kg (0.1 kg) rounding rule for weight-based SKUs
status: archived
created: 2026-06-05
updated: 2026-06-06
archived_at: 2026-06-06T10:54:36Z
---

## Notes

Roadmap slice **S-09** — spun out of **F-01** (`bukat-master-data-ready`) during the master-data audit. Not yet listed as a slice in `roadmap.md` (only referenced in the Done section's F-01 lesson); add an S-09 row when planning.

**Problem:** `RoundingRule` (`supply-os-v1/app/models.py` + the engine in `supply-os-v1/app/suggestion.py`) has no sub-unit granularity for weight-based (kg) goods. Weight products ceil to whole kg, which is wrong for the domain — the engine can't suggest 0.7 / 1.5 kg, and a sub-kg target on a whole-unit SKU trips a **cosmetic over-max warning** (P009 Natka, P010 Czosnek at Wola×Bukat). The suggestion stays *safe* (non-blocking); the warning is noise.

**Direction (not yet planned):** add a sub-kg (0.1 kg) rounding rule in `suggestion.py` + a way to assign it (a `rounding_rule` column on `supplier_products` — currently absent — or a kg-default) + tests across both backends. This is a **code change, not a data hack** — the F-01 audit deliberately parked it rather than masking it via master data. Visible suggestion math is a Tier-1 contract; engine output must stay explainable.

**Source:** `context/archive/2026-06-05-bukat-master-data-ready/audit.md` → "Spun-out engine improvement → NEW SLICE" + "Residual" (≈ lines 109, 148). Recommended flow (per the audit): `/10x-research → /10x-plan → /10x-implement → /10x-impl-review`.
