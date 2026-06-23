# Order qty display fixes — Plan Brief

> Full plan: `context/changes/order-qty-display/plan.md`

## What & Why

Three display-only fixes on the Captain order-detail view, from live demo round 2 (2026-06-23). The
data is correct everywhere; the order-detail card lies — it shows the captain's original qty even
after the manager changed it and dispatched, and never shows what was received. A separate float bug
makes the delivery variance read "+0.40000000000000013".

## Starting Point

The card hardcodes `captain_final_qty_purchase` (`OrderDetailPage.tsx:190`). The correct "effective
ordered qty" rule (`manager_final if >0 else captain_final`) already exists twice — in `managerLine.ts`
and `ReceiveDeliveryPage.tsx` — which is why the receive screen already shows the right number while
the order detail doesn't. Receipt per-line received/variance data already exists via `api.receipt`.

## Desired End State

The Captain order-detail card shows the manager's final qty (1.8, not 1.4) with a discreet "changed
by manager (was 1.4)" hint; once a delivery is confirmed it also shows "Delivered: 2.2 · variance
+0.4" per product; and all computed quantities render to 2 dp.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Which qty on the card | Effective always (manager_final if >0 else captain_final) | One rule, consistent with receive screen + backend | Plan |
| Surface received qty (Item C) | Yes — per-line "Delivered X · variance Y" when a receipt exists | Closes "no corrected value on the main view" | Plan |
| Manager-changed indicator | Yes — discreet "changed by manager (was X)" | Explains why the number differs from the captain's entry | Plan |
| Variance rounding | 2 dp (owner-stated) | Kills the binary-float tail | Owner |
| Shared-helper home | New `src/lib/orderQty.ts` + `roundQty` in `components/ui/number.ts` | Neutral cross-feature home; no Captain→Manager import | Plan |

## Scope

**In scope:** effective ordered qty on the Captain card; manager-changed hint; per-line received +
variance after delivery; 2 dp rounding of computed qty; consolidate the two duplicated rule copies.

**Out of scope:** any backend/data change; receive-screen qty behavior (only its variance rounding);
comma-vs-dot display locale; round-1 backlog items.

## Architecture / Approach

Consolidate the duplicated effective-qty rule into one shared helper (`src/lib/orderQty.ts`); add a
`roundQty` number util next to the existing `parseDecimal`. Phase 1 applies both on the card (no new
network call). Phase 2 adds one `api.receipt(...)` call in the order-detail page's existing
`manager_sent` branch to overlay received qty per line.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Effective qty + hint + rounding | Card shows manager-final + hint; variance rounded; rule consolidated | Touching `managerLine` consolidation could ripple into the Manager table — keep its public name |
| 2. Received overlay (Item C) | "Delivered X · variance Y" per line after delivery | One extra fetch; must degrade silently when no receipt |

**Prerequisites:** none (display-only; all data already served).
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Assumes `manager_final_qty_purchase` is 0 (not null) when unset on the TS type — matches the
  existing two helpers, which already gate on `> 0`.
- The owner's "edits don't save progress on receive" remark is treated as display-only; Phase 1
  manual check 1.8 repros it to confirm there's no separate save bug.

## Success Criteria (Summary)

- After a manager edit + dispatch, the Captain card shows the manager's number + hint.
- After delivery, the card shows received qty + a clean (2 dp) variance per line.
- Build, lint, and unit tests green; no regression on the Manager dashboard.
