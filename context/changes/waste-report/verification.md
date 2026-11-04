# Waste report — local verification

Date: 2026-11-04. Application candidate: backend `320abfb`, frontend `3cddf37`, based on `origin/main@02a0930`. All data below is synthetic local test data. Production has not been changed.

## Product checks

| Check | Actual result |
| --- | --- |
| Backend `python3 -m ruff check .` | PASS |
| Backend `python3 -m pytest -q` | 1249 passed, 45 integration tests deselected |
| Backend `python3 -m pytest -m integration -q` with disposable Postgres | 45 passed, 1249 deselected |
| Frontend `npm run build` | PASS; existing large-chunk warnings remain |
| Frontend `npm run lint` | PASS |
| Frontend `npm test -- --maxWorkers=2` | 87 files, 1318 tests passed |
| `git diff --check` and staged-path secret-name audit | PASS |
| Calibration script plus aggregate assertions | 30 verified images/records; 617 daily = 527 eligible + 90 excluded; 15 SUMA excluded; all 17 product reachability/manual counts reconcile |

The first default-concurrency frontend run hit two 5-second timeouts in existing sticky-reason and transport tests: 1314 passed / 2 failed before the last retry regression was added. The two files passed independently (56 tests), then the final complete suite passed with two workers and unchanged timeouts. No test configuration or unrelated test was altered. The worker limit avoids local resource contention; CI was not run remotely.

Postgres16 listened only on localhost in a task-owned cluster. Integration fixtures used `supply_waste_test`; browser verification used a separate `supply_waste_browser` database so destructive fixtures could not erase browser samples. No production DSN or credentials were used. API and browser servers had auth enabled with synthetic Captain and Manager tokens. The Manager browser held only its own role token.

## Behavior and trust boundaries

Backend tests cover the fixed 17-item catalog, exact decimal/gram rules, invalid and empty input, text/date bounds, malformed cursor members, missing/foreign access, immutable correction audit, atomic rollback, concurrent identical retry and changed-payload conflict. Real Postgres tests include more than 100 reports, complete totals/export, bounded page queries, CSV formula escaping, generation failure/disconnect cleanup, and deny-all RLS under a granted nonowner role. Seed/Sheets reject the unsupported feature explicitly.

Frontend tests cover repeated and mixed additive tiles, editable comma input, invalid-after-valid protection, precision/overflow, reason/Other validation, exact invalid-field focus/ARIA, role-token changes before mutations, stable retry payload/UUID, 30-second deadline, stale 401 handling, by-batch 404, first-attempt rejected editing, unknown-first/rejected-retry retention across reload, double-submit prevention, draft storage conflicts and late responses, filter-change void cancellation, history and Manager export wiring.

## Authenticated browser and live local API

The primary agent exercised the actual frontend against FastAPI and the browser Postgres database:

- Captain login, 17 catalog choices, fourth menu destination and exactly one active button.
- Tomato `+100`, `+100`, `+50` becomes 250 g and persists as 0.25 kg. Avocado repeated/mixed fractional additions and manual `0,75` + 0.25 produce 1 szt; invalid input disables additions.
- Reload retains a two-row draft. Avocado 1 szt and pita 1.5 szt save as one batch with separate reasons; earlier entries remain. A later save appends.
- Captain void retains the original quantity and required reason; effective totals exclude it. Manager reads the same records and can void with a separate Manager audit.
- Browser offline mode makes a 250 g submission uncertain and freezes it. After reconnect, by-batch absence keeps it frozen; identical retry succeeds. A direct database assertion found exactly one saved line for that batch, quantity 0.25 kg.
- Changing the Manager location filter removes the pending void confirmation. The confirmation names date, location, product and quantity. CSV downloaded through the real Manager UI contains all four current-day rows, including both Captain and Manager void metadata; voided rows remain auditable while totals exclude them.
- Width checks show document width equals viewport at Captain 320/375 px and Manager 320/1280 px. Visual screenshots were inspected; the mobile menu is 2x2 and quantity controls remain visible. These are Chromium mouse/keyboard checks, not proof on physical touch hardware.
- Live local HTTP/DB checks also confirm missing-token 401, foreign-location 404, Manager role isolation, original readback on repeated UUID, changed-payload 409, full selected-period CSV, and malformed cursor values returning 422.

Private evidence is outside Git under `/Users/ben/Documents/Codex/2026-11-04/supply-v2-waste-report/test-runtime/`: `api-e2e.json`, `browser-waste-final.csv`, `calibration-aggregates.json`, independent task/final reviews, and screenshots in `output/playwright/` (`captain-320.png`, `captain-375.png`, `manager-desktop.png`). Images contain synthetic test data. Source report images remain in the private API handoff, not the repository.

## Remaining acceptance

Manual Progress rows remain the human post-run checklist. No production schema/build, operator account, physical phone, complete source archive, cell-by-cell transcription or real operational period has been verified. Six products have provisional tiles. Fractional quantities requiring more than three decimal places cannot be recorded exactly; they require an operator decision, never silent rounding or inferred conversion. Shared location tokens do not identify individual employees.

Next: approve and execute `release-proposal.md`, verify the actual running backend/frontend/schema, then collect real-period operator acceptance before archival.
