---
change_id: receiving-received-headline
title: Receiving display — post-delivery line shows the received qty as the headline
status: implemented
created: 2026-06-23
updated: 2026-06-23
archived_at: null
---

## Notes

Fix the Captain order-detail line display so that AFTER a delivery is confirmed, the prominent
(headline) number is the **received** quantity, not the ordered one — and label the numbers so they
can't be misread. Owner complaint (live demo 2026-06-23): Awokado captain-ordered 3 → manager 2 →
received 3; the card showed a big "2" (ordered) while the owner confirmed 3, reading "2" as wrong.

Owner decision: **post-delivery headline = PRZYJĘTO (received)**; ordered + variance become a labeled
secondary line, sourced from the receipt's own `ordered_qty_purchase` snapshot (the value the stored
variance was computed against) for internal consistency. Pre-delivery headline keeps the effective
ordered qty but gains a label so the number is anchored. Display-only, frontend-only, no backend
change. Research (architecture + the inconsistencies this resolves) in `research.md`.
