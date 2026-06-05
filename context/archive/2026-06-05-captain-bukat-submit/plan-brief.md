# S-01 Captain submits a Bukat order — Plan Brief

> Full plan: `context/changes/captain-bukat-submit/plan.md`
> Research: `context/changes/captain-bukat-submit/research.md`

## What & Why

Make the live Captain pilot screen (`/captain-v2`) **default to Bukat** so a Wola captain can complete a stock-based Bukat order end-to-end. Today the screen auto-selects the first supplier in CSV order (`SUP_BLUESERV`, 0 products at Wola), dropping the captain on an empty view — the one real gap blocking S-01.

## Starting Point

Backend, master data (F-01, done), and the submit path are already Bukat-ready: `SUP_BUKAT` is active with 14 supplier_products and 14/14 Wola settings, and the captain submit endpoint is fully supplier-agnostic. The live `/captain-v2` flow (`CaptainMP.tsx`) selects suppliers dynamically — its only Pago-era assumption is the `suppliers[0]` initial default.

## Desired End State

Opening `/captain-v2` lands on Bukat with its 14 product lines and visible suggestion math; the captain enters stock and submits, and (in sheet mode) the order appears on the Manager queue the same session. If the pilot supplier is ever absent, the screen degrades safely to today's `suppliers[0]`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Default-supplier fix | Default-select Bukat via a named pilot constant (`PILOT_SUPPLIER_ID`) with `suppliers[0]` fallback | Leanest one-file change that lands the pilot flow and is trivially retargetable | Plan |
| Legacy Pago hardcodes | Leave as-is (out of scope) | They sit on the non-pilot `/captain` + `/debug` routes; harmless | Plan |
| Test strategy | Manual sheet-mode smoke only (submit-and-back-out) | No FE test runner exists; backend gates already covered generically | Plan |
| FE/BE suggestion parity | Leave FE always-ceil; note divergence for S-09 | Agrees with the backend for all Bukat SKUs (full_only) today; zero risk | Research |

## Scope

**In scope:** the `CaptainMP.tsx` initial-selection change (Bukat-default + fallback); a one-line `compute.ts` comment pointing the FE/BE rounding divergence at S-09; manual sheet-mode validation.

**Out of scope:** backend/data/seam changes; legacy `SUP_PAGO` cleanup; hiding empty suppliers; automated tests / `conftest.py`; resolving the FE/BE rounding divergence (S-09).

## Architecture / Approach

A named pilot-supplier constant drives the **initial** selection only: pick the supplier matching `PILOT_SUPPLIER_ID` if present in the fetched list, else `suppliers[0]`. Everything downstream (dynamic picker, per-supplier draft persistence, post-submit auto-advance, the supplier-agnostic backend submit) is untouched. No new network calls.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Default the Captain pilot to Bukat | `/captain-v2` lands on Bukat (14 lines) + S-09 note; validated by sheet-mode smoke | Regressing the safe fallback, or running the e2e leg in seed mode (queue stays empty) |

**Prerequisites:** F-01 done (Bukat data correct ✓); sheet-mode env + editor SA available locally (✓ set up this session) for the e2e smoke.
**Estimated effort:** ~1 short session (one-file edit + manual smoke).

## Open Risks & Assumptions

- The e2e "appears on the Manager queue" leg only holds in **sheet mode**; the smoke must run there and **back out** (delete the test order; never dispatch — no real supplier order).
- Frontend has no automated coverage, so the change relies on manual verification (build/lint/tsc catch only compile/lint regressions).
- Visible-math is Tier-1 (must not regress) — the change doesn't touch it, but confirm it still renders during the smoke.

## Success Criteria (Summary)

- A Wola captain opening `/captain-v2` sees Bukat selected with 14 lines and visible math — no empty default screen.
- A Bukat submit reaches the Manager queue same-session (sheet mode), then is cleanly backed out with no dispatch.
- Frontend build + lint and the backend pytest suite stay green.
