# Screen Design Proposals (spin-off spec)

Red-line + visual proposals seeding the per-screen follow-up changes. Full findings
live in `research.md`; this doc is the actionable spec. **No prod changes here** — each
screen below becomes its own gated `/10x-new` change that adopts the Phase 1–2 foundation.

## How to apply the foundation (token-application template)

Every spin-off follows the same recipe:

1. **Colors** → use tokens, not raw utilities: brand bar/buttons `bg-brand` / `hover:bg-brand-hover`;
   keep one neutral ramp (slate). No new `[#hex]` arbitrary values.
2. **Buttons** → replace bespoke `<button className="…">` with `<Button variant=… size=…>`
   (`frontend/src/components/ui/Button.tsx`). Primary = brand, ≥44px tap target by default.
3. **Header** → if the screen rolls its own brand bar, render it through `<AppHeader>`.
4. **Type** → replace `text-[10px]/[11px]` with the `text-caption` / `text-label` tokens.
5. **New primitives** → if the screen needs Input/Badge/Card/Banner, build that primitive in
   `components/ui/` as part of *this* spin-off (deferred from Phase 2 per plan-review F4).
6. **Verify** → `npm run build` + `npm run lint`; screenshot before/after for parity.

## Priority screens (full red-line + prototype)

Standalone prototypes in `frontend/design-proto/` (open directly in a browser; Tailwind CDN
with an inline theme mirroring `index.css` — plan-review F3).

| Screen | Key change | Prototype | Evidence |
|---|---|---|---|
| **ProductCard** | Promote the “visible math” (target/max/suggestion) from the smallest text to a prominent block | `design-proto/product-card.html` | research.md cluster 3, opp #2 |
| **OrderLineTable** | Responsive card fallback below `md` so editable qty/comment are reachable on mobile/tablet | `design-proto/order-line-table.html` | research.md opp #2 (manager) |
| **ManagerQueue** | Surface the `is_critical` flag on the queue card for triage | `design-proto/manager-queue.html` | research.md opp #5 |

## Other screens (short red-line — own change each)

- **AuthGate** — ✅ done in this change (logo + brand button + copy). Remaining: input still uses
  legacy `focus:` (not `focus-visible:`); the logo reveal needs the `onLoad`/inline fix (`notes/followups.md`).
- **OrdersListPage** — bespoke back-header → adopt a shared sub-header; status pills already good;
  PLN-to-captain is a Cluster-7 decision (`notes/cluster-7.md`).
- **OrderDetailPage** — deviation threshold 5% vs the order screen's 20% (`compute.ts`) — align or document.
- **OrderEditPage** — dead “Szkic” button renders enabled but is a no-op (`OrderEditPage.tsx:273`); hide in edit mode.
  `lineToItem` synthesizes `max=0` → card shows “max 0” misleadingly.
- **InventoryCountPage** — inputs `py-2` (sub-44px) → bump to `py-3`; hand-cloned `StickyActionBar` → reuse the shared bar;
  “blank = not counted / 0 = real zero” copy is a Cluster-7 decision.
- **ManagerFilterBar** — inactive chip `text-slate-400` reads as disabled; status chips overlap the queue's collapse chevrons (pick one model).
- **OrderDetailPane** — broken `sticky bottom-4` Save (no scroll container); Release + Dispatch render as two stacked bars; cutoff-past is color-only.
- **DispatchPanel** — no body char-counter despite the 8000-char limit; body goes stale after a line edit (manual “Odśwież”); Gmail nav+write coupling is a Cluster-7 decision.

## Shell / a11y (cross-cutting, own change)

- Extract no further header logic — `AppHeader` stays thin (plan-review F5).
- `NotFound` is hardcoded English **and leaks `BASE_URL`** (`App.tsx:18`) — translate + stop printing the URL.
- Manager toast lacks `aria-live`; `OrderLineTable` lacks `<th scope>`/`<caption>` — a11y change.
- Add a language switcher to the Manager (only the Captain hamburger has one).
