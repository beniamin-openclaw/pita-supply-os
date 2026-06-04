# Handoff Spec: Pita Bros Supply OS v0

This is the developer handoff for the Magic Patterns prompt + the React
build. Source mockups: [mockups/captain_submit_v0.html](mockups/captain_submit_v0.html),
[mockups/manager_dashboard_v0.html](mockups/manager_dashboard_v0.html).

## Overview

Two screens, one shared design system, one shared backend API.

- **Captain Submit** — mobile-first, phone-primary. The Wola Captain
  enters current stock per product, reviews system suggestions, optionally
  overrides with a reason, and submits one order per supplier to the
  Manager.
- **Manager Dashboard** — desktop, laptop-primary. The Manager/Office
  person sees all Captain-submitted orders, optionally adjusts, and
  dispatches each through the right channel (v0 = Gmail draft).

Same data model, same brand, same vocabulary. Both screens read/write to
the same Google Sheet (Phase 1.5; v0 reads from seed CSVs).

---

## Layout

| Screen | Default device | Min width | Max usable width |
|---|---|---|---|
| Captain Submit | Phone | 320 px | 720 px (content centered) |
| Manager Dashboard | Laptop | 1024 px | 1440 px (content centered) |

### Captain Submit grid

- Single column on phones (<700 px).
- Product card uses a 3-column grid internally: **Stock | Suggested | You order**.
- Sticky action bar fixed to bottom; product list scrolls behind it.
- Header + supplier picker + context strip are NOT sticky in v0 (they
  scroll away). Phase 1.5: make header sticky.

### Manager Dashboard grid

- Two-column flex: queue (360 px fixed) + detail (flex 1).
- Filter bar full-width above content.
- Header full-width above filter bar.
- Order detail table: 7 columns, fits 1024 px+.

---

## Design Tokens

### Colors

| Token | Value | Usage |
|---|---|---|
| `color-brand` | `#1a4480` | Header, primary CTAs, active filter chips, links |
| `color-brand-dark` | `#122f5a` | Header bottom border, brand hover |
| `color-brand-soft` | `#e3eaf3` | Context strip background, status-chip-active soft fill |
| `color-accent` | `#c97a2b` | Badge highlights (e.g., supplier chip count), warnings |
| `color-bg` | `#fafaf7` | Page background |
| `color-panel` | `#ffffff` | Card / panel surface |
| `color-border` | `#e6e3da` | All borders, dividers |
| `color-ink` | `#1f2329` | Primary text |
| `color-ink-soft` | `#5a6068` | Secondary text |
| `color-ink-muted` | `#8b9099` | Tertiary / hint text |
| `state-match` | `#2e7d32` on `#e8f5e9` | Match — Captain accepted suggestion |
| `state-info` | `#d4a017` on `#fff8e1` | Info — small deviation, no reason needed |
| `state-audit` | `#c97a2b` on `#fdf0e0` | Audit — deviation with reason captured |
| `state-block` | `#b3261e` on `#fde7e7` | Block — deviation without reason, gates Submit |

### Typography

- **Family:** system stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif`
- **Body:** 14 px (Manager) / 15 px (Captain — slightly larger for phone)
- **Line height:** 1.45
- **Numeric:** `font-variant-numeric: tabular-nums` everywhere a quantity appears
- **Form inputs:** 16 px (prevents iOS auto-zoom)

| Token | Size / weight | Usage |
|---|---|---|
| `text-display` | 18 px / 600 | Order detail title |
| `text-h1` | 16 px / 600 | Header title |
| `text-h2` | 15.5 px / 600 | Card title (product name) |
| `text-body` | 14–15 px / 400 | Default body text |
| `text-caption` | 12.5 px / 400 | Card meta, context strip |
| `text-label` | 11 px / 600 uppercase, letter-spacing 0.4 | Form labels, filter group labels |
| `text-hint` | 11.5 px / 400 italic | Math hints under suggestion cell |

### Spacing

8-px base scale.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4 px | Tight inline gaps |
| `space-2` | 8 px | Card internal gaps |
| `space-3` | 12 px | Card padding, between cards |
| `space-4` | 16 px | Section padding |
| `space-5` | 22 px | Detail panel padding |
| `space-6` | 28 px | Filter group separation |

### Border radii

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 6 px | Buttons, status chips, inputs |
| `radius-md` | 8 px | Detail panel, modal, primary CTA |
| `radius-lg` | 10 px | Cards (Captain + Manager queue cards) |
| `radius-pill` | 14 px | Supplier / location chips |

### Shadows

| Token | Value | Usage |
|---|---|---|
| `shadow-sticky` | `0 -2px 12px rgba(0,0,0,0.05)` | Sticky action bar |
| `shadow-modal` | `0 12px 40px rgba(0,0,0,0.25)` | Send modal |
| `shadow-card-hover` | `0 1px 4px rgba(0,0,0,0.04)` | Card hover (Manager queue) |

---

## Component Inventory

| Component | Variants | Props | Notes |
|---|---|---|---|
| `Header` | brand | `title`, `meta?`, `right?` | Blue band, brand wordmark left, meta right |
| `FilterBar` | — | `groups: FilterGroup[]` | Manager only; two groups (Locations, Status) |
| `Chip` | `loc-default`, `loc-active`, `loc-disabled`, `status-default`, `status-active`, `supplier-default`, `supplier-active`, `supplier-sent` | `label`, `count?`, `active`, `disabled`, `onClick` | Pill shape for locations/suppliers; rounded-rect for status |
| `OrderQueueCard` | `pending`, `sent` | `location`, `supplier`, `lines`, `submittedAt`, `cutoffInMs`, `deviationCount`, `reasonCount` | Used in Manager queue |
| `OrderDetail` | — | `order: Order` | Right pane of Manager screen |
| `OrderLineRow` | `match`, `info`, `audit`, `block` | `product`, `currentStock`, `suggested`, `captainFinal`, `managerFinal`, `delta`, `reasonCode`, `editable` | One row per product in Manager order detail |
| `ProductCard` | `match`, `info`, `audit`, `block`, `zero` | `product`, `stock`, `suggested`, `captainQty`, `reasonCode?`, `comment?` | Used in Captain Submit |
| `QtyInput` | — | `value`, `onChange`, `step`, `unit`, `min` | 16-px font, right-aligned, tabular nums |
| `SuggestedCell` | — | `value`, `unit`, `mathHint` | Read-only dashed border, italic hint underneath |
| `TagPill` | `ok`, `info`, `audit`, `block`, `zero`, `warn`, `bad` | `label` | Inline status indicator |
| `ReasonPicker` | `optional`, `required` | `value`, `onChange`, `commentRequired` | Appears within card on deviation |
| `StickyActionBar` | `captain`, `manager` | `summary`, `secondaryAction?`, `primaryAction` | Captain version excludes monetary totals |
| `SendModal` | — | `to`, `subject`, `body`, `onCancel`, `onConfirm` | Manager only; previews Gmail draft |
| `EmptyCard` | — | `text` | Used for "No more orders today" |

---

## States and Interactions

### Row / card 4-state vocabulary

The single most important pattern. Same vocabulary on both screens.

| State | Trigger | Visual | Submit gate |
|---|---|---|---|
| **match** | Captain final = suggested (within ±5%) | Green left border + soft green wash → white | ✓ |
| **info** | Small deviation 5–20%; no reason needed | Yellow left border + soft yellow wash → white | ✓ |
| **audit** | Deviation >20% **with reason captured** | Orange left border + soft orange wash → white | ✓ |
| **block** | Deviation >20% **without reason** OR critical product = 0 without reason | Red left border + soft red wash → white | ✗ blocks Submit |
| **zero** (Captain only) | No order needed (suggested = 0) | Muted grey left border, opacity 0.85 | ✓ |

### State transitions

| Element | From | Trigger | To | Behavior |
|---|---|---|---|---|
| Card | `block` | Captain picks a reason | `audit` | Border + wash recolor, "Reason required" pill → "Reason captured" |
| Card | `block` | Captain edits qty so deviation ≤ 20% | `info` or `match` | Tag updates, reason picker hides |
| Submit button | `disabled` | All cards no longer `block` | `enabled` | Tooltip removed, background → `color-brand` |
| Status chip | `default` | Click | `active` | Single-select within group |
| Location chip | `default` | Click | `active` | Multi-select, toggle |
| Location chip | `disabled` | (Click) | (No-op) | Cursor not-allowed |

### Animations

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Card border / wash | State change | Color transition | 150 ms | ease-out |
| Queue card | Hover (Manager) | Border `color-border` → `color-brand`, shadow appears | 150 ms | ease-out |
| Send modal | Open/close | Fade backdrop + scale modal | 200 ms | cubic-bezier(0.2, 0.8, 0.2, 1) |
| Scroll-to-error | Tap "1 row blocks submit" link | `scrollIntoView({behavior:'smooth', block:'center'})` | browser default | — |

---

## Responsive Behavior

| Breakpoint | Captain Submit | Manager Dashboard |
|---|---|---|
| 320 px (small phone) | Single column; 3-column grid inside card may wrap tighter; sticky action bar buttons stack | Not supported (use desktop) |
| 375 px (iPhone std) | Default mobile layout | Not supported |
| 414 px (large phone) | Default mobile layout | Not supported |
| 768 px (tablet) | Same as phone, content centered max 720 px | Detail panel hides queue (consider tabs) |
| 1024 px (laptop) | Centered max 720 px | Default 2-column layout |
| 1440 px (large laptop) | Centered max 720 px | Default 2-column, max content 1440 px |

For the Captain Submit, the 3-column internal grid **must not break the
card** at 320 px — use `min-width: 0` on grid cells and allow numeric
input columns to wrap input + unit vertically if needed.

---

## Content Specifications

### Product card

- Product name max line: 1 line desktop, 2 lines mobile (truncate w/ ellipsis).
- Product subtitle (`unit · 1 karton = 5 kg · target 35 kg · max 40 kg`):
  may wrap to 2 lines.
- Comment field: max 280 chars.
- Reason `OTHER`: comment becomes required.

### Order queue card (Manager)

- Location → Supplier: max width = card width; truncate Supplier if longer than ~24 chars.
- Cutoff time: relative ("in 5h 00m") if today, absolute ("Tue 16:00") if not.
- Deviation count: hide if 0.

### Gmail draft body

- Subject: `Order from Pita Bros [location] — [date]`
- Body: greeting + product table + delivery address + signoff. Plain text
  preferred (avoid HTML email).

---

## Edge Cases

| Situation | Behavior |
|---|---|
| Captain enters negative stock | Reject input; clamp to 0 |
| Captain enters stock > 999 | Allowed; warn if > max × 5 |
| All Captain products at target | Whole order zero-state: show "Stock is at target — no order needed today" and disable Submit |
| Captain leaves screen mid-entry | Local draft saved to localStorage; on return, prompt "Resume draft?" |
| Manager opens dashboard with 0 pending | Empty queue card: "No orders pending. Captains submit from their phone — orders appear here once submitted." |
| Manager loses connection while reviewing | Queue read still works (cached); Save changes / Send fails with retry banner |
| Captain submits twice in a row | Second submit detected by `(location, supplier, date)` uniqueness → "You already submitted this. Open existing? [Yes] [Cancel]" |
| Reason picker `OTHER` selected, comment empty | Submit blocked, picker turns red, helper text "Comment is required for OTHER" |
| Manager final < Captain final | Manager must add `manager_comment` |
| Critical product final = 0 with reason | State = `audit` (not `block`), Submit allowed |

---

## Accessibility Notes

- **Focus order Captain Submit:** Header menu → supplier chips (left to right) → each product card (stock input → final qty input → reason if visible) → sticky action bar (save → submit).
- **Focus order Manager Dashboard:** Header → location chips → status chips → queue cards → order detail (lines top to bottom: each `manager_final` cell, then `manager_comment` field, then send button).
- **ARIA:**
  - Card state: `role="group"` + `aria-label="Product card — {state}"`.
  - Reason picker: `role="combobox"` with `aria-required="true"` when state = `block`.
  - Submit button: `aria-disabled="true"` + `aria-describedby="submit-blocker"` referencing the "1 row blocks submit" link.
  - Color is not the only signal — every state has a text pill too.
- **Keyboard:**
  - Tab through inputs in left-to-right reading order.
  - Enter on a chip toggles it.
  - Escape closes the Send modal.
- **Touch targets:** All chips/buttons ≥ 36 px tall on desktop, ≥ 44 px on mobile. Captain qty inputs at 42 px (acceptable; consider 44 in next iteration).
- **Color contrast:** All text/background pairs meet AA at minimum; `color-brand` on white = 8.5:1 (AAA).

---

## Magic Patterns Prompt — Captain Submit

Paste this into Magic Patterns to generate the React component:

> Build a mobile-first order submission screen for a Greek restaurant chain's Captain (kitchen worker). Single-page React app, route `/captain` (and `/` redirects there).
>
> Stack: **React 19 + TypeScript + Tailwind CSS + Vite**. No external UI libs (no shadcn, no MUI). Use `fetch` directly (no axios).
>
> ## Auth flow (first thing on app load)
>
> 1. Read `localStorage.getItem("supply_os_captain_token")`. If empty, show a centered modal "Wpisz kod miejsca" (location code entry) — single password input + Submit button. On submit, store the value to `localStorage` and load the main UI. The token is the Bearer token used in all `/api/*` calls.
> 2. On any `fetch` response with status 401, clear `localStorage` and re-show the modal (with hint "Kod nieprawidłowy — spróbuj jeszcze raz").
> 3. The token's owning location is derived server-side from the token itself — frontend never sends `location_id` in request body.
>
> ## API base URL
>
> Read `import.meta.env.VITE_API_URL`. Default in dev: `http://localhost:8901`. In Vercel: `https://supply.46-101-213-61.nip.io`. **Never hardcode the URL.** Every fetch goes through a small `apiClient` helper that injects `Authorization: Bearer <token>` and handles 401 by clearing localStorage + reloading the modal.
>
> ## UI structure
>
> **Header**: deep blue (#1a4480) band, "PITA BROS Order Submission" title left, hamburger right. Below header inside the same band: 3 small pill badges showing location (📍 Wola — comes from `/api/captain/orderable` response's first item's location_id resolved via `/api/locations`), Captain (👤 from token, just show first 8 chars of token as masked id), date (📅 today in Europe/Warsaw, formatted like "Tue, 2026-05-22").
>
> **Supplier picker**: horizontal scrollable chip row. One chip is active (deep-blue filled with white text), others are outlined with a small badge showing line count. Sent suppliers show a green checkmark and are dimmed. Source: `GET /api/suppliers` (returns all 10, but only show those with at least one supplier_product matching this location's settings — derive client-side).
>
> **Context strip**: light-blue background (#e3eaf3), small text. Left: "{supplier_name} · {delivery_days} delivery". Right: cutoff time in red ("⏰ Submit by today 14:00") computed from supplier's cutoff_time + next delivery_days weekday.
>
> **Product cards**: stack of cards, each with a colored left border (4-state vocabulary): green (match), yellow (info), orange (audit), red (block), grey (zero). Card has a product title with optional CRITICAL pill (from `is_critical` field), subtitle showing units and target/max, then a 3-column grid:
> 1. Current stock (numeric input, right-aligned, with unit label = `inventory_unit`)
> 2. System suggested (read-only dashed cell, bold qty, italic math hint underneath like "need 27 kg → 6 kartony")
> 3. You order (numeric input, right-aligned, with unit label = `purchase_unit`)
>
> Below the grid: a tag pill ("match", "−33% deviation — reason captured", "−100% on critical product — reason required", etc.).
>
> When deviation > 20% or critical product final = 0, show a Reason Picker inside the card: dropdown with 7 codes (EVENT_HIGH_TRAFFIC, WEEKEND_HIGH_TRAFFIC, LOW_STORAGE, PACKAGING_LIMITATION, SUPPLIER_UNDERDELIVERS, SYSTEM_SUGGESTION_WRONG, OTHER) + optional comment textarea. If OTHER selected, comment becomes required.
>
> **Sticky bottom action bar**: white, top border, two-line summary on left ("6 lines · 2 deviations · 1 reason captured" then a red link "⚠ 1 row blocks submit — tap to fix" that smooth-scrolls to the red card). Save Draft + Submit to Manager buttons right. Submit disabled when any card is red. **Do NOT show any monetary value or PLN total.**
>
> ## Data calls
>
> - `GET /api/captain/orderable?supplier_id=SUP_PAGO` → list of orderable items for this Captain's location (location derived from token by backend).
> - `GET /api/suppliers` → list for supplier picker.
> - `GET /api/locations` → for location_id → display_name resolution.
> - Compute suggestion locally per row: `suggested_base = max(0, target - current); suggested_purchase = ceil(suggested_base / units_per_purchase_unit)`. No need to call `/api/captain/suggest` for every row.
> - `POST /api/captain/submit` → body `{ supplier_id, requested_delivery_date, lines: [{product_id, supplier_product_id, current_stock_qty_base, captain_final_qty_purchase, reason_code?, captain_comment}], notes }` → returns `{ order_id, status, line_count, total_value_estimate_pln, warnings }`. On 200, show success toast and clear localStorage draft.
>
> ## Drafts (localStorage)
>
> Save the in-progress order to `localStorage.setItem("supply_os_captain_draft_{supplier_id}", JSON.stringify(state))` on every keystroke (debounced 500ms). On load, if draft exists for the active supplier and is < 24h old, show a banner "Resume draft from {time}? [Yes] [Discard]".
>
> ## Polish + accessibility
>
> Use system font stack. Body 15 px. Numeric values `font-variant-numeric: tabular-nums`. Form inputs 16 px to prevent iOS zoom. Touch targets ≥ 44 px on mobile. ARIA labels per Accessibility Notes section of this handoff.
>
> ## Production-ready checklist
>
> - TypeScript types matching the API response (define them upfront in `src/types.ts`)
> - Loading skeletons (3 product card skeletons while fetching)
> - Error toasts (network error, 4xx with message, 5xx generic)
> - localStorage draft persistence (per supplier)
> - Optimistic UI on row state changes (recompute pills + sticky bar locally before any network call)
> - Empty state: "Stock is at target — no order needed today" if all final qty = 0

## Magic Patterns Prompt — Manager Dashboard

> Build a desktop order-dispatch dashboard for a Greek restaurant chain's Manager. Single-page React app, route `/manager`.
>
> Stack: **React 19 + TypeScript + Tailwind CSS + Vite**. Two-pane layout: queue on left (~360 px), order detail on right (flex). No external UI libs. Use `fetch` directly.
>
> ## Auth flow (first thing on app load)
>
> 1. Read `localStorage.getItem("supply_os_manager_token")`. If empty, show a centered modal "Wpisz kod menedżera" (manager code entry) — single password input + Submit. Store and proceed.
> 2. On any 401, clear localStorage and re-show the modal.
>
> ## API base URL
>
> Read `import.meta.env.VITE_API_URL`. Default `http://localhost:8901`, Vercel `https://supply.46-101-213-61.nip.io`. All fetch goes through `apiClient` helper with `Authorization: Bearer <token>`.
>
> ## UI structure
>
> **Header**: deep blue (#1a4480) band, "PITA BROS Order Dispatch" left, date "Tue, 2026-05-22 · 11:00 Europe/Warsaw" + refresh button right (refetches queue).
>
> **Filter bar** below header (white, bottom border). Two groups:
> 1. **Locations** (pill chips): from `GET /api/locations`, WOLA active by default (the only `active=true` one in v0), other 5 dashed/disabled with tooltips "Phase 2+ rollout".
> 2. **Status** (rounded-rect chips): Pending action / In transit / Closed. Maps to `OrderStatus`: Pending = `captain_submitted`, In transit = `manager_sent`, Closed = `closed` or `cancelled`. Single-select. Default = Pending.
>
> **Queue cards** (left pane): one per order from `GET /api/manager/queue?status={selected_status}`. Card fields use API response directly:
> - dot indicator (color by status)
> - title "{location_id} → {supplier_name}"
> - subtitle: "{line_count} lines · {total_value_estimate_pln} PLN"
> - submitted-at: relative time ago ("2h ago")
> - cutoff: parse `cutoff_iso` from response; show red if < 1h away, orange if < 6h, neutral otherwise
> - badges: deviation_count (orange if > 0), reason_count (grey if > 0)
>
> Hover lifts shadow. Active card has blue ring. Sent cards greyed.
>
> **Order detail** (right pane): fetched via `GET /api/manager/order/{order_id}` when card clicked. Title bar (location_name → supplier_name — order_date, Captain pill from `captain_user`, cutoff_iso). Then a table with 7 columns:
> | Product | Stock | Suggested | Captain | Manager | Δ | Reason |
>
> Row backgrounds match the 4-state vocabulary (match green wash / info yellow / audit orange / block red). The "Manager" cell is editable (numeric input); editing recomputes Δ live (`abs(manager_final - suggested) / max(suggested, 1)`) and may pop a Reason Picker if Δ > 20% (same 7 codes as Captain). **Show PLN estimates** in this view (Manager sees value: `price_estimate_pln * manager_final_qty_purchase`).
>
> Manager note textarea below table (binds to `manager_comment` per line — or use a separate global notes field per order; recommend per-line for granularity).
>
> Bottom action bar: Save Changes button (just updates local state until Send), Send Order button. Send disabled when any row is red.
>
> ## Send flow
>
> Send opens a modal previewing the Gmail draft. Frontend does NOT compute the body itself — it calls `POST /api/manager/dispatch` and receives:
> - `order_id`, `status` (manager_sent), `gmail_compose_url`, `supplier_email`, `total_value_estimate_pln`.
>
> Modal shows the supplier email + a "Open in Gmail" button that opens `gmail_compose_url` in a new tab (Gmail web compose with prefilled to/subject/body). Plus a Cancel button (which **does not** undo the dispatch — backend already wrote `status=manager_sent` to sheet; this is intentional, fire-and-confirm pattern). Phase 2+ may add undo within 5s grace.
>
> ## Data calls
>
> - `GET /api/manager/queue?status=captain_submitted&location_id=WOLA` → list of queue items
> - `GET /api/manager/order/{order_id}` → full detail with lines, joined product/supplier/location info
> - `GET /api/locations` → for filter bar
> - `POST /api/manager/dispatch` → body `{ order_id, manager_finals: [{ order_line_id, manager_final_qty_purchase, manager_comment }], sent_method: "gmail" }` → returns gmail_compose_url
>
> ## Polish + accessibility
>
> Use system font stack. Body 14 px. Numeric values `font-variant-numeric: tabular-nums`. Touch targets ≥ 36 px desktop. ARIA: queue cards `role="listitem"`, detail table `role="table"`, modal `role="dialog" aria-modal="true"`. Esc closes modal. Keyboard nav (Tab/Shift-Tab through queue cards then detail rows).
>
> ## Production-ready checklist
>
> - TypeScript types matching API response (define in `src/types.ts`)
> - Loading skeletons (queue: 3 card skeletons; detail: table skeleton)
> - Optimistic edits on Manager cell (recompute Δ + row state immediately, before any network call)
> - Auto-refetch queue every 60s (light polling — backend reads cached sheet)
> - Empty queue state: "No orders pending. Captains submit from their phone — orders appear here once submitted."
> - Error toast on dispatch failure (409 → "Order was already dispatched", 404 → "Order missing", 5xx → generic)

---

## Implementation Order (actual, as shipped through 2026-05-24)

1. **Backend** (`supply-os-v1/`) — Phase C complete and deployed:
   - Models, seed loader, sheets adapter (gspread), suggestion engine.
   - Endpoints: `/health`, `/api/products`, `/api/suppliers`, `/api/locations`, `/api/captain/orderable`, `POST /api/captain/suggest`, `POST /api/captain/submit`, `GET /api/manager/queue` (live, joins supplier name + computes cutoff_iso + deviation/reason counts), `GET /api/manager/order/{order_id}` (full detail with joined product/supplier/location), `POST /api/manager/dispatch` (status transition + Gmail compose URL).
   - Live at `https://supply.46-101-213-61.nip.io` (DO droplet, Caddy gateway, Let's Encrypt).
2. **Frontend** (Phase D — in progress):
   - Generate via Magic Patterns using the two prompts above.
   - Wire fetch + auth + LocalStorage token + Vite scaffold.
   - Deploy to **Vercel** (free Hobby plan). After deploy, update CORS_ALLOW_ORIGINS in droplet `.env` to include the Vercel URL.
3. **Auth (v0)**: shared per-location Bearer token; Captain types it once into a localStorage modal. **Phase 1.5**: magic-link via Resend or Google-domain-restricted login.
4. **Hosting summary**:
   - Backend: DO droplet `root@46.101.213.61`, systemd unit `jarvis-supply-os`, Caddy reverse proxy → uvicorn on port 8001.
   - Frontend: Vercel (`https://<app>.vercel.app`) with `VITE_API_URL=https://supply.46-101-213-61.nip.io`.
   - Storage: Google Sheet `supply_os_master_v0` (id `11aJUcMUvb6Uuc8XcH8KdBdWr-iyvoJOZrsh2O2YQ9Lo`) via service account `pita-supply-os-sa@pitabros-jarvis-ops.iam.gserviceaccount.com`.
5. **Instrument** (deferred to Phase 1.5): PostHog events per [BUILD_PLAN.md](BUILD_PLAN.md). Add a small `posthog-js` initialization gated by `VITE_POSTHOG_KEY` env when ready.

---

## Open design questions for v0.1

1. Should the Captain see *who* submitted last week's order (their name)?
   Helps continuity. Could be in the context strip.
2. Should over-max warnings on the Captain side block submit, or just
   warn? Recommendation: warn only.
3. Modal vs full-screen for Gmail draft preview on Manager? Modal works
   for v0. Full-screen if Manager edits the draft body.
4. Dark mode? Defer — kitchen lights are bright, Manager office too.
