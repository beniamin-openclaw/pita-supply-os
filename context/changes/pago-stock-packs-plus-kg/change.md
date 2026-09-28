---
change_id: pago-stock-packs-plus-kg
title: Stock input as packs plus loose base units for pack-based products
status: implemented
created: 2026-09-28
updated: 2026-09-28
archived_at: null
---

## Notes

Operator decision 2026-09-28 ("bloki + kg"). Evidence (prod): Gyros 15 KG counts at BRACKA were 8 (21.09) and 6 (27.09), at BROWARY 6 (27.09, after 90 on 20.09) — block counts typed into a kg field; WOLA and KEN type kg. GoStock counts gyros/souvlaki/bifteki in kg and pita in pieces.

Keep the stored base unit unchanged (kg / opak) — no backend or payload change expected. Replace the stock input for pack-based products with a two-field input [packs] + [loose base units] that converts both ways and shows the combined reading (20 kg of Gyros 15 KG → "= 1 blok + 5 kg"; 1 blok + 5 kg → stores 20 kg). Generic for every `isPackBased` product; pack size from `units_per_purchase_unit`, nothing hard-coded.

Surfaces: Captain order card stock field (replaces the "wpisz w …" toggle), inventory count grid, inventory count edit page, Captain order edit page. Order quantity stays in purchase units. Thresholds shown in packs too ("min 4 bloki (60 kg)"). Soft, never-blocking plausibility prompt when a base value looks like a pack count ("Czy chodziło o 6 bloków (90 kg)?") with a one-tap fix, using data the client already has.

All copy via `frontend/src/i18n/` (PL + EN), declension via `i18n/packUnits.ts`. Pure conversion helper in `src/lib/` with Vitest tests. Mobile first (wrap, not clip).

Out of scope: converting prod thresholds and fixing old snapshots (operator data session). Parallel lanes: display order (migration 0023), delivery calendar (0024), zero-quantity fix, order e-mail v2 — rebase on main before the PR.
