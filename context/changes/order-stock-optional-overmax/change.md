---
change_id: order-stock-optional-overmax
title: Current stock truly optional — over-MAX is the only reason gate when stock is uncounted
status: implemented
created: 2026-06-17
updated: 2026-06-17
archived_at: null
---

## Notes

current stock becomes truly optional (nullable) on captain order submit + edit; when stock is not counted the deviation/critical reason gate is skipped and only an over-MAX check forces a reason — corrects the order-screen-ux-fixes Bug A behavior where every blank-stock order wrongly demanded a reason code

Owner decision (2026-06-17): chose option **B** — "powód tylko przy przekroczeniu MAX". Found during prod smoke-check of [[order-screen-ux-fixes]] (deployed at 7f9b636). Bug A's fix coerced blank stock → 0, making `suggested = target`, so the symmetric ±20% deviation gate fired on essentially every blank-stock order (incl. normal/under orders), wrongly demanding a reason code that only makes sense for explaining over/under vs a real suggestion.

This crosses the API contract (`current_stock_qty_base` becomes nullable) — which `order-screen-ux-fixes` explicitly listed under "What We're NOT Doing" — so it is tracked as its own change, not a phase of that one.
