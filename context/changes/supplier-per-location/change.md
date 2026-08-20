---
change_id: supplier-per-location
title: Supplier dimension at the location level — one product, many suppliers, per-location choice
status: impl_reviewed
created: 2026-08-20
updated: 2026-08-20
archived_at: null
---

## Notes

**Track B**, split out of Tushar's request (2026-08-20) — see
[[wolska-blueservice-master-data]] for track A (purely additive data, no model change).

### Problem

The model assumes a product has **one supplier, everywhere, forever**. Visibility on
the order screen is `supplier_products` (global) ∩ `location_product_settings`
(per location) — there is nowhere to express "Wolska buys pens from Blue Service,
Bracka buys them from Pago".

Prod state (2026-08-20): 145 products, 145 `supplier_products` rows, **zero products
with two suppliers, zero without** — the 1:1 rule holds in practice even though the
schema permits many.

### Three symptoms, one cause

1. **Office items at Wolska** — staples (P127), markers (P132), pens (P133) should
   come from Blue Service, but Bracka and Norblin have real thresholds for them at
   Pago (1/10, 1/3, 1/3). A global re-point would hit them.
2. **Substitutes** — fries come sometimes from Selgros, sometimes from Kuchnie Świata,
   mostly from Intermlecz. Not expressible today. **Selgros is not in `suppliers` at all.**
3. **Different cities, different suppliers** — the problem multiplies as we expand
   beyond Warsaw.

### Operator decisions (2026-08-20)

- **The dimension hangs on the LOCATION, not the city.** Two locations in the same
  city can have different suppliers for the same product — confirmed explicitly by
  the operator. This closes the "per city" option despite `locations.city` existing.
- The operator will flag further substitute products as they come up; the agent should
  keep its eyes open and append them here.

### Starting hypothesis (to be challenged in `/10x-shape`, NOT a decision)

A nullable column on the location row (`location_product_settings`) stating not only
*how much* but also *from whom*:
- `NULL` → show the product under **every** supplier that carries it (handles substitutes)
- `SUP_BLUESERV` → show it **only** under Blue Service (handles pens at Wolska)
- default NULL → today's behavior, so the change is backwards compatible

Alternative: a separate `location_supplier_products` table (cleaner model,
~580 rows to maintain by hand).

### Bug to fix alongside track B

`supplier_products.active` exists in the database and in the model, but **no code
reads it** — `_build_orderable_items` (`supply-os-v1/app/main.py:346`) checks only
`supplier_id` and threshold presence. The only `.active` use in all of `app/` is
`main.py:1980` (`product.active` on the inventory screen). Consequence: setting
`active=FALSE` on `supplier_products` **does nothing**. Without this fix,
"disable a supplier for a location" would have a hole.

### Known side cost

`test_captain_orderable_wola_pago_returns_18_items`
(`supply-os-v1/tests/test_main.py:119`) asserts exactly 18 items for WOLA×Pago and
explicitly requires P127, P132, P133 to be present. Track B will change it (→ 15).

### Shape outcome (2026-08-20)

`/10x-shape` complete — see `context/foundation/shape-notes.md`,
`## Change: Supplier dimension per location`. Six FRs drafted (FR-025…FR-030), each
with a Socrates round. Decisions taken:

- **Storage: a nullable `source_supplier_id` column on `location_product_settings`**,
  not a `location_supplier_products` table. `NULL` = every supplier carrying the
  product; a value = only that supplier. Narrowing only — `supplier_products` stays
  the universe. Rationale + reversal path in the FR-025 Socrates note.
- **Substitutes**: the operator confirmed a Captain picks one source per day and never
  splits one need across suppliers, so a same-day duplicate is an error state —
  mitigated by an informational badge (FR-028), not a hard block.
- **Thresholds stay supplier-agnostic** (the existing `UNIQUE (location_id,
  product_id)` is correct and preserved).
- **`supplier_products.active` enforcement is in this lane** (FR-029).
- **Supplier-picker location-awareness is out of this lane** — pre-existing
  (`CaptainMP.tsx:98` lists every active supplier globally), not regressed here.

Also corrected against prod: **154** products / **154** `supplier_products` rows after
track A shipped (the 145 recorded above was the pre-track-A count).

### Workflow record (2026-08-20)

Full lane run in one session: shape -> prd (delta, v3) -> research -> plan ->
plan-review -> implement -> impl-review -> verify. Research and both review passes
were run inline rather than fanned out to sub-agents (session configuration).

- `research.md` — found the blocking fact: P127/P132/P133 exist only at Pago, so
  the headline scenario needs Blue Service catalog entries BEFORE any pin.
- `reviews/plan-review.md` — 1 CRITICAL: the plan named the read path as "the
  single chokepoint", but the write path (`_resolve_master_data`) is a separate
  function and would have accepted a pinned-away line from a stale local-storage
  draft. Fixed before implementation.
- `reviews/impl-review.md` — APPROVED; the one warning (pin landing on an
  in-flight order) became a precondition in the Phase 4 runbook.

Code phases 1-3: **PR #26**, branch `claude/supplier-per-location`. Green on all
four gates (453 pytest, ruff, build, lint, 89 vitest). Provably a no-op against
current prod data.

### Next step

**Blocked on the operator.** `prod-sql.sql` is authored and unapplied:

1. Blue Service purchase unit + price for P127/P132/P133 (their cennik).
2. Whether to pin P132/P133 at WOLA at all, given their targets are 0 today.
3. Migration 0008 applied to prod Supabase with the PR #26 deploy.

Phase 5 (fries substitutes) stays deferred behind PRD Open Questions 5 and 6 —
the third source is not in `suppliers`, and no per-location pass has been made.
