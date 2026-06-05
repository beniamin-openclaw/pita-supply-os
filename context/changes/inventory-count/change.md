---
change_id: inventory-count
title: Captain location inventory count → dated snapshot
status: implementing
created: 2026-06-05
updated: 2026-06-05
archived_at: null
---

## Notes

Roadmap slice **S-06** (Stream C — Location inventory; `ready`). Parallel early track, independent of the Bukat pilot / north star (S-02).

- **PRD refs (v2):** FR-015 (location-wide inventory screen, one-pass stock entry), FR-016 (approve → dated snapshot with timestamp + actor, snapshots retained), US-02. The opt-in pre-fill into ordering is **FR-017 = separate slice S-07**, not this change.
- **Scope — Phase 1, must-have:** count all Wola products (those with a `location_product_setting`) in one pass → approve → persist a dated snapshot. **Phase 2 / should-have, NOT here:** Manager inventory view + history/trends (FR-018/019 = S-08).
- **Reuse target:** mirror the `orders` / `order_lines` pattern behind the `_choose_backend()` seam — two new entities (`inventory_counts` + `inventory_count_lines`); suggestion engine + dispatch untouched.
- **Guardrails (lessons.md):** never bypass `_choose_backend()`; never commit secrets. NFR: no entered count lost mid-pass.
