# Manager Dashboard — Spec for v0 Mockup

This is the spec for the **Manager Dashboard** mockup that gets built next as
a Claude artifact (HTML/CSS). The dashboard is the single screen the
Manager/Office person uses to dispatch all orders for the day.

## Purpose

Eliminate the supplier-by-supplier login grind. Show all Captain-submitted
orders in one place. One click per order = one dispatch.

## Users

- **Primary:** one person from management/office. In v0 this might be Ben,
  Manager Bro, or Office Bro — to be confirmed.
- **Read-only viewers (Phase 2):** Owner, other Captains for benchmarking.

## Daily moment in the life of the Manager

> It's Tuesday 11:00. The Manager opens the dashboard on their laptop.
> Wola Captain submitted an order to Supplier A at 09:30, with current stock,
> suggested vs final qty, and one reason captured on Halloumi (low storage).
> The Manager sees one card at the top: *Wola → Supplier A, 18 lines, est.
> 1,240 PLN, cutoff 16:00*. They click it open, scan the lines, agree with
> Captain's overrides on Halloumi and Suwlaki, adjust nothing else, and
> click **Send order**. A Gmail draft pops up pre-filled with the supplier
> address, subject, and a clean table of products in purchase unit. The
> Manager hits Send in Gmail. Status flips to `manager_sent`. Total time
> elapsed in the dashboard: under 5 minutes.

## Screen layout (one screen, three regions)

### Region 1 — Header strip (top, ~80 px)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Pita Bros Order Dispatch        Today: Tue, 2026-05-22                │
│  [Today] [This week] [History]                          [Refresh]      │
└────────────────────────────────────────────────────────────────────────┘
```

- Title left.
- Date right.
- Tab strip: `Today`, `This week`, `History`.
- Refresh button (re-reads the Sheet).

### Region 2 — Order queue (left side, ~40% width)

A vertical list of cards. One card = one `(location, supplier, order_date)`
order with `status = 'captain_submitted'`.

```
┌─────────────────────────────────────────┐
│ ● Wola → Supplier A                     │
│   18 lines · est. 1,240 PLN             │
│   Captain submitted 09:30               │
│   Cutoff in 5h 00m                      │
│   2 deviations · 1 reason captured      │
│   [Open ▸]                              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ○ (no other orders today)               │
└─────────────────────────────────────────┘
```

Per card:
- Location → Supplier name.
- Line count + estimated PLN total.
- Captain submission time.
- Time to supplier cutoff (red if < 1h).
- Deviation count + reason-captured count.
- Open button.

Order in the queue: by cutoff time ascending (most urgent first).

### Region 3 — Order detail (right side, ~60% width)

When a card is open, shows the full line-by-line view.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Wola → Supplier A — 2026-05-22                            [Send order ▸]   │
│  Delivery requested: 2026-05-23 (Wed)                                       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Product        Unit  Stock  Sugg.  Capt.  Mgr.   Δ     Reason          │ │
│  │ Halloumi       kg    2.5    1 kt   1 kt   1 kt   0%    —               │ │
│  │ Suwlaki        kg    2.5    3 kt   2 kt   2 kt  -33%   Low storage    │ │
│  │ Pita bread     szt   120    2 wks  2 wks  2 wks  0%    —               │ │
│  │ ...                                                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Manager note:  [________________________________________]                  │
│                                                                              │
│  [Save changes]  [Send order ▸]                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

Per line, columns shown:
- Product (`product_name_pl`).
- Inventory unit.
- Current stock (`current_stock_qty_base`).
- Suggested (in purchase unit, with kg in tooltip).
- Captain final (purchase unit).
- Manager final (editable; defaults to Captain final).
- Δ vs suggestion (%).
- Reason code (if any; clickable to show Captain comment).

Color coding:
- Green row background: line matches suggestion exactly.
- Yellow: |Δ| 5–20% (informational).
- Orange: |Δ| > 20% with reason captured (audit-clean).
- Red: |Δ| > 20% with **no** reason captured (must fix before send).

Manager can edit any `Mgr.` cell. Changing it recomputes Δ live. If the
edit pushes Δ over 20%, a reason picker pops up; if the manager skips it,
the row goes red and Send is disabled.

### Send action

Clicking **Send order**:

1. Validates: no red rows (all >20% deviations have reasons).
2. Writes back to the Sheet: `manager_final_*` cells, `manager_user`,
   `manager_sent_at`, `sent_method = 'gmail_draft'`, `status = 'manager_sent'`.
3. Opens a Gmail draft (via Gmail MCP) with:
   - **To:** `<supplier.email>`
   - **Subject:** `Order from Pita Bros Wola — 2026-05-22`
   - **Body:** clean table (HTML or plain text) with columns: Product,
     Quantity, Unit. Plus a footer with the delivery address and contact.
4. Shows a toast: *"Gmail draft created. Open in Gmail to review and send."*
5. The card stays in the queue but greys out with status `Sent — awaiting
   delivery`.

### Send action (other channels, postponed)

For Phase 2, the **Send order** button branches by `suppliers.ordering_method`:
- `email` (v0) → Gmail draft.
- `portal` → Generate a copy-paste-ready table (with supplier product codes).
- `csv` → Download a CSV in the supplier's expected schema.
- `phone` → Show a phone-call script with quantities.

## Edge cases the mockup must show

1. **No orders today** — empty state in the queue with friendly text.
2. **Order with no deviations** — all green rows, simplest case, ready to send.
3. **Order with 1 deviation + reason** — orange row, Send enabled.
4. **Order with 1 deviation + no reason** — red row, Send disabled, tooltip
   explains why.
5. **Past-cutoff order** — card shows red "Past cutoff", Send still works
   but with a confirm dialog.

## What the dashboard does NOT do (v0)

- Does not handle receiving / WZ photos.
- Does not generate or read GoStock files.
- Does not show historical analytics or trends.
- Does not auto-send. Always produces a draft for human review.
- Does not handle multi-location consolidation. Wola only.
- Does not handle the Captain side — that's a separate screen.

## Build plan for the mockup

The mockup is a single HTML file (with inline CSS) that renders:
- One pre-filled card in the queue (Wola → Supplier A, 18 lines).
- The expanded order detail with the 5 edge-case row variants visible.
- A "click Send" → modal showing the Gmail draft preview.

Build target: a Claude artifact we iterate on visually. No backend, fake
data hardcoded. The data shape mirrors what the real Sheet will return.

Once the mockup is sign-off, Phase 1 build wires it to the real Sheet via
the Drive MCP.
