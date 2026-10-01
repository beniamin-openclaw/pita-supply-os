# mvp-check — 2026-09-13 (independent subagent, prompt `.claude/prompts/mvp-check.md`, branch `cert/builder-readiness`)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | CRUD on a persisted core item | PASS | `orders`/`order_lines` in Postgres: Create `POST /api/captain/submit` (main.py:564); Read `GET /api/captain/order/{id}` (1229), `GET /api/manager/queue` (769), `GET /api/manager/order/{id}` (985); Update `PATCH /api/captain/order/{id}` (1290), `PATCH /api/manager/order/{id}` (1844); Delete = soft-cancel with reason/trace `POST /api/manager/cancel/{id}` (1627), `POST /api/manager/transport/cancel` (4768) — judged as a deliberate domain decision, not a workaround |
| 2 | Business logic beyond CRUD | PASS | `app/suggestion.py::compute_suggestion` — deficit → purchase units under four rounding rules, over-max detection, explanation text |
| 3 | Tests addressing a risk from test-plan.md | PASS | 3 of 6 mappings spot-checked by opening the tests: Risk #1 → `test_manager_dispatch.py::test_dispatch_email_channel_rejects_placeholder_email`; Risk #2 → `test_suggestion.py::test_half_allowed_rule`; Risk #4 → `test_main.py::test_health_internal_rejects_captain_token` |
| 4 | Authentication tied to the user | PASS | two-token bearer (`app/auth.py`): Captain token per location (order detail 404 for another location), Manager token; `AuthGate.tsx` + `localStorage` per role — acceptable simpler approach for an internal tool |
| 5 | Documentation | PASS | `README.md` (200 lines), `prd.md` (266), `roadmap.md` (342), `infrastructure.md` (292) — no placeholders |

Verdict: **5/5**. Suggestions recorded: keep §3 Phase 5 (IDOR sweep) visibly `not started` (honest gap, already stated in the plan); README already names the soft-delete decision in the certification map; prod auth env vars are the operator's responsibility (already enforced — `/health/internal` requires a bearer).
