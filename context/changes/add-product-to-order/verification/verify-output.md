# Verification — add-product-to-order

Date: 2026-06-26 · Local, seed/test backend only (no prod, no real orders).

## /verify — four checks, all PASS

| Check | Command | Result |
|-------|---------|--------|
| Backend lint | `python3 -m ruff check .` (supply-os-v1) | ✅ All checks passed! |
| Backend tests | `python3 -m pytest -q` (supply-os-v1) | ✅ 417 passed, 16 deselected |
| Frontend lint | `npm run lint` (frontend) | ✅ eslint clean |
| Frontend build | `npm run build` (frontend, tsc -b && vite build) | ✅ built, 1648 modules |
| Frontend tests | `npm run test` (vitest) | ✅ 83 passed (10 files) |

Notes:
- Backend run via Homebrew `python3` (pytest 9.0.3, ruff 0.15.16). The 16 deselected
  are the creds-gated Supabase integration tests (no cloud creds locally — by design).
- Frontend run with `PATH=/opt/homebrew/bin:$PATH` (Homebrew node 25.8.0) per the
  known native-rollup workaround.
- New backend coverage: `tests/test_manager_add_line.py` — 13 tests (GET orderable
  happy/empty/auth/missing-param; POST add-line happy/404/409/400×3/401/503/422-blank).
- Frontend `tsc -b` typechecks all new props/types (strict is off, so explicit
  annotations on AddProductPicker props, ManagerPage/OrderDetailPane props, and the
  two new apiClient methods are what the build validates).

## Hard-rule compliance
- No real supplier order or dispatch placed: all backend writes in the new tests are
  mocked (`append_order_lines` patched); no `gmail_url`/dispatch path is exercised.
- Persistence stays behind `_choose_backend()`; the add-line route gates on
  `_is_persistent` (503 on seed) and never imports a backend module directly.
