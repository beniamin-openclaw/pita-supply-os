---
change_id: manager-queue-control
title: Manager queue control — all active suppliers in the filter, overdue markers, one manager-zero convention
status: implementing
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

Lane M items 1–3 of `porzadek-2026-10` (coordination branch `claude/projekt-porzadek-plan-80179e`,
`context/changes/porzadek-2026-10/contracts.md`). Ben's decisions of 17.10:

- **D11 / WP11.** The Manager supplier filter lists every active supplier, including Spec Food.
  Today it lists only suppliers that already have orders in the queue (`ManagerPage.tsx`
  `supplierOptions`), and SUP_SPEC has never been ordered.
- **D16.** On 17.10, 47 orders were claimed but never sent and no Transport had been sent since
  05.10. Marek must do everything in the app. The Manager queue gets the markers
  "przejęte > 24 h" and "wysłane > 3 dni bez przyjęcia". Nothing changes for the captain.
- **D10 A.** One convention for a manager zero: amber and struck through everywhere (Transport
  matrix, captain order detail). The Transport city filter loses its strikethrough. A backup line
  in the manager table shows "u głównego" instead of "—".
