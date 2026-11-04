# List and history verification

Date: 2026-11-04. Application candidate `d955721` on `codex/supply-v2-waste-report`; parent `d05a3f3`, remote main `02a0930`. No application merge/deploy performed.

## Final product checks

| Command | Actual final result |
| --- | --- |
| Backend `python3 -m ruff check .` | PASS |
| Backend `python3 -m pytest -q` |1250 passed,45 integration deselected |
| Disposable Postgres `python3 -m pytest -m integration -q` |45 passed,1250 deselected |
| Frontend `npm run build` | PASS; existing large-chunk warnings |
| Frontend `npm run lint` | PASS |
| Frontend `npm test -- --maxWorkers=2` |89files,1330tests passed |
| Final application diff/staged explicit paths and secret-name/content audit | PASS |

An earlier full frontend run overlapped a deliberately added red current-preset regression:1328passed/1failed. Implementer fixed it, independent reviewers rechecked the frozen source, then the final full suite above passed. No timeout/configuration changes were introduced. The bounded two-worker command avoids the existing local contention observed in the parent change.

The implementer ran68focusedtests in11files. Independent plan reviewer ran35tests in5files; independent safety reviewer ran20tests in3files. These are additional focused checks, not added to the full-suite count. Both final reviewers approved with no unresolved findings. Typed/role/API/i18n conventions and parent lifecycle invariants remain intact.

## Authenticated browser E2E with real local Postgres

Separate task-owned synthetic Captain and Manager browsers used FastAPI8927/Vite5179 and a persistent browser database distinct from destructive integration fixtures. Auth was enabled; Manager had no Captain token.

- All17catalog cards render without standard-product dropdowns, in paper sections. New date is Warsaw today. Only3entered products were sent: Rucola150g, tomato250g and avocado1szt. Untouched14products stayed absent. Database readback of batch `4e3d9cc3-053b-4c4d-8c9a-1a21de9bc014` returned exactly3lines:0.15kg/0.25kg/1szt, preserving reasons and insertion order. Earlier reports remained present.
- Repeated tomato100+100+50 and avocado0.25+0.25+0.5 work. Real keyboard typing150 initially exposed a first-character focus-loss bug (amount1,activeBODY); stable keys fixed it (amount150,activeINPUT). Draft amounts/reasons and UUID survived reload. Sticky save remains reachable while scrolling.
- Captain's entry link opens `/captain-v2/waste-history`; top active destination is History and the third History segment is Waste reports. Current/repeated Today preset reloads successfully. Last7days gives inclusive2026-10-29..2026-11-04. Actual Captain UI downloads contain7current-day rows and9weekly rows, allWOLA.
- Manager Inventory/Waste reports segment switches both ways and retains correct active link. Month preset and WOLA filter download9rows; manually changing both native date day segments by keyboard to2026-11-03 produces exactly2CSVrows for that date. Only Manager auth was stored. Export filenames reflect dates.
- Width checks: entry320/375/1280, Captain history320/375, Manager history320/1280 have document width equal to viewport. Mobile/desktop screenshots were inspected. Native date filling by the automation helper did not commit values, so custom dates were verified with real ArrowUp/ArrowDown and Tab events instead of treating tool acknowledgments as evidence.
- Offline save of manual comma pita0,5 freezes exact payload; online by-batch404 retains it, identical retry resolves and readback finds exactly1line/0.5szt for batch `6090a97a-27b3-457c-9ede-0c286c48901b`. No duplicate batch or silent payload replacement.
- Direct authenticated local API and real Postgres tests prove Captain forged location query is ignored; WOLA export contains its rows, BRACKA is empty. Integration export spans102reports and returns all expected IDs; Manager reuse preserves bounded generation and cleanup.
- No uncaught browser errors observed. All writes in browser/integration were synthetic local waste records, never supplier orders or production samples.

Private evidence stays outside Git under `/Users/ben/Documents/Codex/2026-11-04/supply-v2-waste-report/test-runtime/`: `list-history-api-e2e.json`, `list-entry-focus-regression.json`, `list-captain-today.csv`, `list-captain-week.csv`, `list-manager-month.csv`, `list-manager-custom.csv`, implementer/independent reports and `output/playwright/list-*.png` screenshots. Source photos/observations were not imported or republished.

## Production schema only

Ben explicitly approved only migration0032. It was committed in one database transaction and actual constraints/indexes/RLS read back:2tables,21constraints,5indexes, RLSenabled2,0publicpolicies,0rows each. See `migration-preflight.md` and private `production-migration-0032.json`. No full backup was created/verified for this additive-only transaction; existing tables/data were untouched. WORKLOG and REMOTE_RUNTIME_STATE record the mutation. No application merge/deploy/restart occurred.

## Completion boundary

This verifies a prepared application change and its prerequisite schema, not deployed behavior or real operator-period acceptance. Physical touch hardware, a full handwritten-cell audit and a real period remain unverified. Six tile sets retain provisional calibration; fractional amounts beyond three decimals cannot be silently rounded. Both read-only source/production checks and synthetic E2E are kept distinct from operational evidence. Final PR/CI evidence is the PR’s current checks plus the private CI snapshot and shared WORKLOG entry at handoff; the merge proposal names the exact application source and operator action.
