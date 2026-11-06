# Hide zero cells in the driver list PDF — Plan Brief

> Full plan: `context/changes/driver-list-hide-zeros/plan.md`

## What & Why

The driver PDF matrix prints `0` for every location that did not order a product.
Drivers read those zeros as something to carry. Cells should show only quantities above zero.

## Starting Point

`buildDriverPdfDocDefinition` renders `String(qty)` for every location cell
(`transportPdf.ts:170`). Zero-total rows are already dropped; the zeros are per-location cells.

## Desired End State

A location cell shows a number only when it is > 0, otherwise it is blank. Columns,
totals and the Pago/ZOW PDF are unchanged. The PDF download and the Gmail attachment
both pick it up (same builder).

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Where to fix | Render layer only | `qtyByLocation` zeros are a tested data contract |
| Zero cell look | Empty string, zebra kept | Request: "only values above zero" |
| Empty columns per section | Keep | Same columns across sections; out of scope |

## Scope

**In scope:** driver PDF location cells; tests.
**Out of scope:** data shape, Pago/ZOW PDF, e-mail bodies, column pruning.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Blank zero cells | One-line render change + tests | None material |

**Estimated effort:** one short session.

## Success Criteria (Summary)

- No `0` in location cells on the driver PDF; totals unchanged.
