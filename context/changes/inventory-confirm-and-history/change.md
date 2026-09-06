---
change_id: inventory-confirm-and-history
title: Inventory confirmation screen, history segment, gyros split + Corfu Pilsner master data
status: implemented
created: 2026-09-06
updated: 2026-09-06
archived_at: null
---

## Notes

Captain: ekran potwierdzenia po wysłaniu remanentu (zamiast toasta) + segment Zamówienia/Remanenty na stronie Historia; plus master data: gyros split (wieprzowy/kurczak × ścięty/nieścięty, kurczak tylko KEN) i Corfu Pilsner na WOLA/BRACKA/KEN.

Operator feedback 2026-09-06: "Po wysłaniu remanentu nie widać komunikatu, że wysłano" / "Historia remanentów jest niewidoczna" / "minimalistycznie i elegancko". Proposals 1 (confirmation card) + 2 (Zamówienia/Remanenty segment) accepted; proposal 3 (same card for orders) explicitly out of scope.

Master data lineage: the gyros split and Corfu Pilsner fix were written as `prod-sql-phase3.sql` in training-feedback-0901 (archived 2026-09-04) and NEVER RUN on prod. Verified 2026-09-06 on prod: only P037 "Gyros (ścięty + nieścięty)" exists (no P176–P179, no chicken); SP_FILBER_P157 Corfu Pilsner is `active=false`, `szt`/1, thresholds only at STARY_BROWAR (0/0/0).

## Post-implementation review — 2026-09-06 (Fable, reviewer; Sonnet implemented A+B)

Scope check against plan.md: Tracks A, B, C all delivered; nothing added beyond scope.

**Findings and what was done**
- **R1 (fixed) — confirmation card date.** The card formatted `count_date` ("YYYY-MM-DD") with the
  default date+time formatter, which would have rendered "6.09.2026, 02:00" (UTC midnight shifted
  to Warsaw). Changed to the submit instant (`Date.now()` captured on success), matching the row
  the snapshot gets in history (`count_submitted_at`). Test pins "6.09.2026, 14:34" for a UTC
  12:34 input.
- **R2 (verified safe) — draft autosave vs. card.** The 500 ms autosave effect depends on
  `[lines, countDate]`; after submit `clearDraft` runs and neither dependency changes, so no
  stale draft is re-written while the card is shown. "Nowy remanent" resets to blank lines,
  which the `hasEntry` guard never persists.
- **R3 (accepted) — CaptainTabs contract change.** `/captain-v2/inventory-history` now lights the
  Historia tab, not Remanent. The edit sub-route `/inventory-history/:id/edit` follows (prefix
  match), which is right: editing a past count is history work.
- **R4 (accepted) — two i18n keys removed** (`inventory.successToast`, `inventory.history.back`),
  both verified unreferenced; `pluralKeys.test.ts` green.
- **R5 (noted) — Track C live check was SQL-only.** No prod captain token is available on this
  machine, so `/api/captain/orderable` itself was not called; the SQL re-runs the exact
  predicates of `_build_orderable_items` (sp.active ∧ product.active ∧ lps at location).
  Operator's phone check after deploy stands in for it.
- **R6 (deviation from "wszystko naraz") — Allegro / Selgros left inactive.** Neither has an active
  catalogue row (Allegro 0, Selgros 39 all inactive) and the Captain picker lists every active
  supplier globally, so activating them adds only an empty tab at every location. Allegro's own
  notes say the same. Activate together with first catalogue rows.
- **R7 (noted) — Spec Food tab is visible at every location** (same global-picker behaviour);
  outside KEN it shows the existing "no products" empty state. Pre-existing behaviour for every
  single-location supplier; not changed here.

Verification: frontend 22 files / 332 tests, build, lint clean; backend 643 passed, ruff clean.
Prod SQL applied 2026-09-06, 7 audit rules = 0 rows.
