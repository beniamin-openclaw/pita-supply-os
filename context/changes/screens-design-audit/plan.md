# Screens Design Audit — Tokens-First Foundation + Branded AuthGate Implementation Plan

## Overview

Establish a design-system foundation for the Pita Supply OS frontend (React 19 + Vite 7 + Tailwind v4) and brand the first-impression screen, fixing the audit's root cause — **there is no token layer** (`index.css:3` literally says "design tokens live in components"). This change ships the foundation (tokens, base components, shared header, branded AuthGate with a logo animation) and trivial i18n fixes; the per-screen visual rework and Cluster-7 product decisions are deliberately spun off into separate gated changes. **No deploy** — everything lands on a branch for owner approval (deploy is a separate, manual step).

## Current State Analysis

From `context/changes/screens-design-audit/research.md` (full audit by three parallel readers):

- **No token layer.** Tailwind v4 with **no `tailwind.config.*` and no `@theme`**. Brand navy `#1a4480` is a raw hex repeated **~13×**; a second hex `#e3eaf3` once; a custom shadow `shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]` once.
- **Dual neutral palettes** (`slate-*` dominant vs `gray-*` in ProductCard) and **27 arbitrary font sizes** (`text-[10px]/[11px]/[16px]/[9px]`).
- **No shared header** — `captain-mp/components/Header.tsx:28-30` and `ManagerPage.tsx:340-363` independently re-declare the same `bg-[#1a4480] text-white` chrome. No `components/` directory exists yet.
- **AuthGate** (`AuthGate.tsx:67-99`) is an unbranded password modal on a `bg-black/50` void — no logo/wordmark; submit button `py-2` (sub-44px); developer-facing persistence copy (`strings.ts:250`).
- **Strong substrate already present**: one icon lib (`lucide-react`), `focus-visible` across pages, fully bilingual `STRINGS` (`strings.ts`), global `prefers-reduced-motion` reset (`index.css:26-33`), global `tnum`, a shared `statusVisual` map. The inconsistency is concentrated at the shell/token layer, so a tokens-first pass is cheap and high-leverage.
- **Two trivial i18n leaks** in scope: raw reason enum shown to the user (`OrderDetailPage.tsx:180`) and a hardcoded "poz." literal (`OrdersListPage.tsx:99`).

### Key Discoveries

- Tailwind v4 supports a config-free `@theme` block in CSS — the v4-native way to define tokens (no `tailwind.config.js` needed). `index.css:1` already does `@import "tailwindcss"`.
- The brand value `#1a4480` must be preserved exactly so the global hex→token alias is a **visual no-op** (surgical blast-radius decision).
- The global reduced-motion reset (`index.css:26-33`) already neutralizes `animation-duration`/`transition-duration` — so a CSS-keyframe draw-on logo degrades automatically; no extra guard logic needed beyond authoring it as a CSS animation.
- Reason-code i18n keys already exist (`reason.codes.*`, used by `ReasonPicker`) — the OrderDetailPage fix is a lookup, not new copy.
- TypeScript `strict` is OFF (`tsconfig.app.json`) — new components must carry explicit prop/return types (per `frontend/AGENTS.md`).
- Frontend has **no test runner** — automated verification = `npm run build` (tsc + vite) + `npm run lint`; everything else is manual via `npm run dev`.

## Desired End State

- `index.css` carries an `@theme` token layer; **zero raw `#1a4480`/`#e3eaf3` hex** remain in `src/`.
- A small token-based component set (`Button`, `Input`, `Badge`, `Card`, `Banner`) + a shared `<AppHeader>` exist under `frontend/src/components/ui/`; the Captain header and Manager header both render through `AppHeader` with no visual regression.
- The AuthGate shows branding + a draw-on logo (placeholder asset, swappable for the real SVG), animates once per session, honors reduced-motion, and meets the 44px tap-target standard.
- The two trivial i18n leaks are fixed.
- `frontend/design-proto/` holds self-contained Tailwind-static "after" prototypes for the 3 highest-impact screens, `proposals.md` holds red-line findings + a token-application template for spin-offs, and `notes/cluster-7.md` + background-task chips capture the 3 deferred product decisions.

Verify: `npm run build` + `npm run lint` pass; the app looks identical to today except AuthGate (now branded) and the two i18n strings; design-proto files open standalone in a browser.

## What We're NOT Doing

- **No per-screen visual rework** beyond the surgical rewiring (AuthGate + the two headers). ProductCard, OrderLineTable, ManagerQueue, OrdersList/Detail/Edit, InventoryCount, DispatchPanel keep their current utilities until their own gated changes — this change only produces their *proposals*.
- **No slate/gray unification** in code (it changes pixels) — deferred to per-screen changes.
- **No Cluster-7 product changes** (money visibility to Captain, "blank = not counted" affordance, Gmail open-draft/mark-sent coupling) — flagged as separate work, not implemented here.
- **No deploy / no prod change.** Branch only.
- **No Lottie/Rive / no animation library.** The logo is inline SVG + CSS keyframes.
- **No real logo SVG dependency** for this change — a placeholder wordmark is used; the real SVG is a later one-line asset swap.

## Implementation Approach

Tokens-first, bottom-up, surgical. Define the token layer (Phase 1) → build the component vocabulary + shared header on top of it and rewire only the two headers (Phase 2) → brand the AuthGate with the logo animation (Phase 3) → trivial i18n fixes (Phase 4) → produce the design proposals + flag the deferred product decisions (Phase 5). Each phase is independently buildable and verifiable; the only cross-phase dependency is Phase 1's tokens feeding Phases 2-3.

## Critical Implementation Details

- **Brand alias is a visual no-op.** Define `--color-brand` = `#1a4480` exactly; the global utility swap (`bg-[#1a4480]`→`bg-brand`) must not shift any pixel. Confirm with a before/after look at AuthGate + both headers + supplier chips.
- **Logo draw-on, once per session, reduced-motion-safe.** Author the reveal as a CSS `@keyframes` stroke draw (`stroke-dashoffset`). Gate "first time this session" via a `sessionStorage` flag so re-opening the modal (e.g. after a 401) shows the static logo, not a re-animation. The global `prefers-reduced-motion` reset already collapses the animation to ~instant — do not add a second JS guard for motion preference.
- **design-proto isolation.** Files live in `frontend/design-proto/` (outside `src/`, so outside `tsconfig` `include` and the Vite entry graph). Make each a self-contained `.html` using the Tailwind Play CDN (`<script src="https://cdn.tailwindcss.com">`) so it renders standalone with zero coupling to the app build. They must never be imported from `src/`.

## Phase 1: Token Layer

### Overview

Introduce a config-free `@theme` token layer in `index.css` and retire all raw hex/custom-value utilities via a visually-identical alias swap.

### Changes Required:

#### 1. Token definitions

**File**: `frontend/src/index.css`

**Intent**: Create the single source of truth for color, type, radius, and elevation that the rest of the system references — the audit's root-cause fix.

**Contract**: Add a Tailwind v4 `@theme { … }` block defining: `--color-brand` (= `#1a4480`) + `--color-brand-hover` (a darker step); semantic colors `--color-primary` (brand), `--color-danger`, `--color-success`, `--color-warning`, `--color-critical`; a canonical neutral alias set mapped to the existing slate ramp (`--color-surface`, `--color-border`, `--color-muted`, `--color-text`); a named type scale replacing the arbitrary family (e.g. `--text-caption: 0.6875rem` (11px), `--text-label`, `--text-input: 1rem` (16px, iOS-zoom guard)); `--radius-card`; `--shadow-bar` (= the StickyActionBar custom shadow). Preserve the existing `tnum` and reduced-motion blocks. Do not change the slate/gray usage elsewhere — only define tokens here.

#### 2. Global hex/custom-value → token alias

**File**: every `src/` file using `[#1a4480]` (`captain-mp/components/Header.tsx`, `StickyActionBar.tsx`, `SupplierPicker.tsx`, `ManagerPage.tsx`, `OrderDetailPane.tsx`, `OrderEditPage.tsx`, …), `[#e3eaf3]` (`ContextStrip.tsx:40`), and the custom shadow (`StickyActionBar.tsx:39`)

**Intent**: Remove the raw-hex debt so brand color lives in one place.

**Contract**: 1:1 utility swap (`bg-[#1a4480]`→`bg-brand`, `active:bg-blue-900` left as-is unless it maps to `brand-hover`, `bg-[#e3eaf3]`→a `surface` token utility, `shadow-[0_-4px…]`→`shadow-bar`). Zero visual change. No structural edits (headers are restructured in Phase 2).

### Success Criteria:

#### Automated Verification:

- Build passes: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`
- No raw brand hex remains: `! grep -rn "#1a4480\|#e3eaf3" frontend/src`

#### Manual Verification:

- AuthGate, Captain header, Manager header, and supplier chips render visually identical to before the swap (token alias = same value).

---

## Phase 2: Base Components + Shared AppHeader

### Overview

Codify the recurring component vocabulary as token-based primitives and extract the duplicated brand header into one `<AppHeader>`, rewiring only the two existing headers.

### Changes Required:

#### 1. UI primitives

**File**: `frontend/src/components/ui/Button.tsx`, `Input.tsx`, `Badge.tsx`, `Card.tsx`, `Banner.tsx` (new `components/ui/` directory)

**Intent**: One source of truth for buttons/inputs/badges/cards/banners so spin-off per-screen changes adopt consistent, token-driven components instead of re-inventing class strings.

**Contract**: Explicit TS prop types + return types (strict is off). `Button` variants `primary | secondary | danger | success` + size (default tap target ≥44px / `py-3`); `Banner` tones `error | warning | info | success`; `Badge` tones; `Card`; `Input` (text/number) with the focus-visible ring token. These are **additive** — existing screens are not rewired to them in this change (surgical scope).

#### 2. Shared AppHeader

**File**: `frontend/src/components/ui/AppHeader.tsx` (new); rewire `frontend/src/pages/captain-mp/components/Header.tsx` and the inline header in `frontend/src/pages/ManagerPage.tsx:340-363`

**Intent**: Replace the copy-pasted `bg-brand text-white` chrome with one shared header.

**Contract**: `AppHeader` renders the brand bar (token bg, height, padding, white text) and exposes slots — a title/brand area, an `actions` slot (Manager: Refresh + Logout), and `children` (Captain: the hamburger + context-pill rail, preserving the `hide-scrollbar` behavior). Captain `Header.tsx` and the Manager header both render through it. Visual parity with today is required; no other screen changes.

### Success Criteria:

#### Automated Verification:

- Build passes: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`

#### Manual Verification:

- Captain header (context pills + hamburger + horizontal rail) renders identical to before.
- Manager header (title + Refresh + Logout) renders identical to before.
- Order / inventory / manager screens show no regression.

---

## Phase 3: AuthGate Rebrand + Logo Draw-On Animation

### Overview

Turn the bare token modal into a branded first impression with a draw-on logo, and fix its tap-target + copy debts.

### Changes Required:

#### 1. Branding + logo animation

**File**: `frontend/src/AuthGate.tsx`; new `frontend/src/components/ui/Logo.tsx` (placeholder); `frontend/src/index.css` (keyframe)

**Intent**: Brand the first screen a Captain sees and give it a tasteful, restrained logo reveal.

**Contract**: Inline SVG logo (placeholder "PITA BROS" wordmark/mark) with a stroke draw-on animation defined as `@keyframes` in `index.css`; animation runs once per session (gated by a `sessionStorage` flag), ≤~1s; the global reduced-motion reset collapses it automatically. Soften the backdrop so it reads as a welcome, not an error modal. Snippet (the non-obvious session gate + keyframe shape):

```
/* index.css */
@keyframes logo-draw { from { stroke-dashoffset: var(--logo-len); } to { stroke-dashoffset: 0; } }
.logo-draw path { stroke-dasharray: var(--logo-len); animation: logo-draw .9s ease forwards; }
// AuthGate: const animate = !sessionStorage.getItem("logo_shown"); on first mount set it.
```

#### 2. Tap target + copy

**File**: `frontend/src/AuthGate.tsx` (use the `Button` primitive / `py-3`); `frontend/src/i18n/strings.ts` (`auth.persistence`)

**Intent**: Meet the 44px standard and replace developer-facing copy with end-user copy.

**Contract**: Submit control ≥44px (via `Button`); reword `auth.persistence` (pl + en) to a plain user sentence (drop the `.env` paste-format instructions).

### Success Criteria:

#### Automated Verification:

- Build passes: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`

#### Manual Verification:

- Logo draws once on the first AuthGate of a session; re-opening (e.g. after a 401) shows it static.
- With OS "reduce motion" on, the logo is static (no draw).
- Submit control is ≥44px; persistence copy is user-facing; backdrop reads as a welcome.

---

## Phase 4: Trivial i18n Fixes

### Overview

Fix the two in-scope i18n leaks surfaced by the audit (Cluster-7 trivial subset).

### Changes Required:

#### 1. Translated reason code on OrderDetailPage

**File**: `frontend/src/pages/captain-mp/OrderDetailPage.tsx:180`

**Intent**: Show the translated reason label instead of the raw enum.

**Contract**: Render `t("reason.codes." + line.reason_code)` (keys already exist, used by `ReasonPicker`).

#### 2. i18n the "poz." literal on OrdersListPage

**File**: `frontend/src/pages/captain-mp/OrdersListPage.tsx:99`; `frontend/src/i18n/strings.ts`

**Intent**: Move the hardcoded Polish literal into i18n.

**Contract**: New key (e.g. `orders.linesShort`, pl "poz." / en "items"); the list uses `t(...)`.

### Success Criteria:

#### Automated Verification:

- Build passes: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`
- No raw reason enum / literal remains: `! grep -n "reason_code}" frontend/src/pages/captain-mp/OrderDetailPage.tsx && ! grep -n "poz\." frontend/src/pages/captain-mp/OrdersListPage.tsx`

#### Manual Verification:

- OrderDetail shows a translated reason; OrdersList shows the i18n label; switching to EN translates both.

---

## Phase 5: Design Proposals + Cluster-7 Flagging

### Overview

Produce the red-line + Tailwind-static proposals that seed the spun-off per-screen changes, and formally flag the three deferred product decisions.

### Changes Required:

#### 1. Priority screen prototypes

**File**: `frontend/design-proto/product-card.html`, `order-line-table.html`, `manager-queue.html` (new scratch dir, outside `src/`)

**Intent**: Self-contained "after" prototypes for the three highest-impact screens, applying the new tokens — the visual template spin-offs copy.

**Contract**: Standalone HTML using the Tailwind Play CDN; not routed, not imported from `src/`, not in the prod build. Each demonstrates: ProductCard with promoted visible-math; OrderLineTable with a responsive card fallback below `md`; ManagerQueue card with a surfaced critical-product flag.

#### 2. Proposals doc + token-application template

**File**: `context/changes/screens-design-audit/proposals.md`

**Intent**: One red-line spec for all screens — full red-line for the 3 priority screens (linking the prototypes), short findings lists for the rest — plus a worked "how to apply tokens + components" example for spin-offs.

**Contract**: Markdown; references `research.md` findings with file:line; each non-priority screen gets a short ranked findings list.

#### 3. Cluster-7 flags

**File**: `context/changes/screens-design-audit/notes/cluster-7.md`; plus background-task chips

**Intent**: Capture the deferred product decisions so they aren't lost.

**Contract**: One section each for money-visibility (`OrdersListPage.tsx:99` / `OrderDetailPage.tsx:100` vs `ConfirmSubmitDialog.tsx:11`), "blank = not counted / 0 = real zero" (`InventoryCountPage.tsx:314-318`), and Gmail open-draft/mark-sent coupling (`DispatchPanel.tsx:285-287`) — each with problem, evidence, and options. Spawn one `spawn_task` chip per item during implementation.

### Success Criteria:

#### Automated Verification:

- Prototypes + docs exist: `ls frontend/design-proto/*.html context/changes/screens-design-audit/proposals.md context/changes/screens-design-audit/notes/cluster-7.md`
- Proto is not in the app build graph: `! grep -rn "design-proto" frontend/src`
- Build still passes: `cd frontend && npm run build`

#### Manual Verification:

- Each prototype opens standalone in a browser and renders the intended "after" state.
- `proposals.md` is a usable spec for the spin-off changes.
- Three Cluster-7 background-task chips are spawned.

---

## Testing Strategy

### Manual Testing Steps (run `cd frontend && npm run dev`; owner starts the dev server):

1. Load `/captain-v2` (AuthGate) in a fresh session → logo draws once; re-open after clearing token → static.
2. Toggle OS reduce-motion → AuthGate logo is static.
3. Compare Captain header + Manager header against the current prod look → identical.
4. Walk order / inventory / orders-list / detail / edit / manager screens → no visual regression.
5. Switch language EN → reason label + "items" translate.
6. Open each `frontend/design-proto/*.html` in a browser → renders the proposed state.

### Automated:

- `cd frontend && npm run build` (tsc + vite) and `npm run lint` after every phase. (No frontend test runner exists — lesson: don't trust a non-existent green signal.)

## Performance Considerations

- Token layer + components add no runtime cost (compile-time utilities). The logo animation is one CSS keyframe, reduced-motion-gated, once per session — negligible. design-proto is excluded from the bundle.

## Migration Notes

- Real logo SVG is a later one-line asset swap into `Logo.tsx` (placeholder ships now). No data/schema involved — frontend-only.
- Build/lint must run with Homebrew node on PATH (`PATH="/opt/homebrew/opt/node/bin:$PATH"`) — the default bundled node breaks rollup.

## References

- Research: `context/changes/screens-design-audit/research.md`
- Token root cause: `frontend/src/index.css:1-33`
- Duplicated header: `frontend/src/pages/captain-mp/components/Header.tsx:28-30`, `frontend/src/pages/ManagerPage.tsx:340-363`
- AuthGate: `frontend/src/AuthGate.tsx:67-99`
- i18n leaks: `frontend/src/pages/captain-mp/OrderDetailPage.tsx:180`, `OrdersListPage.tsx:99`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Token Layer

#### Automated

- [ ] 1.1 Build passes: `cd frontend && npm run build`
- [ ] 1.2 Lint passes: `cd frontend && npm run lint`
- [ ] 1.3 No raw brand hex remains: `! grep -rn "#1a4480\|#e3eaf3" frontend/src`

#### Manual

- [ ] 1.4 AuthGate / both headers / supplier chips render visually identical after the alias swap

### Phase 2: Base Components + Shared AppHeader

#### Automated

- [ ] 2.1 Build passes: `cd frontend && npm run build`
- [ ] 2.2 Lint passes: `cd frontend && npm run lint`

#### Manual

- [ ] 2.3 Captain header (pills + hamburger + rail) renders identical to before
- [ ] 2.4 Manager header (title + Refresh + Logout) renders identical to before
- [ ] 2.5 Order / inventory / manager screens show no regression

### Phase 3: AuthGate Rebrand + Logo Draw-On Animation

#### Automated

- [ ] 3.1 Build passes: `cd frontend && npm run build`
- [ ] 3.2 Lint passes: `cd frontend && npm run lint`

#### Manual

- [ ] 3.3 Logo draws once per session; static on re-open
- [ ] 3.4 Reduce-motion → logo static
- [ ] 3.5 Submit ≥44px; persistence copy user-facing; backdrop reads as welcome

### Phase 4: Trivial i18n Fixes

#### Automated

- [ ] 4.1 Build passes: `cd frontend && npm run build`
- [ ] 4.2 Lint passes: `cd frontend && npm run lint`
- [ ] 4.3 No raw reason enum / "poz." literal remains in the two files

#### Manual

- [ ] 4.4 OrderDetail translated reason; OrdersList i18n label; EN switch translates both

### Phase 5: Design Proposals + Cluster-7 Flagging

#### Automated

- [ ] 5.1 Prototypes + docs exist (`design-proto/*.html`, `proposals.md`, `notes/cluster-7.md`)
- [ ] 5.2 Proto not in app build graph: `! grep -rn "design-proto" frontend/src`
- [ ] 5.3 Build still passes: `cd frontend && npm run build`

#### Manual

- [ ] 5.4 Each prototype opens standalone and renders the proposed state
- [ ] 5.5 `proposals.md` is a usable spec for spin-offs
- [ ] 5.6 Three Cluster-7 background-task chips spawned
