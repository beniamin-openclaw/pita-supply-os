# Plan review — independent (Opus subagent, 2026-09-07)

Verdict: **READY-WITH-FIXES**. Applied in plan v2 / implementation unless noted.

Blockers (all applied): (1) plan restructured into phases + Progress; (2) ×units_per_purchase_unit
conversion only when invoice unit differs from ours → `ok_converted`, never `ok`; (3) explicit
receipt roll-up incl. `possible_collective` (collective invoices: Blue Service/Coca-Cola) and
`unsure`; green "Zgodne" only for a confirmed review; (4) `tests/conftest.py` blanks
`SUPPLY_OS_EBIURO_*` + test asserting `is_configured()` is False.

Major (applied): sync timeouts 20 s, per-doc try/except → skipped, 200-fetch cap, 60 s re-entry
guard; PDF proxy takes `doc_id` only, DB lookup, 403 outside configured companies, `no-store`;
ranking without tuned constants (matched ratio, |Δdays|, |Δnetto|); `estimate = Σ received ×
price_estimate_pln` (None when incomplete); korekty stored but never candidates, own section;
partial unique index on confirmed `doc_id` + `duplicate_receipt` flag; `last_seen_at` for stale docs.

Minor (applied): text columns, house migration header + rollback, emit-sql to scratch only,
ON CONFLICT upsert in one transaction, `apiGetBlob` with Bearer + revokeObjectURL, KEN
company_nip assertion. `doc_id` global uniqueness verified against a second company before apply.

Pareto cuts: Mac mini cron deferred until Railway env vars exist (plist kept in `deploy/mini/`).
NOT taken: dropping `?doc_id=` on the detail route (kept — cheaper than persisting a selection).
