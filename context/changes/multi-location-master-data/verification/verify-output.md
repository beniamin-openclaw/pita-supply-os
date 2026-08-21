# Verification record — multi-location-master-data (2026-08-22, end of the autonomous run)

Every check run independently by the orchestrator AFTER the final implementer
dispatch, not copied from agent reports.

| Check | Result |
|---|---|
| `python3 -m ruff check .` (supply-os-v1, rules E4/E7/E9/F/I/B/UP) | All checks passed |
| `python3 -m pytest` | **522 passed**, 16 deselected (integration) |
| `npm run build` (tsc -b with `strict: true` + vite) | green, 1648 modules |
| `npx eslint .` | clean |
| `npm run test` (vitest) | **89 passed**, 10 files |
| locked env (clean venv, Python 3.14) full suite | 513 passed at lock time (see C1) |
| locked env (clean venv, Python 3.12 = CI runtime) full suite | 522 passed (implementer, pre-wiring gate) |

Test growth over the run: 453 → 522 (+69: engine 50, emit-sql 9+2 regressions,
quarantine 15, freetext-note 1; some overlap in rounds — counts per dispatch in
plan.md Progress).

## Prod state after the live B2 apply (audited 2026-08-22)

| metric | before | after |
|---|---|---|
| suppliers | 11 | 13 (**active: 10 → 10**) |
| products | 154 | 175 |
| supplier_products | 154 | 228 (**all 74 new rows inactive**) |
| locations | 7 | 13 (**active: 4 → 4**) |
| location_product_settings | 578 | 1486 |

Per-location settings counts match the generator's expected table exactly
(BROWARY 114 · ELEKTROWNIA 110 · FORUM 112 · KAMIENICA 113 · SLONY 113 ·
STARY_BROWAR 127 · SUPERSAM 113 · WESTFIELD 106); the four live locations'
rows are byte-untouched (WOLA 151 · BRACKA 144 · NORBLIN 145 · KEN 138).

No preview screenshot: nothing user-visible changed by design — the entire
point of the inactive-first batch ordering is that the four live Captains see
exactly what they saw yesterday. The invariants above are the proof.

## UI-visibility: one deviation found in final review — 14 pairs exposed

The inactive-rows safety design assumed the PR #26 code (`sp.active` filtered
on the orderable path). **Prod still runs the pre-#26 code, which ignores
`sp.active`** — that is precisely the FR-029 bug the unmerged PR fixes. The
orchestrator missed this sequencing dependency at apply time and caught it
writing this document.

Verified by query: exactly **14 new pairs** are visible at all four live
locations (extra lines under EXISTING supplier tabs — Pago +3
Tzatzyki/Tirokafteri/Feta · Kuchnie Świata +7 · Intermlecz +3 · Eurofood +1
Bombilla). SELGROS/SPEC pairs are NOT exposed (their supplier is inactive and
the supplier picker filters that client-side); pairs for new products are NOT
exposed (no settings rows at live locations).

An immediate DELETE rollback of the 14 (all `active=FALSE`, preserved verbatim
in `prod-sql/02-…`) was attempted twice and hard-blocked by the session's
permission classifier (destructive-op class). Left as the operator's FIRST
action item — one statement in change.md — OR made moot by merging/deploying
PR #26, after which the `sp.active` filter hides them anyway. Severity while
open: duplicate-visibility only (FR-027's known risk); no order/data
corruption; only WOLA actively orders.
