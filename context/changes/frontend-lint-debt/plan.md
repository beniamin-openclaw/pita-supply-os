# Plan — Clear frontend eslint debt

- **Change**: `context/changes/frontend-lint-debt/`
- **Status**: planned (self-reviewed — autonomous run)
- **Chip**: task_000307d5

## Desired End State

`npm run lint` (Homebrew node) reports **0 problems** (down from 13: 8 errors + 5 warnings), with `tsc --noEmit` clean and `vite build` green. No behavior change to any screen.

## Current State Analysis

| # | File:line | Rule | Pattern | Fix |
|---|-----------|------|---------|-----|
| 1 | ErrorBoundary.tsx:27 | unused no-console disable | dead directive | delete the directive |
| 2 | i18n/index.ts:110 | unused no-console disable | dead directive | delete |
| 3 | i18n/index.ts:130 | unused no-console disable | dead directive | delete |
| 4 | OrdersListPage.tsx:30 | set-state-in-effect | `load()` does `setError(null)` synchronously | move `setError(null)` into `.then` (clear-on-success) |
| 5 | OrderDetailPage.tsx:34 | set-state-in-effect | same as #4 | same |
| 6 | OrderEditPage.tsx:80 | set-state-in-effect | effect does `setLoadError(null)` synchronously | drop it; clear in `.then` success path |
| 7 | CaptainPage.tsx:22 | set-state-in-effect | `setLoading(true)` redundant (inits true) | delete |
| 8 | CaptainPage.tsx:28 | set-state-in-effect | `setLoading(true)` (placeholder page) | delete (loader is initial-load only) |
| 9 | ManagerPage.tsx:90 | set-state-in-effect | `loadQueue()` does `setError(null)` synchronously | move into `.then` (clear-on-success) |
| 10 | CaptainMP.tsx:91 | set-state-in-effect | default-select pilot once suppliers load (intentional) | justify + `eslint-disable-next-line` |
| 11 | CaptainMP.tsx:99 | set-state-in-effect | reset items/lines + loader on supplier switch (intentional) | justify + block `eslint-disable` for the 3 resets |
| 12 | CaptainMP.tsx:80 | exhaustive-deps (`t`) | suppliers-fetch effect | add `t` to deps |
| 13 | CaptainMP.tsx:142 | exhaustive-deps (`t`) | orderable-fetch effect | add `t` to deps |

`t` from `useT()` is `useCallback`-memoized on `[lang]` (i18n/index.ts:105), so it is referentially stable across renders → adding it to deps cannot cause a refetch loop (only re-runs on language switch, which is acceptable).

## Phase 1: Apply the 13 fixes

### Changes Required
- Delete 3 dead `// eslint-disable-next-line no-console` directives (#1–3).
- Move synchronous `setError`/`setLoadError` into the async success path in OrdersListPage, OrderDetailPage, OrderEditPage, ManagerPage (#4–6, #9).
- Delete redundant `setLoading(true)` ×2 in the CaptainPage placeholder (#7–8).
- Justify + suppress the two intentional CaptainMP synchronous resets (#10–11); add `t` to the two CaptainMP effect deps (#12–13).

### Success Criteria
#### Automated Verification:
- [ ] `npm run lint` (Homebrew node) → 0 problems.
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` succeeds.

#### Manual Verification:
- [ ] Owner smoke tomorrow: Captain order screen (CaptainMP) loads suppliers + items, supplier switch still resets the list; Manager queue loads + 60s refresh; order detail/edit/orders-list load. No stuck spinners, no refetch loops.

## What We're NOT Doing

- Not changing any component's data flow, props, or UI — only how/where `setState` is called and effect deps.
- Not touching the eslint config (no rule enable/disable globally).
- Not rewriting CaptainMP's supplier-selection to a key-based remount (larger refactor; the targeted suppress is lower-risk the night before a test).

## Progress

### Phase 1: Apply the 13 fixes

#### Automated
- [x] 1.1 Delete 3 dead no-console directives (ErrorBoundary, i18n ×2)
- [x] 1.2 Move setError/setLoadError async: OrdersListPage, OrderDetailPage, OrderEditPage, ManagerPage
- [x] 1.3 Delete redundant setLoading(true) ×2 in CaptainPage placeholder
- [x] 1.4 CaptainMP: justify+suppress the 2 intentional resets; add `t` to 2 effect deps
- [x] 1.5 lint 0 problems + tsc clean + build green

#### Manual
- [ ] 1.6 Owner smoke tomorrow — core screens load, no stuck spinners / refetch loops
