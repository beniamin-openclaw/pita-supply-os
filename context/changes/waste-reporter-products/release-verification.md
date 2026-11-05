# Production release verification

Date: 2026-11-05. Ben explicitly approved: “Tak, wdroż migrację 0033 i PR #85”.

## Migration and merge

Applied exact migration 0033, SHA256 `ff52ac1291c162005c65bc1c48f0f2ea4b1c53f9c5a5150716ca859327081bad`, at `2026-11-05T11:03:27.186680Z`. Transactional DDL used scoped table locks, lock timeout 5s and statement timeout 30s. Old-field SHA256 fingerprints before/after matched for the one existing report and five lines. Both tables retain RLS, zero public policies and 23 constraints. New fields remain null on historical data. No order, inventory, master-data, credential or environment change and no fake observation.

PR [85](https://github.com/beniamin-openclaw/pita-supply-os/pull/85) merged using expected head `9bf7fcc98c1f87f9a2ecd98110a6a35fca7fdea2`. Actual merge: `e4d4c5490d726fce10c38719c6e0fa2ebdee0ef2`.

## Actual artifacts

- Railway production deployment `3a1f6f58-55b5-4854-bd12-09604d34cab4`: SUCCESS, exact merge source; image `sha256:f8b3d4d3bbe53a38c1bcafa7a0d04725a0ecd363d26a1140138739d1be79bcd9`.
- Vercel Production GitHub deployment `7571886851`: success, exact merge source. Public alias serves the new reporter/chooser UI. Unique deployment URL remains protected; no direct byte-comparison claim is made.
- Post-merge product [CI 42015841730](https://github.com/beniamin-openclaw/pita-supply-os/actions/runs/42015841730): all three jobs passed on the actual merge. Candidate evidence remains 1265 backend, 54 real-Postgres integration and 1343 frontend tests, plus build/lint and independent reviews.

## Live checks

Twenty-five read-only checks passed across direct Railway and Vercel API proxy: health and new OpenAPI fields directly on Railway, catalog 17, full products 196, both role histories and CSV with appended reporter/source columns, Captain location scope, no-auth and wrong-role denials. Vercel proxies `/api` only; its root serves the frontend.

Authenticated public browser: Captain at 375px has required name/max120, original 17 cards, complete 196-option chooser and three visible-disabled missing-unit products; history shows the explicit old-report attribution fallback. Manager at 1280px held only the Manager token; history loaded and actual CSV button download contained the new columns/five existing lines. The temporary business-data CSV was parsed and removed. No horizontal overflow or uncaught browser error observed. Entry/chooser screenshots contain no production report personal contents. Own browser storage cleared and session closed.

All production checks used GET/read-only actions. Real new-report save/retry remains for Ben; local authenticated real-Postgres E2E already proved named/master save, exact units, frozen retry and readback without duplication. No synthetic production report, void or supplier order was created. Office messages remain unchanged/unsent.

## Recovery and next step

Preserve all additive schema and observations. After widened-unit records exist, old ae643989 readers are unsafe. Prefer a forward patch/keep widened readers, or temporarily withdraw waste using known pre-waste source `02a0930e09e09648a0e75dfb22f1cb1d96006144`. Its recorded Railway deployment is REMOVED; a reviewed source redeploy is required rather than assuming that historical artifact can be restored. Check current main/hosting availability to preserve parallel changes. No full database backup was created or asserted.

Private evidence: `/Users/ben/Documents/Codex/2026-11-05/supply-v2-waste-report/reporter-products/production-*.json` and production screenshots. Shared operating state records migration/deploy, evidence, recovery and manual acceptance boundary.

Next: refresh [Raport strat](https://pita-supply-os.vercel.app/captain-v2/waste-report), enter a real name and an extra product, save and confirm history/CSV. Ben's acceptance is pending; do not archive yet.
