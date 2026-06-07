---
change_id: frontend-lint-debt
title: Clear frontend eslint debt (set-state-in-effect + stale directives + deps)
status: implementing
created: 2026-06-07
updated: 2026-06-07
archived_at: null
---

## Notes

Chip `task_000307d5`. The frontend eslint baseline carries **13 problems** (8 errors `react-hooks/set-state-in-effect`; 5 warnings: 3 unused `no-console` disable directives + 2 `react-hooks/exhaustive-deps` missing `t`). Clear them with **behavior-preserving** fixes so future frontend work starts clean.

Strategy per class:
- **set-state-in-effect** — move the synchronous `setState` into the async callback (clear-on-success) or delete when redundant with initial state. On `CaptainMP`'s two *intentional* synchronous resets (clear items on supplier-switch; default-select pilot once suppliers load) the rule over-fires on an acknowledged pattern → justify + `eslint-disable`.
- **unused directives** — delete (the `no-console` rule isn't active, so the disables are dead).
- **exhaustive-deps** — add `t` to the two `CaptainMP` effect deps (`t` is `useCallback`-memoized on `[lang]`, so adding it can't loop).

No behavior change intended. Verified via `tsc --noEmit` + `eslint` (target 0) + `vite build`. Done right before the owner's test, so safety > completeness — every fix is reasoned per-site.
