# Verification — order-ordered-by

Date: 2026-06-24 · Local run against seed/mock backends only (no prod, no real dispatch).

## /verify — four canonical checks: ALL PASS

| # | Check | Command (as run) | Result |
|---|-------|------------------|--------|
| 1 | Backend lint | `cd supply-os-v1 && python3 -m ruff check .` * | **PASS** — "All checks passed!" (exit 0) |
| 2 | Backend tests | `cd supply-os-v1 && python3 -m pytest` | **PASS** — 394 passed, 16 deselected (integration) |
| 3 | Frontend build | `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run build` | **PASS** — `tsc -b && vite build` ✓ (types + build clean) |
| 4 | Frontend lint | `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run lint` | **PASS** — eslint exit 0 |

Extra: `npm run test` (vitest) → **77 passed (9 files)**.

\* Environment notes (not code defects):
- Bare `ruff` is not on this shell's PATH; `python3 -m ruff` (ruff 0.15.16) is the working invocation. Equivalent to `ruff check .`.
- The frontend worktree had no `node_modules`; ran `npm ci` once (262 pkgs) before the checks. Default `node` is incompatible with native rollup → used Homebrew node (`/opt/homebrew/bin`, v25.8.0) per the project gotcha.

## New backend tests added (all green)

- `test_submit_missing_ordered_by_422` — submit without `ordered_by` → 422.
- `test_submit_blank_ordered_by_422` — `ordered_by: ""` → 422.
- `test_manager_queue.py` — `ordered_by` round-trips onto the queue item and the order detail.

## Guardrails honored

- Persistence only via `_choose_backend()` (Supabase `_ORDER_COLUMNS` + Sheets auto-serialize; seed has no orders path).
- Frontend API only via `apiClient.ts`; all copy via `i18n/strings.ts` (PL+EN).
- No real supplier order/dispatch from any test. No prod migration applied. No commit/push/deploy.
