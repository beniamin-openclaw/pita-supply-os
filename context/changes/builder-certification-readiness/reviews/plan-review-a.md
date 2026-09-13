# Plan review A — course conformity (independent subagent, 2026-09-12)

Verdict: SHIP-WITH-FIXES. Findings (applied in plan revision 2):

1. HIGH — Risk #5 cited `test_dynamic_target.py`, which lives on the unmerged dynamic-target-wola branch → replaced by the Transport risk covered on `main`.
2. HIGH — Phase 1 order: park dynamic-target-wola before touching `main.py` for the CI fix.
3. HIGH — `/10x-archive` derives the folder prefix from `created:` and refuses folders without `change.md` or with uncommitted files → change.md added for deployment / feedback-r7 / ken-browary; annotations committed before moving; one commit per archive.
4. MED — test-plan schema: no file/function names in §2 Source; add the Risk Response Guidance table; §6 = how-to with reference tests; `complete` only with a fully-ticked archived plan; keep one `not started` phase.
5. MED — Champion A must follow the m5l3 path (requirements → research → plan → implement → impl-review), unit-test `review.py`, support a label retrigger because the secret arrives after the PR opens.
6. MED — Form: state explicitly that reviewers run the app locally in seed mode (no prod tokens); name the soft-delete decision in README, form comment and test plan.
7. LOW — Over-scope trimmed: one impl-review of the branch; screenshots in one viewport per role; no `context/` tree screenshot.
8. LOW — roadmap `status: draft` → `active`; commit count ~127; model id verified on OpenRouter; public repo needs no collaborator.
