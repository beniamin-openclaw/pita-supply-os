# Repository Guidelines

FastAPI backend for Pita Supply OS — internal supplier ordering: a Captain submits stock-based orders at a location; a Manager reviews and dispatches them to suppliers. Python, Pydantic v2.

## Hard rules
- Never place a real supplier order from a test. Submit/dispatch tests must back out or use safe test data.
- All persistence goes through the backend module returned by `_choose_backend()` in @./app/main.py (`seed_loader` = CSV, `sheets` = Google Sheets). Routes never import a backend module directly.
- A new backend (e.g. Postgres/Supabase) must implement the same function set as @./app/sheets.py (`load_*`, `append_order`, `update_order_lines`, `get_order`, `delete_order_lines`) and be registered in `_choose_backend()`.
- Catch data-layer failures by their shared names — `OrderAlreadyDispatchedError`, `ConfigDriftError`, `OrderNotFoundError` — never couple a route to one backend.

## Types
Every endpoint and data-layer boundary takes and returns Pydantic models from @./app/models.py — never raw dicts. No static type-checker is configured, so annotate every function boundary in `app/`.

## Build, test, run
- Run: `uvicorn app.main:app` (see @./Procfile).
- Test: `python -m pytest` (pytest + pytest-mock). Lint: `ruff check .`.

## Layout & naming
Modules sit flat in `app/`: route wiring in @./app/main.py, domain models in `models.py`, the suggestion engine in `suggestion.py`, auth in `auth.py`, settings in `config.py`. snake_case modules and functions.

## Tripwires
- Preserve `order_lines` columns, the two-token auth, and visible suggestion math — they are production contracts.
- The suggestion engine suggests only; it never auto-orders.

See @../AGENTS.md for the repo-wide operating constitution.
