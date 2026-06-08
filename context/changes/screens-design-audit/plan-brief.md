# Screens Design Audit — Plan Brief

> Full plan: `context/changes/screens-design-audit/plan.md`
> Research: `context/changes/screens-design-audit/research.md`

## What & Why

The frontend has a strong component core but **no design-system layer** — `index.css` literally says "design tokens live in components," so the brand navy `#1a4480` is a raw hex repeated ~13×, two neutral palettes are used interchangeably, 27 arbitrary font sizes float around, and every page rolls its own header. This change lays the tokens-first foundation and brands the first-impression screen (AuthGate) with a logo animation, fixing the root cause centrally before any per-screen rework.

## Starting Point

Tailwind v4 (no config, no `@theme`), React 19 + Vite 7, TS strict off, no frontend test runner. Good substrate already exists (one icon lib, `focus-visible`, fully bilingual strings, global reduced-motion reset, `tnum`, a shared `statusVisual` map) — the inconsistency lives entirely at the shell/token layer, which is why this is cheap and high-leverage.

## Desired End State

A token layer in `index.css` (zero raw brand hex left in `src/`); a small token-based component set (`Button/Input/Badge/Card/Banner`) + a shared `<AppHeader>` powering both role headers with no visual regression; a branded AuthGate with a draw-on logo (once per session, reduced-motion-safe); two i18n leaks fixed; and red-line + Tailwind-static proposals seeding the spun-off per-screen changes. The app looks identical to today except a branded AuthGate and two translated strings. No deploy.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Root fix | Tokens-first via Tailwind v4 `@theme` | All inconsistency traces to the missing token layer | Research |
| Fidelity | Red-line + Tailwind-static prototypes | Realistic, same stack, zero prod risk | Plan |
| Blast-radius | Surgical: tokens + AppHeader + AuthGate; global hex→token alias (no-op) | Each screen verified in its own change; minimal regression risk | Plan |
| Cluster-7 | Trivial i18n here; money/blank/Gmail flagged separately | Those are product/bug decisions, not styling | Plan |
| Logo | Draw-on stroke, ≤1s, once/session, reduced-motion; placeholder now | Cleanest for SVG, doesn't block on the real asset | Plan |
| Proposals breadth | 3 priority screens full + template; rest short red-line | Avoids mocking 7 screens at once | Plan |
| Proto location | `frontend/design-proto/` scratch (Tailwind CDN, unrouted) | Zero prod-build coupling | Plan |

## Scope

**In scope:** token layer; base UI components + shared AppHeader; AuthGate rebrand + logo animation; global brand-hex→token alias; two trivial i18n fixes; design proposals (3 priority prototypes + spec) + Cluster-7 flagging.

**Out of scope:** per-screen visual rework (spun off, gated); slate/gray unification; Cluster-7 product changes; deploy; animation library; dependence on the real logo SVG.

## Architecture / Approach

Bottom-up and surgical: define tokens (`@theme`) → build component vocabulary + shared header on top, rewiring only the two existing headers → brand the AuthGate → i18n fixes → proposals + flagging. Only cross-phase dependency is Phase 1's tokens feeding Phases 2-3. Everything is additive; existing screens keep their utilities until their own changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Token Layer | `@theme` tokens + global hex→token alias | Alias must be a true visual no-op |
| 2. Components + AppHeader | `Button/Input/Badge/Card/Banner` + shared header | Header parity across both roles |
| 3. AuthGate + Logo | Branded first screen, draw-on animation | Session-gate + reduced-motion behavior |
| 4. i18n fixes | Translated reason label + "items" string | Trivial |
| 5. Proposals + Flagging | 3 prototypes + spec + Cluster-7 chips | Keeping proto out of the build graph |

**Prerequisites:** local `npm run dev` (owner) for Phase 5 red-line screenshots; real logo SVG eventually (placeholder unblocks). Build/lint need Homebrew node on PATH.
**Estimated effort:** ~3-4 sessions across 5 phases.

## Open Risks & Assumptions

- The brand alias is assumed pixel-identical — must be eyeballed on AuthGate + both headers before trusting it.
- No frontend test runner → all visual verification is manual via `npm run dev`; automated = build + lint only.
- Logo animation ships on a placeholder; the real SVG is a later asset swap.

## Success Criteria (Summary)

- `npm run build` + `npm run lint` pass each phase; no raw `#1a4480`/`#e3eaf3` left in `src/`.
- App is visually unchanged except a branded AuthGate (logo draws once/session, static under reduce-motion) and two translated strings; both headers render through one `<AppHeader>` with no regression.
- `frontend/design-proto/` prototypes open standalone; `proposals.md` is a usable spin-off spec; three Cluster-7 decisions are flagged as chips.
