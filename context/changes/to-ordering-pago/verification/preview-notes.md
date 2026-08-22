# Preview verification — /manager/transport (2026-08-22, in-app browser pane)

Setup: backend `uvicorn` in FORCED seed mode (env override in .claude/launch.json: SUPPLY_OS_DATA_BACKEND=seed, blank Google/Supabase creds, blank tokens → dev auth-off; SUPPLY_OS_SEED_DIR fixed for repo-root cwd) + Vite dev server; no live services touched.

Verified live (screenshots taken in-session):
- AuthGate (manager) renders; token entry passes (auth disabled in dev).
- `/manager/transport` renders: header "Transport zbiorczy", back link, supplier picker defaulting to **Pago**, sections "Do połączenia" and "Utworzone transporty" with correct empty states (seed mode ⇒ [] by design).
- **F1 fix verified**: switching the supplier picker to Bukat fired GET `/api/manager/transport/eligible?supplier_id=SUP_BUKAT` and `/batches?supplier_id=SUP_BUKAT` (both 200) — lists reload on change; selection cleared via loadEligible.
- Console: no errors from the current session (two stale CORS errors from a first backend instance that was misconfigured and restarted — pre-fix noise, not reproducible after restart).

Not verifiable in seed mode (persistent backend required — covered by endpoint/unit tests instead, and to be eyeballed on deployed prod per the operator's workflow):
- Create flow end-to-end (seed → 503 by design) — covered by 18 create tests incl. skipped[]/guards/append_to.
- Batch detail (totals table, driver matrix, copy button, email button enabled/disabled states) — covered by transport.test.ts (incl. totals-only email assertion and "@" gate) and 43 backend tests.
- TRN chip in the sent lane — needs a combined order; covered by test_manager_queue marker tests.

Progress mapping: 3.4 marked done for the seed-verifiable scope per these notes; 3.5/3.6 remain unchecked pending live data on deployed prod (consistent with the operator's verify-after-deploy workflow).
