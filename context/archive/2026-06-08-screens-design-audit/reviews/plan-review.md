<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Screens Design Audit — Tokens-First Foundation

- **Plan**: context/changes/screens-design-audit/plan.md
- **Mode**: Deep
- **Date**: 2026-06-08
- **Verdict**: REVISE → SOUND (all 6 findings fixed in triage)
- **Findings**: 0 critical · 3 warnings · 3 observations

## Verdicts (as-reviewed)

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
6/6 paths ✓, tailwind v4.3 ✓, reason.codes keys present ✓, logo SVG fill-only/0-strokes ⚠ (confirms F1), brief↔plan ✓.

## Findings

### F1 — Draw-on logo infeasible on the actual SVG

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — AuthGate logo animation
- **Detail**: Provided logo is fill-only (grep: stroke=0, 8 paths, 103 KB); `stroke-dashoffset` draw-on needs strokable outlines this asset lacks, so the Phase-3 default cannot render. 103 KB inline is also heavy for first paint.
- **Fix A ⭐**: Default to a fill-friendly reveal (fade+scale / clip-path); draw-on only if a stroked variant is supplied.
- **Fix B**: Generate a stroke-outline variant for draw-on.
- **Decision**: FIXED via Fix A — Phase 3 contract + Critical Implementation Details + SC 3.3 now specify fade+scale; SVGO note added.

### F2 — Phase 1 hex-removal check always fails

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Success Criterion 1.3
- **Detail**: `! grep -rn "#1a4480\|#e3eaf3" frontend/src` matches the legitimate `--color-brand: #1a4480` `@theme` definition in index.css, so the gate fails even when correct.
- **Fix**: Check the bracket arbitrary-value usage instead: `! grep -rn '\[#1a4480\]\|\[#e3eaf3\]' frontend/src`.
- **Decision**: FIXED — SC 1.3 + Progress 1.3 updated to the bracket form.

### F3 — design-proto on Tailwind CDN can't use @theme tokens

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 5 — design-proto prototypes
- **Detail**: The Play CDN has no knowledge of the app's `@theme` tokens, so `bg-brand`/`text-caption` won't resolve in standalone proto HTML — prototypes would re-hardcode values and drift from the real implementation.
- **Fix A ⭐**: Inline a `tailwind.config` `<script>` per proto mirroring the tokens.
- **Fix B**: Render proposals behind a dev-only `/design` route.
- **Decision**: FIXED via Fix A — Phase 5 contract + Critical Implementation Details now require an inline CDN theme config mirroring the tokens.

### F4 — Phase 2 builds 5 primitives; change consumes ~1

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Phase 2 — UI primitives
- **Detail**: Button/Input/Badge/Card/Banner are created but only Button (AuthGate) + AppHeader are consumed here; the rest are speculative until a spin-off adopts them.
- **Fix**: Build Button + AppHeader now; defer Input/Badge/Card/Banner to the first spin-off that needs each.
- **Decision**: FIXED — Phase 2 change #1 + Desired End State narrowed to Button now, rest deferred.

### F5 — AppHeader fuses two divergent headers; parity eyeballed

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — Shared AppHeader
- **Detail**: Captain and Manager headers share only the brand bar; one AppHeader risks over-abstraction, and parity is verified only by manual eyeballing (no FE test runner / no baseline).
- **Fix**: Scope AppHeader to the brand-bar chrome only, role content fully slotted; capture a `before` screenshot per header for the manual parity check.
- **Decision**: FIXED — Phase 2 change #2 contract narrowed + screenshot baseline added.

### F6 — Brand alias leaves hover/active as Tailwind blues

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — global alias
- **Detail**: Swap covers `bg-[#1a4480]`→`bg-brand` but brand buttons keep `hover:bg-blue-800`/`active:bg-blue-900` — so brand is only partially tokenized; a rebrand won't reach interaction states.
- **Fix**: Define `--color-brand-hover`/`-active` and map the hover/active utilities in the same swap.
- **Decision**: FIXED — Phase 1 change #1 (token def) + change #2 (alias) now define + map brand-hover/active.

## Triage summary

Fixed: F1 (Fix A), F2, F3 (Fix A), F4, F5, F6 — all 6.
► Verdict after fixes: **SOUND**.
