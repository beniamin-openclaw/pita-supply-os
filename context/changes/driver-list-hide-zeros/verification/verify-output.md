# /verify — driver-list-hide-zeros (2026-11-02, local, seed backend)

| Check | Result |
| --- | --- |
| backend `ruff check .` | PASS — All checks passed |
| backend `python -m pytest` | PASS — 1232 passed, 41 deselected (integration) |
| frontend `npm run build` | PASS |
| frontend `npm run lint` | PASS |
| frontend `npm run test` | PASS — 81 files, 1289 tests (after impl-review fixes; 1288 before the rounding test) |

Environment note: with Homebrew node v25.8.0 the first vitest run failed 3 Captain tests
(`localStorage.setItem is not a function`) — Node 25's built-in Web Storage shadows jsdom's.
Not related to this change (files untouched). Re-run with
`NODE_OPTIONS=--no-experimental-webstorage` → all green.

Targeted: `src/pages/manager/lib/transportPdf.test.ts` 28/28, incl. the new
"leaves a location cell blank when that location ordered none of the product".

UI preview: not run locally — the driver PDF is generated client-side from a live
Transport batch; verified on prod after deploy instead (see live-test notes).
