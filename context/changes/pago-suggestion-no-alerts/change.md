---
change_id: pago-suggestion-no-alerts
title: Pago keeps the suggestion but shows no deviation alerts and never asks for a reason
status: implemented
created: 2026-09-27
updated: 2026-09-27
archived_at: null
---

## Notes

Operator request (2026-09-27): bring the suggestion back for Pago products, but do not show
alerts and do not require a reason.

### Why

`week2-feedback-quantities` analysis (#9): the Captain orders a week of Pago stock against
targets that cover about one day, so almost every Pago line deviated by more than 25 %. The
card turned red, the Captain had to pick a reason, and in 80 % of cases they picked
`SYSTEM_SUGGESTION_WRONG`. The suggestion itself is useful context; the gate is not.

Prod check (read-only, 2026-09-27): Pago targets are set at WOLA, BRACKA, KEN, NORBLIN,
BROWARY, so the suggestion is computed. Exceptions: target 0 for Gyros 25 KG outside NORBLIN
and for Gyros 15 KG at NORBLIN, and every Pago row at the not-yet-active locations.

### Decisions (operator, 2026-09-27)

1. No reason is ever required for Pago (deviation, critical under-order).
2. The uncounted over-MAX gate is also off for Pago.
3. A per-supplier flag in master data, not a hardcoded `SUP_PAGO`, so Coca-Cola can be
   switched later without a code change.
4. Separate branch from `main` (independent of `pago-transport-only-dispatch`).

### What changed

- Migration `0022_supplier_suggestion_alerts.sql`: `suppliers.suggestion_alerts_enabled
  boolean NOT NULL DEFAULT true`. Number 0022 because 0018 is PR #30 and 0021 is
  `pago-transport-only-dispatch`.
- Backend: `_evaluate_submit_line(..., alerts_enabled)` skips all three reason gates and
  returns no warning when the supplier flag is off (submit and captain edit). The line still
  persists `suggested_*` and `delta_vs_suggestion_pct` (FR-011 learning record).
  `/api/captain/orderable` items and `CaptainOrderDetail` carry the flag.
- Frontend (Captain): with the flag off, the card keeps the suggestion tile, shows a green
  "Zgodnie z sugestią" pill when the order equals the suggestion and a neutral grey
  "Ilość wpisana" pill otherwise; no ReasonPicker, no "Poniżej minimum", and the product is
  left out of the pre-submit "critical product not ordered" warning.
- Seed CSVs are unchanged: tests use SUP_PAGO as the generic gated supplier, so the seed
  keeps the default (alerts on). New tests flip the flag via mocks.

### Not changed (follow-up if wanted)

- Manager queue deviation chips (`deviation_count`) still count Pago lines above 25 %, since
  `delta_vs_suggestion_pct` is still stored.
- Pago targets are still day-scale; a week-scale target is PR #30 (dynamic target).

### Deploy order

1. Apply migration 0022 on prod (before the backend deploy; `_SUPPLIER_COLUMNS` lists it).
   **Done 2026-09-27** (MCP `apply_migration`): column present, `NOT NULL DEFAULT true`;
   diff before = all 14 suppliers `true`, SUP_PAGO included.
2. `prod-sql.sql` in this folder: diff before, flip SUP_PAGO, audit after.
3. Merge the PR (Railway + Vercel auto-deploy), confirm the new bundle is live.
4. Live check on WOLA x Pago with auth on: +300 % line, no reason picker, submit enabled;
   back the order out before any dispatch.
