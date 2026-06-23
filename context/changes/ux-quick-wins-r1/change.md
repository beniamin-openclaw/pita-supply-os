---
change_id: ux-quick-wins-r1
title: UX quick-wins round 1 — deviation threshold, no-baseline copy, variance colour, recount gate, history nav
status: implementing
created: 2026-06-23
updated: 2026-06-23
archived_at: null
---

## Notes

Five owner-requested UX quick-wins, shipped as one change in five phases:

1. **Deviation threshold 20% → 25%** — backend reason-gate + badge counter and the
   frontend captain submit-flow gate move in lockstep (parity). Owner: "−17% dla
   cebuli nie powinno wymagać powodu; minimum 25%". Out of scope: the Manager
   suggestion-review heat-band colours (separate analytics scale).
2. **∞ / no-baseline deviation copy** — display-only guard: when
   `suggested_qty_purchase === 0`, render a "brak bazy"/"—" copy (new i18n key)
   instead of a giant/∞ percentage, everywhere a per-line deviation % shows
   (captain order/submit + manager line table). No backend math change.
3. **Variance colour ≠ deviation colour** — give variance (received − ordered) its
   own distinct hue family (blue/indigo/sky) in the receive + order-detail views,
   so it never collides with the amber/red deviation signal.
4. **Recount gate at receiving** — stop silently pre-filling delivered = ordered;
   require a conscious value per line (blank-until-entered with a one-tap
   "= zamówione" shortcut). Owner: "wymuszenie liczenia przy przyjęciu". Keep the
   post-save lock and photo flow intact.
5. **Order-history navigation visible** — add a discoverable nav entry to the
   captain's order history (and receipts) from the primary captain screen. Data +
   screens already exist; this is wiring + i18n copy.
