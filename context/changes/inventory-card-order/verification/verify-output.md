# /verify — inventory-card-order

Run on branch `claude/inventory-card-order` (HEAD 9befd16 plus review fixes, see below), 2026-09-28.

| Check | Command | Result |
|-------|---------|--------|
| Backend lint | `cd supply-os-v1 && python3 -m ruff check .` | All checks passed |
| Backend tests | `python3 -m pytest -q` | 833 passed, 32 deselected |
| Integration on Postgres 16 | `SUPPLY_OS_DATA_BACKEND=supabase SUPPLY_OS_DATABASE_URL=<local throwaway DB supply_os_it_0027> python3 -m pytest -m integration -q` | 32 passed |
| Frontend tests | `cd frontend && npm run test` | 45 files, 597 passed |
| Frontend lint | `npm run lint` | clean |
| Frontend build | `npm run build` (includes `tsc -b`) | built (chunk-size notice only) |

The integration database is a local throwaway, never prod.
