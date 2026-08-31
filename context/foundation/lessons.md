# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Verify CI actually runs the product's tests

- **Context**: Judging "is this tested / safe to change?" on any brownfield or monorepo project.
- **Problem**: This repo's `quality-gate.yml` ran sibling monorepo tooling (telegram agent, validators), not `supply-os-v1`/`frontend` — a green check implied product coverage that didn't exist.
- **Rule**: Before trusting a green CI/test signal, read the workflow and confirm the gate actually runs the product's tests. Never assume green = covered.
- **Applies to**: research, plan-review, impl-review

## Never bypass the data-layer seam

- **Context**: Any backend persistence change in `supply-os-v1/` (including the Sheets→Supabase migration).
- **Problem**: Routes that import a backend module directly break the seed/sheets/Supabase swap and the concurrency guarantees built into the seam.
- **Rule**: All persistence goes through `_choose_backend()`; a new backend implements the same function set and registers there — never import a backend module from a route.
- **Applies to**: plan, implement, impl-review

## Hard-audit for secrets when copying code between repos

- **Context**: Any migration or copy of code out of a monorepo into a new repo.
- **Problem**: `sa.json` / `.env` and other secrets can ride along silently into a new repo or its git history.
- **Rule**: When copying code between repos, exclude secrets up front AND hard-audit the staging area (e.g. `git add -n | grep -iE 'secret|\.env$|sa\.json'`) before the first commit.
- **Applies to**: implement

## Roadmap is the source of truth; external trackers are a generated mirror

- **Context**: Exporting or syncing the roadmap/backlog to an external tracker (GitHub Issues, Linear, etc.), or whenever a slice's status changes.
- **Problem**: We exported `roadmap.md` → GitHub Issues ad-hoc; without a rule the two drift (e.g. S-06 was implemented but issue #3 still read "ready"), and an external tracker gets hand-edited as if it were the source.
- **Rule**: `context/foundation/roadmap.md` (+ the per-change `plan.md ## Progress`) is the canonical source of truth for slice status and progress; external trackers are a generated mirror — regenerate/sync from the roadmap on status changes, never hand-edit the mirror as the source. `/10x-archive` is the authority that flips a slice to `done`.
- **Applies to**: plan, implement, impl-review

## Keep skill-managed artifacts in English

- **Context**: Any artifact the 10x skills read or parse — `change.md`, `plan.md` (including `## Progress` and status values), commit subjects, `roadmap.md`, `lessons.md`, and generated tracker issues. The working conversation may run in another language (e.g. Polish).
- **Problem**: Mixing the conversation language into skill artifacts breaks the conventions the (English) skills rely on — status tokens (`implemented` / `ready` / `proposed` / `blocked`), section headers, and parseable fields.
- **Rule**: Keep all skill-managed artifacts and status values in English at all times, regardless of the conversation language. Translate nothing in change.md / plan.md / Progress / statuses / commit messages / roadmap / lessons / generated issues.
- **Applies to**: all

## Tests must be order-independent (set settings env in conftest, not per-file)

- **Context**: Backend pytest files under `supply-os-v1/tests/` that import `app.main`/`app.config` and depend on settings loaded from env (auth tokens, `SUPPLY_OS_DATA_BACKEND`).
- **Problem**: Pydantic settings load ONCE at the first `app.config` import. Files set env via `os.environ.setdefault(...)` before importing the app, but a sibling that imports `app.config` (e.g. via `app.sheets`) WITHOUT those vars can load settings first — so a later file's `setdefault` is too late. Result: an order-dependent suite (a 2-file subset fails auth tests while the full alphabetical run passes 217/217).
- **Rule**: Set test settings (auth tokens, data backend) once in a session-scoped `tests/conftest.py` BEFORE any app/config import — never rely on per-file `os.environ.setdefault` for settings that load once. The suite must pass regardless of file order or subset selection.
- **Applies to**: implement, impl-review

## Mirror Pydantic optionality in TypeScript response types

- **Context**: TS interfaces in `frontend/src/types.ts` that mirror backend Pydantic models — especially a field that has a default or is `Optional` on the Pydantic side (e.g. `ManagerOrderLineDetail.rounding_rule`).
- **Problem**: A backend optional-with-default field was mirrored as a *required* TS field. It was safe only because the server always emits it; the type contract still disagrees with the model — latent drift that bites the day a code path omits the field.
- **Rule**: When mirroring a Pydantic model in TS, match optionality to the source — a field with a default or `Optional[...]` becomes `field?: T`. Only mark a TS field required when the backend guarantees it on every response.
- **Applies to**: implement, impl-review

## Verify what production actually runs — "merged" / "pushed" / "done" ≠ live

- **Context**: Any change you believe is deployed — after a merge to `main`, a `git push`, a roadmap item flipped to `done`, or a "deploy" step — especially the droplet backend, whose deploy is manual and currently disconnected from git.
- **Problem**: D-01 was marked `done` and GR-01 was merged to `main`, yet production ran pre-GR-01 code from a flat rsync copy of `app/` that is NOT the git working tree — `git push` / droplet `git reset` updates `supply-os-v1/app/` (not even checked out there), never the running `app/`. Separately, the order-screen endpoints served stale droplet seed CSVs while the Sheet was correct, and the bug still passed all 327 dev (seed-mode) tests. "It's on main", "I pushed", and "dev is green" were all false signals for "it's live and correct in prod".
- **Rule**: Before trusting a change is live, verify the running artifact itself — hit the real prod endpoint, check the running code/version on the host, and confirm which backend/data source it actually serves. Never infer "deployed" from "merged / pushed / marked done", nor "prod-correct" from "dev-green" when dev (seed) and prod (sheet) resolve `_choose_backend()` to different sources. Backend deploy here is manual: rsync `supply-os-v1/app/` → droplet `app/` + `systemctl restart jarvis-supply-os.service`, not git-push.
- **Applies to**: implement, impl-review

## Deploy end-to-end before asking the user to live-test

- **Context**: The live-test / verification handoff at the end of any change the user will exercise on prod — especially full-stack changes on this stack (frontend → Vercel, backend → Railway, both auto-deploying from `main`; datastore → Supabase, migrations applied separately). The user only tests on deployed prod — no local preview, no staging.
- **Problem**: In `order-ordered-by` I handed the user a "test on /captain-v2" checklist while the PR was still unmerged — nothing was deployed, so the new field wasn't there and the test was a dead end. By the time a change reaches the live-test handoff it is already verified and review-corrected, so an undeployed "test it live" ask only burns a round-trip.
- **Rule**: Before asking the user to live-test, drive or explicitly propose the FULL end-to-end deploy first — frontend AND backend AND any DB migration (migration before the code that depends on it) — and confirm the new build is actually live (new Vercel production bundle for the merge commit / commit on `main` / backend health) before handing over the test steps. Never point the user at a screen for a change that is still local, uncommitted, or unmerged.
- **Applies to**: implement, impl-review

## Master-data ops: diff before, audit after

- **Context**: prod Supabase (location_product_settings / suppliers / products); the feedback-r4 batch of 2026-07-16, run as bulk UPDATEs without a formal plan.md.
- **Problem**: a bulk master-data change in prod with no comparison trace gives you neither a rollback path nor a way to verify the result — and a single bad row (e.g. 'TBD' as an email) can silently swallow a real order.
- **Rule**: every master-data batch in prod goes through 3 steps: (1) a SELECT-diff of old→new saved BEFORE the UPDATE (that diff IS the rollback), (2) apply, (3) audit after (consistency assertions, e.g. min<=max, target=max, no placeholders) plus an entry in context/changes/<change-id>/change.md.
- **Applies to**: every SQL operation on prod Supabase beyond a single obvious UPDATE; the Bracka/KEN rollouts in particular.

## Preview with auth DISABLED cannot verify a screen's auth/role wiring

- **Context**: any local preview / manual verification of a Captain- or Manager-scoped screen, run against a backend started without `SUPPLY_OS_CAPTAIN_TOKENS` / `SUPPLY_OS_MANAGER_TOKEN` (auth off = the convenient dev default).
- **Problem**: the Transport screen called `api.suppliers()`, which is hardcoded to the `"captain"` role. A Manager holds no captain token, so in production the request carried NO `Authorization` header, the endpoint 401'd, the page swallowed the 401, and the supplier picker stayed empty with both sections stuck on "Ładowanie…" forever. With auth disabled locally, `/api/suppliers` answered 200 to a request with no token at all — the role bug was invisible, and the screen was shipped and verified "green" (unit tests, build, lint, preview screenshot) while being broken for every real user.
- **Rule**: verify any auth-scoped screen against a backend with auth ENABLED and only the token that role actually holds (e.g. `SUPPLY_OS_MANAGER_TOKEN=<x>` with `SUPPLY_OS_CAPTAIN_TOKENS=` empty). An auth-off preview proves rendering, never authorization. When a helper in `apiClient.ts` pins a role, check it matches the screen calling it — `require_any_auth` on the backend does NOT save you, because the failure is which token the CLIENT sends.
- **Applies to**: implement, impl-review, verification/preview of any Captain/Manager screen.

## Browser-integration features fail SILENTLY in layers — E2E in the user's real browser is the only proof

- **Context**: the "Zrób draft w Gmailu" feature (v5.4–v5.6.2): a frontend OAuth popup + Gmail API draft creation, verified "green" (198 unit tests, build, lint) yet dead on prod three separate times, each layer masking the next.
- **Problem**: (1) Google's GIS token-client popup can self-close without invoking `callback` OR `error_callback` — the page hangs busy with zero signal; (2) after switching to a classic OAuth redirect popup, `accounts.google.com` COOP headers SEVER `window.opener`, so the callback page's `opener.postMessage` silently never arrives (and `popup.closed` misreports `true` mid-flow, so a closed-poll rejects spuriously); (3) after fixing auth, pdfmake 0.3's `getBase64()` turned out promise-returning — the callback-style call is silently ignored and the chain froze AFTER a successful login. None of these throw; all pass unit tests; each fix exposed the next.
- **Rule**: for any feature spanning popup OAuth / cross-origin redirects / third-party JS libraries, budget a live E2E in the operator's actual browser on prod as PART of implementation, not a post-hoc check — instrument (console, network log, a temporary BroadcastChannel/message tap) until the token/data provably arrives. Specific reusables: relay OAuth popup results over **BroadcastChannel** (same-origin, immune to COOP opener-severing), never rely on `window.opener` or `popup.closed` after the popup crosses accounts.google.com; register GIS `error_callback` if GIS is ever used again; treat every callback-style third-party API as possibly promise-based across major versions (handle both, reject on neither); and give every async UI action a deadline that surfaces a visible error instead of an eternal spinner.
- **Applies to**: implement, impl-review, verification of any OAuth / popup / third-party-JS integration.
