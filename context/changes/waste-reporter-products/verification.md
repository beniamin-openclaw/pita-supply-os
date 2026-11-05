# Verification: waste reporter and master products

Date:2026-11-05. Application candidate85f6e49, baselineae643989. All writes in this verification used synthetic local data. Production only queried read-only; migration0033/application remain unpromoted.

## Product gates

| Check | Result |
|---|---|
| Backend Ruff | PASS |
| Backend default pytest |1265passed/54deselected |
| Real PostgreSQL integration |54passed/1265deselected |
| Frontend build (tsc + Vite) |PASS; existing large-chunk advisory retained |
| Frontend ESLint |PASS |
| Frontend Vitest |1343passed/90files |
| Focused independent review rerun |39passed/5frontend files |
| Diff whitespace |PASS |

Root independently reran all full product gates, in addition to implementing agents' red→green checks. No tests used a production database, signed-in Telegram or real supplier dispatch. No new package/dependency was introduced.

The PostgreSQL integration fixture uses only the disposable supply_waste_test database. The separate browser database supply_waste_reporter_products_browser retains seven synthetic legacy reports and161master products, including inactive box, base g, equal-name distinct source IDs, pojemnik and a missing-unit probe. The cloned old browser fixture predated two final0032checks; only that clone was normalized to canonical0032before applying0033. The canonical0032→0033migration test independently checks preserved rows/untouched constraint definitions/RLS. Production read-only schema preflight confirms canonical0032already present.

## Authenticated real-Postgres browser verification

Local FastAPI8928 and Vite5180; role tokens enabled. Captain375×812, Manager1280×900with only the Manager token in its own storage. CLI browser interactions, actual network/storage/SQL assertions and UI CSV downloads; screenshots visually inspected.

- Blank name with a selected quantity: save blocked before POST, localized alert and focus on the required name input. Name capped120and trimmed in the committed payload.
- Original17cards remain. Full master list searches by name/ID, includes inactive products and actual units. Blank-unit item remains visible/disabled with an explanation. Mobile picker shows searchable scrollable results above the fixed save footer, without horizontal overflow.
- Mixed report: curated pita1szt, tomato250displayg→0.25kg; source inactive box2.5, literal source g0.5, two same-name source IDs2and1.25opak, source pojemnik1. Source rows use manual comma inputs/+1, retain IDs/name/unit/quantities and reporter after a real reload. Server snapshots read back correctly.
- Simulated lost response AFTER actual HTTP200commit: one POST created one batch; reporter/date/rows remained frozen. Check Save readback confirmed the exact batch, cleared the draft and stored the confirmed reporter suggestion. SQL proves seven exact lines, one committed batch and source g0.5unchanged, not divided by1000.
- Separate pre-commit simulated network failure: by-batch404did not unlock reporter/rows or change the batch. Retry sent the identical serialized body and succeeded once. Source kg0.125plus two +1clicks saved2.125kg; source szt manual0.5remained0.5szt. SQL proves nine total distinct batches: seven legacy plus these two named reports.
- Reconstructed an old frozen payload from the synthetic legacy database and independently matched its original digest. Restored it without a reporter, retried via the real UI and confirmed the byte-identical original request succeeded. No reporter/source field was appended and no new batch created.
- Captain and Manager histories show the named report, exact quantities/units and explicit missing-name fallback for legacy rows. Manager held no Captain token. Both same-name source IDs remain separate in totals.
- Actual Manager CSV button download: established19column prefix unchanged; reported_by/source_product_id appended. Seven first-batch rows retain Anna E2E and source IDs; source g0.5is exact. Old rows keep empty attribution.

Private evidence: `/Users/ben/Documents/Codex/2026-11-05/supply-v2-waste-report/reporter-products/` contains local-migration.json, browser-save-sql.json, browser-retry-verification.json, csv-totals-verification.json, manager-ui.csv, legacy-browser-payload.json and mobile/desktop screenshots. No credential snapshots or production personal report contents were saved.

## Limits and exact next step

This establishes local application behavior against the production persistence implementation with authentication. It does not establish that0033or the new application is live. Independent final implementation/safety reviews and hosted CI belong to the release candidate evidence. Manual acceptance boxes remain unchecked; Ben accepted baseline PR84, not this extension. Follow release-proposal.md, obtain explicit scoped production approval, apply0033before code, verify actual Railway/Vercel artifacts, then let Ben test a real report. Office communications remain unsent/unchanged.
