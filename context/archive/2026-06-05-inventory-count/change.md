---
change_id: inventory-count
title: Captain location inventory count → dated snapshot
status: archived
created: 2026-06-05
updated: 2026-06-05
archived_at: 2026-06-05T12:12:03Z
---

## Notes

Roadmap slice **S-06** (Stream C — Location inventory; `ready`). Parallel early track, independent of the Bukat pilot / north star (S-02).

- **PRD refs (v2):** FR-015 (location-wide inventory screen, one-pass stock entry), FR-016 (approve → dated snapshot with timestamp + actor, snapshots retained), US-02. The opt-in pre-fill into ordering is **FR-017 = separate slice S-07**, not this change.
- **Scope — Phase 1, must-have:** count all Wola products (those with a `location_product_setting`) in one pass → approve → persist a dated snapshot. **Phase 2 / should-have, NOT here:** Manager inventory view + history/trends (FR-018/019 = S-08).
- **Reuse target:** mirror the `orders` / `order_lines` pattern behind the `_choose_backend()` seam — two new entities (`inventory_counts` + `inventory_count_lines`); suggestion engine + dispatch untouched.
- **Guardrails (lessons.md):** never bypass `_choose_backend()`; never commit secrets. NFR: no entered count lost mid-pass.

**Closeout (2026-06-05):** 3 phases implemented + committed (`ce34e51`, `ac7144b`, `5cebc66`). Sheet tabs `inventory_counts` / `inventory_count_lines` created in the live sheet; headers verified column-for-column via the Drive connector. Frontend verified live in seed mode (3.2/3.4/3.5/3.6 ✅); endpoints verified live (products → 52 WOLA, submit → `count_id`). **Sheet-mode smoke ✅ (Progress 2.4 + 3.3):** a real submit in `sheet` mode produced `count_id INV-20260605-WOL-07e2b9` with 2 lines landing in the live `inventory_counts` / `inventory_count_lines` tabs (test row tagged "SHEET-SMOKE TEST — delete-ok"; append-only, no delete endpoint). All Progress items complete.

**Impl-review (2026-06-05):** `/10x-impl-review` → APPROVED (0 critical, 1 warning, 5 observations); see `reviews/impl-review.md`. F1 (test order-dependence) accepted as a recurring rule in `lessons.md`; F2–F6 accepted as-is.
