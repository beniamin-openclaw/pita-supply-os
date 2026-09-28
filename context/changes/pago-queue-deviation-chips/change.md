---
change_id: pago-queue-deviation-chips
title: Manager queue shows no deviation chip for suppliers with suggestion alerts off
status: implemented
created: 2026-09-28
updated: 2026-09-28
archived_at: null
---

## Notes

Follow-up to `pago-suggestion-no-alerts` (R-22, archived 2026-09-28). With
`suggestion_alerts_enabled = false` the Captain is never asked for a reason on a Pago line,
but `delta_vs_suggestion_pct` is still stored (FR-011 learning record), so the Manager queue
still showed an orange "N odchyleń" chip and an amber "0/N z powodem" chip on almost every
Pago order. Operator request (2026-09-28): hide those chips for Pago.

### What changed

- `manager_queue` returns `deviation_count = 0` for an order whose supplier has
  `suggestion_alerts_enabled = false`. The frontend already hides both the deviation chip and
  the reason-coverage chip when `deviation_count` is 0, so there is no frontend change.
- `reason_count`, `line_count` and every stored order-line value are unchanged.
- Test: `test_queue_hides_deviations_for_supplier_with_alerts_off`.

### Not changed

- The per-line delta column in the Manager order detail (`OrderLineTable`) still shows the
  percentage — information, not an alert.
- `/api/manager/suggestion-review` (FR-012) still includes Pago deviations.
- `/api/captain/orders` `deviation_count` is not rendered anywhere, so it is left as is.

### Deploy

No migration. Merge → Railway auto-deploy; check the queue on prod.
