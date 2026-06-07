---
change_id: inventory-category-sections
title: Inventory count — collapsible category sections on the Captain screen
status: implementing
created: 2026-06-07
updated: 2026-06-07
archived_at: null
---

## Notes

Chip `task_d7530159` (Captain-side, deliberately kept separate from the Manager work). The location-wide inventory-count screen (`InventoryCountPage.tsx`, FR-015) lists every configured product in one flat list; with many SKUs it's hard to scan and count. Group the rows by `product_category` into collapsible sections the Captain can expand/collapse.

- Backend: add `product_category` to the `InventoryProduct` response model and populate it in `captain_inventory_products` (the field already exists on `Product`).
- Frontend: group products by category, render each as a collapsible `<section>` with a per-section counted/total counter; per-section collapse toggle (default expanded).

No change to the count/snapshot data model, the submit flow, or which products are listed. Autonomous run — self-decided, verified via pytest + tsc/eslint/build.
