# Plan review B — engineering safety (independent subagent, 2026-09-12)

Verdict: SHIP-WITH-FIXES. Findings (applied in plan revision 2):

1. HIGH — `main.py` carries dynamic-target hunks; the CI fix on `main` would swallow them (no branch protection on `main`). Park first, explicit-path staging from `dynamic-target-wola/plan.md` §Files (change.md's list omits `DATA_MODEL.md`, `conftest.py`), `git diff --cached --stat` = 2 files for the fix.
2. HIGH — `docs/pita-supply-os-v1/analysis/**/raw/` holds ~700 KB of GoStock exports (purchase prices, stock values, cost of sales per location) — repo is PUBLIC → excluded via `.gitignore` and explicit `git add`.
3. HIGH — The repo lacks the m3l1/m5l3 packs and the mvp-check prompt (they live in the course workspace) → install packs in the gitignored `.claude/`; reference the mvp-check prompt by absolute path.
4. MED — `supply-os-v1/.env` points at the live Google Sheet (`SUPPLY_OS_DATA_BACKEND=sheet`) → local runs use an explicit env override and verify the startup log; `.env` untouched; no Supabase/Vercel MCP writes.
5. MED — Labels `ai-cr:*` do not exist; `gh label create` needs `issues: write` → added with `--force` and `continue-on-error`; `GH_TOKEN` set for `gh pr comment`.
6. MED — Archiving breaks three path references (`roadmap.md:204`, `week1-feedback-targets/plan.md:172`, `wolska-blueservice-master-data/plan.md:339`) and `deployment` has no change.md → fixed in the same commits.
7. LOW — CI diagnosis confirmed (`monotonic()` < 60 s after runner boot vs `0.0` sentinel); `float("-inf")` is safe; clean `main` has ~668 tests, not 738.
8. LOW — Secret grep baseline: `favicon.svg` (`mask-type`), `test_config_creds.py` (FAKEKEY), `test_supabase_storage.py` fixtures.
Time budget: ~15–18 h serial work to Sun 15:00; cut order recorded in the plan.
