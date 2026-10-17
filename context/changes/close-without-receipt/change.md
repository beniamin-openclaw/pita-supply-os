---
change_id: close-without-receipt
title: Close without receipt — a Manager action that closes a sent order that will never be received, with a reason and a trace
status: implementing
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

Lane M item 6 of `porzadek-2026-10` (`context/changes/porzadek-2026-10/contracts.md`, WP10). Ben's
decision D5, confirmed on 17.10: the Manager can close a `manager_sent` order without a receipt,
with a required reason and a trace. Manager only.

Why: about 70 sent orders reach back to June with no receipt (goods came outside the app, orders
placed twice, Pago/Mory run from the Ordering sheet since 05.10). Each one shows the D16 marker
"wysłane > 3 dni bez przyjęcia" forever, and the captain cannot clear it. The Manager needs a way
to close them on purpose, leaving a reason that the history shows.

Known gap, left to Lane C: the captain screens show a closed order as "Zrealizowane" whether it was
received or closed without a receipt. A distinct captain label (and hiding a late receive) is a
follow-up for `captain-mp/**`.
