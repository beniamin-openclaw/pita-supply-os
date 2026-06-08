---
date: 2026-06-08T08:15:46+0200
researcher: Claude (Opus) + 3 parallel readers
git_commit: 770ee8a
branch: main
repository: 10xDEVS
topic: "Design-quality audit of all user-facing screens (tokens-first; red-line + Tailwind-static proposals; first-impression logo animation)"
tags: [research, frontend, design-system, tailwind, ux, accessibility, audit]
status: complete
last_updated: 2026-06-08
last_updated_by: Claude
---

# Research: Design-quality audit of all user-facing screens

**Date**: 2026-06-08T08:15:46+0200
**Researcher**: Claude (Opus) with 3 parallel read-only sub-agents
**Git Commit**: 770ee8a
**Branch**: main
**Repository**: 10xDEVS (frontend SPA: React 19 + Vite 7 + Tailwind v4)

## Research Question

Audit the design quality of every user-facing screen in the Pita Supply OS frontend, grounding a tokens-first design pass. Deliverable of the parent change: red-line critique + Tailwind-static visual proposals (NO prod changes until approved), implementation gated per-screen as separate changes. First-impression scope includes a logo animation on the AuthGate.

Framing locked with owner before research: **fidelity** = red-line + Tailwind-static; **structure** = tokens-first then per-screen; **screenshot source** = local `npm run dev`; **logo** = owner will provide an SVG.

## Summary

The codebase has a **strong, consistent component core but no design-system layer**, and the inconsistency lives almost entirely at the **shell/token level**, not in the page logic. All three readers converged on the same root cause:

- **There is no token layer.** Tailwind v4 with **no `tailwind.config.*` and no `@theme` block** — `index.css:3` literally says *"design tokens live in components."* Consequences: the brand navy `#1a4480` is a raw hex repeated **~13×** across files; **two parallel neutral palettes** (`slate-*` vs `gray-*`) are used interchangeably; **27 arbitrary font sizes** (`text-[10px]`, `[11px]`, `[16px]`, `[9px]`); no shared `<AppHeader>` (every page rolls its own chrome). This is the highest-leverage, lowest-risk fix and the foundation for everything else.
- **The shared component vocabulary is good where applied** (one icon library `lucide-react`, `focus-visible` everywhere in pages, fully bilingual strings, a global `prefers-reduced-motion` reset, a shared `statusVisual` map) — but the "secondary" Captain screens (list/detail/edit) and the inventory screen partially opt out, so the experience fragments as the user moves past the main order screen.
- **A handful of findings are correctness-/product-adjacent, not pure styling** (money visibility to Captain, the unexplained "blank = not counted" inventory rule, the Gmail "open draft = mark sent" coupling, a raw reason-enum leak). These need an owner decision in planning, not a silent redesign.

**The good news for a tokens-first pass:** because the inconsistency is concentrated at the shell/token layer, defining tokens + a shared header + a small component set (Button / Input / Badge / Card / Banner) cleans up the majority of findings centrally, before any per-screen work.

## The design substrate (current state)

- **Tailwind v4, no config.** `frontend/src/index.css:1` `@import "tailwindcss"`; no `tailwind.config.*`, no `@theme`. Globals: `font-feature-settings: "tnum"` (tabular numerals everywhere — good, keeps qty/PLN aligned), a `.hide-scrollbar` utility, and a global `@media (prefers-reduced-motion: reduce)` reset (`index.css:26-33`) that neutralizes all animation. **The logo animation must (and will) inherit this reduced-motion gate.**
- **Routing** (`App.tsx:34-104`): flat `Routes`; `/` → `/captain-v2`. Real routes: `/captain` (legacy `CaptainPage`), `/captain-v2` (`CaptainMP`, canonical), `/captain-v2/inventory-count`, `/captain-v2/orders`, `/orders/:id`, `/orders/:id/edit`, `/manager`, an **unguarded `/debug`**, `*` → `NotFound`. Every real route individually wrapped in `<AuthGate role=…>`.
- **No shared layout/header.** `ManagerPage.tsx:340-363` and `captain-mp/components/Header.tsx:28-30` independently re-declare the same `bg-[#1a4480] text-white` header. No `<AppHeader>`, no role-switch affordance (Captain/Manager reachable only by URL).
- **Animation inventory is lean**: `transition-colors` ×23, `animate-spin` ×5 (busy spinners), `animate-pulse` ×1, `animate-in` ×1. No entrance choreography; Manager side has no skeletons (only Captain has `SkeletonCard`).
- **Brand wordmark exists in copy** ("PITA BROS — Zamówienia", `strings.ts:13`) but **never appears on the AuthGate** — the literal first impression is an unbranded password box on a black void.

## Detailed Findings

### Cluster 1 — No design-token layer (the tokens-first target)

The central finding. Define these centrally (Tailwind v4 `@theme` in `index.css`, or a re-introduced config) and most styling findings resolve at the source.

- **Two primary brand colors.** Custom hex `#1a4480` (headers + some buttons: `Header.tsx:28`, `StickyActionBar.tsx:78`, `SupplierPicker.tsx:57`, `ManagerPage.tsx:340`) **vs** Tailwind `blue-700` (`AuthGate.tsx:93`, `DebugPage.tsx:112`). Used ~13× as a raw hex; any rebrand = grep-and-replace.
- **Dual neutral palettes.** `slate-*` (dominant) vs `gray-*` (ProductCard uses `gray-*` exclusively: `ProductCard.tsx:168`). Same role, two scales: `bg-slate-50` (21×) vs `bg-gray-50` (6×); `border-slate-200` (23×) vs `border-gray-200` (11×).
- **Arbitrary font sizes (27×).** `text-[10px]` (ProductCard labels), `text-[11px]` (table headers, `OrderLineTable.tsx:79`), `text-[16px]` (mobile inputs, iOS-zoom guard), `text-[9px]` (badges). No extensible type scale; similar "label" roles use 3 different sizes.
- **Other arbitrary values.** Second hex `#e3eaf3` (used once, `ContextStrip.tsx:40`); `max-w-[180px]`/`max-w-[200px]` (sibling table cells, `OrderLineTable.tsx`); `w-[360px]` sidebar (`ManagerPage.tsx:381`); custom shadow `shadow-[0_-4px_6px_-1px_…]` (`StickyActionBar.tsx:39`).
- **Radius/elevation ad-hoc.** `rounded-lg` dominant (48×) but ProductCard uses `rounded-xl` with no rule; shadows almost decorative (4 uses + 1 custom), no elevation hierarchy.
- **Focus-ring variants.** `ring-blue-500` (standard, 12+×) but also `ring-blue-200` (low-contrast, `AuthGate.tsx:83`), `ring-blue-400`, `ring-amber-500`, `ring-green-500`, `ring-sky-500`.
- **Component-vocabulary drift** (same concept, different styles):
  - **Primary button**: `blue-700` vs `#1a4480`.
  - **CRITICAL flag**: solid `bg-red-600 text-white` (`ProductCard.tsx:132`) vs pale `bg-red-100 text-red-700` (`CaptainPage.tsx:107`) vs icon-only (`OrderLineTable.tsx:120`).
  - **Inputs**: AuthGate `py-2 text-base slate-300` vs ProductCard `py-3 text-[16px] gray-300` — same semantic input, different look + sub-44px tap target on AuthGate.
  - **Badges**: count/status/reason badges use 3–5 padding/size variants (`text-[9px]`/`[10px]`/`[11px]`).

(Full inventory + top-10 ranked inconsistencies in the token-audit reader output; evidence above is the load-bearing subset.)

### Cluster 2 — First impression / AuthGate + logo animation

- **`AuthGate.tsx:67-99`**: full-screen `bg-black/50` backdrop over an un-rendered page (reads as an error modal, not a welcome) → white `max-w-sm` card → functional heading "Wpisz kod miejsca" (`strings.ts:219`) → password input → navy submit. **No logo, no wordmark, no product name.**
- **Logo-animation landing spot**: this card header is the natural slot. Constraints discovered: must honor the global reduced-motion reset (`index.css:26`); the app has no animation library today (so the animation = inline SVG + CSS keyframes or a small Framer-Motion addition); owner will supply an SVG.
- **Secondary AuthGate issues**: submit button `py-2` (`AuthGate.tsx:93`) is sub-44px (rest of app uses `py-3`); the persistence note (`strings.ts:250`) is developer-facing copy (`.env` paste formats) on an end-user screen; uses older `focus:` rather than `focus-visible:`.

### Cluster 3 — Per-screen visual/UX (Captain, mobile-first)

- **CaptainMP (`/captain-v2`)** — the polished core. Strong: 3-column Current/Suggested/Order grid, thumb-reachable navy "Wyślij" in `StickyActionBar`, comprehensive states (skeleton/empty/error/toast/draft/prefill/all-at-target). **Weak: the PRD's signature "visible math" is the smallest, lowest-contrast text on the card** — `card.targetLine` "target·max·1 PU=N IU" is `text-xs text-slate-600` (`ProductCard.tsx:138`); the "brakuje {base} → {purchase}" math is `text-xs` inside the suggestion button (`:213`). The "Sugestia ↓" tap-to-fill button reads as a static info box (under-signaled tappability, `:181`). Hidden-scrollbar rails (`Header.tsx:34`, `SupplierPicker.tsx:37`) hide off-screen suppliers with no cue. **No send-back banner on the submit screen** (only on detail/edit).
- **InventoryCountPage** — collapsible category sections with counted/total pills (good progress sensing). **Weak: the core "blank = not counted, 0 = real zero" rule is never explained in the UI** (`:314-318`); inputs are `py-2` (sub-44px); plain "Ładowanie…" text instead of `SkeletonCard`; the sticky bottom bar is a hand-rolled clone of `StickyActionBar` (`:447-492`).
- **OrdersListPage** — generous tap rows, well-differentiated status pills. **Weak: shows PLN to the Captain** (`:99`) — contradicts the deliberate "hide money from captain" decision (`ConfirmSubmitDialog.tsx:11`); hardcoded "poz." literal bypasses i18n (`:99`); bespoke back-header instead of shared `Header` (loses context pills + hamburger).
- **OrderDetailPage** — strong hierarchy, prominent amber send-back banner. **Weak: raw reason enum shown to user** ("EVENT_HIGH_TRAFFIC", `:180`) instead of `t("reason.codes.*")`; deviation threshold here is 5% (`:164`) vs the order screen's 20% (`compute.ts:102`); PLN shown to Captain (`:100`).
- **OrderEditPage** — reuses `ProductCard` + `StickyActionBar` (good), skeleton loading. **Weak: dead "Szkic" button** renders enabled but is a no-op in edit mode (`:273-275`); `lineToItem` synthesizes `max=0` so the card shows "max 0" misleadingly (`:39`).

### Cluster 4 — Per-screen visual/UX (Manager, desktop-first)

- **ManagerPage** two-pane shell (`lg:w-[360px]` queue + `flex-1` detail). **Weak: toast lacks `aria-live`** (`:328-330`); `window.prompt`/`window.confirm` for release reason + discard (`:131,:202`) — the send-back reason the Captain reads goes through an unstyled one-line OS prompt; Refresh has no "refreshing" feedback.
- **ManagerQueue** — the cleverest signal in the app (deviation badge + reasons-covered green/amber badge, `:157-179`). **Weak: critical-product flag is invisible in the queue** — a dispatch-triage screen can't tell which orders contain critical SKUs without opening each (`:130-190`); lane collapse state is local and overlaps the FilterBar status chips (dual uncoordinated control).
- **ManagerFilterBar** — labeled supplier select + `aria-pressed` status chips. **Weak: inactive chip `text-slate-400` reads as disabled, not "toggled off"** (`:82`); duplicates the queue's collapse mechanism; no location filter (single-location pilot, but a gap vs FR-014).
- **OrderDetailPane** — solid action state machine (claim/release/dispatch by status). **Weak: the "sticky" Save has no scroll container so it scrolls away on long orders** (`:171`); Release + Dispatch render as two stacked bordered bars (split primary decision); cutoff-past is color-only red (`:125`); the session-only `dispatchedEmailUrl` disappears on reload (`:238`).
- **OrderLineTable** — 11-column editable table. **Weak: zero responsive classes** (`:75-264`) — the editable qty/comment cells (the actual work) are off-screen on tablet/phone; no `<th scope>`/`<caption>`, generic input `aria-label`s; Δ columns color-only; clearing the number field snaps to 0 (= cancelled).
- **DispatchPanel** — strong editable email-draft preview (textarea = live Gmail URL). **Weak: the Gmail `<a>` couples navigation with the dispatch write** without `preventDefault` (`:285-287`) — a blocked popup/middle-click marks the order `manager_sent` with no email opened (silent "ordered but never sent"); no char counter despite the 8000-char limit (the "Otwórz w Gmail" CTA silently vanishes when over); body seeded once on mount, goes stale if a line qty changes after opening (manual "Odśwież" only).

### Cluster 5 — Component fragmentation / shared vocabulary

| Shared asset | Used by | Opt-out / drift |
|---|---|---|
| `Header` (context pills + hamburger) | CaptainMP, InventoryCount | list/detail/edit roll **bespoke** back-headers |
| `StickyActionBar` | CaptainMP, OrderEdit | InventoryCount **hand-clones** the layout (`:447-492`) |
| `SkeletonCard` | CaptainMP, OrderEdit | list/detail/inventory use plain "Ładowanie…" text |
| `ConfirmSubmitDialog` | order | inventory defines a near-identical `ConfirmApproveDialog` inline |
| Brand `#1a4480` | every screen | raw hex ~13×, no token, no logo anywhere |
| `py-3` (~44px) tap target | most buttons | violated by AuthGate + inventory inputs (`py-2`) |

### Cluster 6 — Accessibility

- **Good baseline**: `focus-visible:` used broadly in pages (23 in Manager files alone); `aria-hidden` ×47 on decorative icons, `aria-label` ×18, `aria-expanded`/`aria-pressed`/`aria-current` present; global reduced-motion reset.
- **Gaps**: Manager toast `role="status"` without `aria-live` (`ManagerPage.tsx:328`); OrderLineTable no `<th scope>`/`<caption>` + generic input labels (`:80-84,:202,:236`); color-only Δ and cutoff-past states; AuthGate/ErrorBoundary use older `focus:` / no focus ring; `NotFound` hardcoded English **and leaks `BASE_URL`** publicly (`App.tsx:18-21`); ErrorBoundary hardcoded Polish (deliberate — sits above contexts); language switcher only in Captain hamburger (Manager can't switch).

### Cluster 7 — Correctness-/product-adjacent (need an OWNER decision, not a silent redesign)

These surfaced in the visual audit but are product decisions. Flagging for the plan's "Open Questions" — do NOT design them away unilaterally:

1. **Money visibility to Captain** — list/detail show PLN (`OrdersListPage.tsx:99`, `OrderDetailPage.tsx:100`) while the submit dialog deliberately hides it (`ConfirmSubmitDialog.tsx:11`). Pick one policy.
2. **"Blank = not counted, 0 = real zero"** — never explained on the inventory screen; a Captain meaning "I have none" will leave it blank and silently drop the line. Needs UI copy (and maybe an explicit "0" vs "skip" affordance).
3. **Gmail dispatch coupling** — "open draft" and "mark sent" are one click; a blocked popup = order marked sent, no email. Touches the PRD guardrail "no path loses the order." Likely a real fix, not just design.
4. **Raw reason enum leak** (`OrderDetailPage.tsx:180`) and **hardcoded "poz."** (`OrdersListPage.tsx:99`) — i18n correctness, trivially fixable.
5. **Deviation-threshold mismatch** — 5% on detail vs 20% on order screen — intended or drift?

## Code References

- `frontend/src/index.css:1-33` — Tailwind v4 import; no token layer; tnum; reduced-motion reset
- `frontend/src/App.tsx:15-104` — routing, NotFound (EN + BASE_URL leak), per-route AuthGate
- `frontend/src/AuthGate.tsx:67-99` — first-impression modal (no branding), `py-2` submit
- `frontend/src/pages/captain-mp/components/ProductCard.tsx:120-280` — order card; visible-math as smallest text; `gray-*` palette; CRITICAL solid pill
- `frontend/src/pages/captain-mp/components/Header.tsx:28-34` — duplicated `#1a4480` header; hide-scrollbar rail
- `frontend/src/pages/captain-mp/components/StickyActionBar.tsx:39,65-83` — custom shadow; navy button; cloned by InventoryCount
- `frontend/src/pages/captain-mp/InventoryCountPage.tsx:314-318,447-492` — unexplained blank-rule; hand-cloned bottom bar
- `frontend/src/pages/captain-mp/OrdersListPage.tsx:37-112` — bespoke header; PLN to Captain; "poz." literal
- `frontend/src/pages/captain-mp/OrderDetailPage.tsx:100,164,180` — PLN; 5% threshold; raw reason enum
- `frontend/src/pages/captain-mp/OrderEditPage.tsx:39,273-275` — synthetic max=0; dead Szkic button
- `frontend/src/pages/ManagerPage.tsx:131,202,328-363` — window.prompt/confirm; toast no aria-live; inline header
- `frontend/src/pages/manager/ManagerQueue.tsx:130-190` — clever deviation/reasons badges; no critical flag
- `frontend/src/pages/manager/ManagerFilterBar.tsx:71-88` — status chips overlap queue collapse; low-contrast inactive
- `frontend/src/pages/manager/OrderDetailPane.tsx:125,171,207-216` — color-only cutoff; broken sticky Save; stacked action bars
- `frontend/src/pages/manager/OrderLineTable.tsx:75-264` — 11 columns, zero responsive classes; a11y gaps
- `frontend/src/pages/manager/DispatchPanel.tsx:205-313` — editable email preview; nav+write coupling; stale body; no char counter
- `frontend/src/i18n/index.ts`, `strings.ts` — fully bilingual flat namespaced STRINGS; PL default; missing-key warn-and-fallback
- `frontend/src/ErrorBoundary.tsx` — top-level fallback; hardcoded PL; no focus rings

## Architecture Insights

- The frontend already has the *ingredients* of a design system (one icon lib, focus-visible, bilingual strings, statusVisual map, tnum, reduced-motion reset) — what's missing is the **token + shell abstraction layer**. A tokens-first pass is therefore cheap and high-leverage: it converts copy-paste constants into a single source of truth without touching page logic.
- **Recommended token layer**: Tailwind v4 `@theme` block in `index.css` (the v4-native way, no config file needed) defining `--color-brand-*` (replacing `#1a4480`), one neutral ramp (pick `slate`, retire `gray`), semantic colors (primary/danger/success/warning/critical), a named type scale (caption/label/body/heading replacing the `[10px]` family), radius + elevation tokens. Then a minimal component set: `Button` (primary/secondary/danger/success variants), `Input`, `Badge`, `Card`, `Banner`, and a shared `<AppHeader>`.
- **Mobile vs desktop split is real**: Captain screens are mobile-first (phone/tablet, daily repeated use) — tap targets, visible math, scannability dominate. Manager is desktop-first — the 11-column table is the standout responsive debt.
- **The reduced-motion reset is a feature, not a constraint**: the logo animation should be authored to degrade through it (it already will, globally).

## Historical Context (from prior changes)

- The collapsible inventory category sections audited here were shipped in `context/archive/2026-06-07-inventory-category-sections/` — this audit treats the result as current state, not new work.
- `context/foundation/lessons.md`: "Keep skill-managed artifacts in English" (this doc complies); "Mirror Pydantic optionality in TS" (not design-relevant but noted). No design-specific lessons exist yet — a tokens-first rule is a candidate `/10x-lesson` output.

## Open Questions (to resolve WITH the owner during /10x-plan)

1. **Scope of the parent change**: is `screens-design-audit` only the **audit + tokens + proposals** (then each screen ships as a separate gated change), or does it also implement Phase-1 (tokens + shared header + AuthGate logo)? Recommended: audit + token foundation + AuthGate-with-logo in this change; per-screen visual work as follow-up changes.
2. **Cluster-7 product decisions** (money visibility, blank-rule, Gmail coupling, reason-enum, threshold) — which are in scope here vs spun off? Several are bug-shaped, not design.
3. **Benchmark input**: pull Mobbin references (B2B dashboards / queue-triage / inventory-checklist) before proposing, or proceed on heuristics + live screenshots?
4. **Logo animation brief**: motion style (draw-on / fade-scale / morph), duration (≤0.8–1s, once per session — recommended), and whether it doubles as the post-auth loading state.

## Pending inputs (for the plan/implement phase)

- **Owner**: start `npm run dev` locally so red-line screenshots can be captured (chosen source); provide the **logo SVG**.
- **Optional**: Mobbin reference pulls (owner-side; premium login).

## Related Research

- None prior for frontend design. This is the first design-focused research artifact under `context/changes/`.
