# Pita Bros Supply OS v1 — Brief

**Status:** Working spec for Wola pilot.
**Date:** 2026-05-22.
**Source:** `/Users/ben/Downloads/Pita_Bros_Supply_OS_v1_Handoff_Cutoff_Spec.md` (full
35-section handoff), narrowed to the smallest end-to-end vertical slice.

---

## Problem

At Pita Bros today, supplier orders are placed by one person — Manager or
Office — who must log into each supplier's portal or email separately to send
each order. Captains at each point have local stock knowledge but no system
to channel it. The result:

- **Send pain.** The Manager loses an hour per ordering cycle just navigating
  supplier portals, copying quantities between Excel, GoStock and emails.
- **Decision pain.** Captains know what's in their cooler, but their
  judgment never makes it into an order without a chain of WhatsApp messages.
- **Memory pain.** Nothing records *why* a quantity was ordered. The company
  cannot learn from its own ordering history.
- **Unit pain.** Stock lives in kg in GoStock; orders go out in cartons or
  pieces. Mental conversion happens every time, with quiet rounding errors.

## Who it's for

- **Primary submitter:** the Wola Captain — submits an order request through a
  simple screen on their phone or tablet.
- **Primary dispatcher:** one person in management/office — reviews all
  submitted orders in one dashboard and dispatches them through the right
  channel per supplier, in one place.
- **Background readers:** Office Bro and Manager Bro consult the audit log
  to coach Captains and refine master data.

## Solution (v0, Wola)

A two-screen system on top of a Google Sheets data backbone:

1. **Captain Submit screen** — per supplier, lists the location's products with
   current stock (entered by Captain), system suggestion in purchase unit
   with the math shown, final quantity field, and a reason dropdown that
   activates only when the deviation crosses a threshold. One submit button
   per supplier order.

2. **Manager Dashboard** — queue of orders submitted today, grouped by
   supplier. Each order is expandable, every line shows suggested vs Captain
   final vs Manager final. Manager can adjust quantities and add notes. One
   click sends the order — for v0, that means generating a Gmail draft pre-
   addressed to the supplier with all quantities in purchase unit, ready to
   send. Audit log captures every step.

The system **suggests, does not decide**. Suggestion logic in v0 is
deliberately simple and explainable:

```
suggested_qty_base = max(0, target_stock − current_stock)
suggested_qty_purchase = ceil(suggested_qty_base / units_per_purchase_unit)
```

with per-product rounding rules. Every suggestion shows its math next to the
line. No averages, no AI, no weekday logic in v0 — those go in the roadmap.

## Why this makes business sense

1. **One pilot location, one supplier, one Manager — minimum surface to
   prove the model.** The Manager's send-time at Wola drops from
   30–60 minutes to under 10 minutes. That's the measurable v0 win.
2. **The data asset compounds from day one.** Every order line writes
   `(suggested, captain_final, manager_final, reason)`. After 30 orders,
   Pita Bros has labeled data on its own ordering behavior — something no
   amount of GoStock history can produce on its own.
3. **It doesn't touch GoStock.** Sheets backbone + Gmail send. Politically
   safe, no integration risk.
4. **It maps cleanly to the full Supply OS roadmap.** Phase 2 adds receiving
   + WZ. Phase 3 adds remanent module + GoStock export. Phase 4 adds finance
   and KSeF. See [ROADMAP.md](ROADMAP.md).

## In scope for v0

- Master data for: products, suppliers, locations, supplier-product mapping
  (with `purchase_unit` and `units_per_purchase_unit`), location-product
  settings (`min`, `max`, `target` in inventory unit).
- One Captain Submit screen, scoped to Wola.
- One Manager Dashboard, scoped to all Wola orders submitted that day.
- Suggestion engine (target − current; convert to purchase unit; round).
- Reason capture when |delta vs suggestion| > 20%, or critical product = 0,
  or order exceeds `max_stock` by packaging-driven overage.
- One send channel: Gmail draft (one email-based supplier).
- Audit log: every line stores suggestion / captain_final / manager_final /
  reason / actor / timestamp.
- 4-state status model: `draft → captain_submitted → manager_sent → closed`.

## Out of scope for v0 (postponed, not removed)

See [ROADMAP.md](ROADMAP.md). Highlights of what's postponed: full remanent
module, WZ photo capture, receiving / discrepancy workflow, final-accept
locking, GoStock CSV/API export, multi-supplier consolidation,
exception-review queue, finance / KSeF / invoice matching, predictive AI,
the six dashboards described in source spec §22.

## Success metrics (v0, measured after 4 ordering cycles at Wola)

| Metric                                       | Target                              |
| -------------------------------------------- | ----------------------------------- |
| Manager time-to-send per order               | < 10 min (baseline 30–60 min)       |
| % of order lines where final = Captain final | ≥ 90% (Manager rarely overrides)    |
| % of deviation lines with reason captured    | ≥ 95%                               |
| Stockouts at Wola for v0 products            | 0 in the pilot window               |
| Overstock at Wola for v0 products            | Down vs baseline (qualitative ok)   |
| Captain satisfaction (1–5)                   | ≥ 4 after 4 cycles                  |
| Manager satisfaction (1–5)                   | ≥ 4 after 4 cycles                  |

## Risks (v0)

- **Wola Captain availability.** Pilot needs one Captain who will use the
  system every ordering day. Mitigation: get explicit commit before launch.
- **Supplier choice.** Must be an email-based supplier for v0 send-pain to
  be solved by a Gmail draft. If the heaviest-pain supplier is portal-only,
  pick the second-heaviest for v0 and put portal supplier in Phase 2.
- **Stock entry friction.** Captain entering current stock per product
  every ordering day is the most fragile workflow step. Mitigation: keep
  the screen short (~20 products), one-input-per-line, save state.
- **Master data dirty.** If `units_per_purchase_unit` is wrong for even one
  product, the suggestion is misleading. Mitigation: hand-validate all 20
  products before pilot starts; show the math on every line so wrong values
  are visible.
- **Manager scope creep.** "Could the dashboard also handle X?" will happen
  the day after launch. Mitigation: link every request to the roadmap
  phase that owns it.
