---
change_id: supplier-email-v21
title: Supplier e-mail v2.1 — company data before the sign-off, off-catalogue items as table rows, delivery date on, one "Wyślij" that opens the draft
status: impl_reviewed
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

Lane E of `porzadek-2026-10` (coordination branch `claude/projekt-porzadek-plan-80179e`, PR #63,
`context/changes/porzadek-2026-10/contracts.md`). Sources: Wispr W61/W62/W63/W66 (meeting 12.10),
crosscheck rows 13-15, 49-50. Ben's decisions of 17.10 are final:

- D2: the delivery date is printed in the e-mail (Railway flag, operator flips it after deploy).
- D3: the "/N" bulk suffix stays in the e-mail, except for suppliers Marek names later (not this change).

Scope: WP1 (layout), D2 (check + operator step), WP3 (one "Wyślij" button that opens that draft).
Out of scope: WP2 per-location delivery hours (waits for Marek).
