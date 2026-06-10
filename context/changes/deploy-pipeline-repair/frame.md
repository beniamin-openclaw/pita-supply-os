# Frame Brief: Railway backend migration — scope boundary

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Migrating the backend host to Railway changes the project's deploy
architecture. The scope question: what else must be fixed *as part of* this
change (vs. deferred), now that we're touching the deploy architecture?

## Initial Framing (preserved)

- **User's stated cause or approach**: Railway is the chosen host (from
  `research.md`). It's an architectural change, not a config tweak, so the full
  scope it pulls in must be made explicit.
- **User's proposed direction**: Do Railway — but first map the real scope
  boundary so we neither leave a gap nor fall into "everything at once."
- **Pre-dispatch narrowing**: Datastore → *"let the frame decide"* (the decisive
  question). Adjacent items → *"minimal"*. Primary goal → *"working, repeatable
  deploy."* The user's instinct is narrow scope; the frame's job was to confirm
  it with evidence or surprise it.

## Dimension Map

Each adjacent concern is either a HARD DEPENDENCY of the host move, a STACKING
RISK to sequence out, or OPTIONAL polish:

1. **Host + deploy mechanism** — Railway service, root-dir=`supply-os-v1`,
   `Procfile`/`$PORT`, builder pin, auto-deploy on push, `vercel.json` cutover,
   droplet decommission, rollback rehearsal.  ← core / stated scope
2. **Secrets migration** — Google SA JSON (+ `\n` footgun), tokens, sheet id,
   CORS origins.  ← hard dependency?
3. **Datastore Sheets→Postgres** — `_choose_backend()` seam.  ← STACKING RISK vs HARD DEP? *(axis of dispute)*
4. **CI deploy automation** — `ci.yml` tests-only; Railway native auto-deploy.  ← gap or already closed?
5. **Observability (PostHog error tracking)** — independent of host.  ← sequenceable?
6. **Domain (nip.io → custom)** — `vercel.json` changes on cutover anyway.  ← optional polish?
7. **Git hygiene / deployable source of truth** — Railway deploys *from git*.  ← surfaced during investigation, was on nobody's map

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| **(3) Datastore migration is a HARD dependency of the host move** | `sheets.py:103-141` `_client()` loads creds from inline/env (no file needed); all order/inventory persistence is via the Sheets API over HTTPS — zero local disk writes on the sheet path. `main.py:204` `_choose_backend()` is host-agnostic. Sheets runs unchanged on an ephemeral Railway container. | **NONE** (it's a stacking risk, not a dependency) |
| **(2) Secrets migration is a HARD dependency** | Railway service boots but every authed endpoint 401/500s and Sheets auth fails cold without the secrets. `infrastructure.md` "Getting Started" §3 + the `\n`-corruption unknown-unknown. Cannot be deferred. | **STRONG** (in scope) |
| **(7) Git is the deployable source of truth — drift regresses on Railway** | Railway deploys `main`. Known session hot-patches are confirmed *in main* as real commits: `dc5e29c` (seam fix), `58e5a48` (P006), `0e438e0` GR-01 + phases. **But this worktree HEAD (`0d7ff14`) is 13 commits BEHIND main** (`HEAD..main`=13, `main..HEAD`=0) — which is why the worktree's `main.py:101-113` still shows the seam violation that `main` already fixed. | **STRONG** (in scope, as a prerequisite/verification gate) |
| **(4) CI needs a deploy job for Railway** | `.github/workflows/ci.yml` is tests-only by design; `deployment-plan.md §6`: "CI never deploys." Railway's native GitHub integration auto-deploys on push (one-time dashboard link, no YAML). | **NONE** (already closed; only `railway.toml` builder-pin needed) |
| **(5) PostHog is a dependency of the host move** | `infrastructure.md` sequences it as step-1 *alongside* Supabase/CI against the existing pilot — not a prerequisite of the Railway boot. Two env vars + a package; service starts without it. | **NONE** (sequenceable) |
| **(6) Domain move is required** | Railway gives a working `*.up.railway.app` immediately; the `vercel.json` rewrite must change to that URL on cutover regardless. nip.io→custom is polish. | **NONE** (optional) |

## Narrowing Signals

- **`_choose_backend()` is host-agnostic** (`main.py:204-213`) — the seam was
  built to decouple host from datastore. Decisive: it rules datastore OUT as a
  dependency of the host move.
- **No local file writes on the sheet code path** (full `app/` I/O scan: only
  `config.py:23` seed_dir + `sheets.py:121` optional SA-file + `seed_loader.py:48`
  — all seed-only or conditional). Decisive: no persistent-disk requirement.
- **This worktree is 13 commits behind `main`** (git verified). Decisive: it
  reframes "fix the deploy" into "make git the source of truth, and start from
  current main."
- **One pre-existing snag (not Railway-specific):** `ci.yml` frontend job runs
  `npm run test`; a vitest runner must exist or the gate fails. Pre-existing gap,
  worth confirming before first push.

## Cross-System Convention

`infrastructure.md` "Rollout Sequencing — sequence, don't stack" (and the Railway
pre-mortem: *"because DB and rollout changed together nobody could localize the
incident"*) is a **project-specific ruling**, not generic best practice. It
explicitly orders: migrate datastore + CI + PostHog → run the existing pilot
until boring → *then* scale; and Railway PG co-location re-enters *"only once
backend→Railway"* (i.e. after Railway is proven). A combined host+datastore
cutover is the named failure path. The leading hypothesis matches the
convention exactly.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: execute a clean, *isolated* backend
> host migration to Railway with the Sheets datastore kept unchanged behind
> `_choose_backend()`, making **`main` (git) the deployable source of truth** —
> explicitly NOT bundling the Postgres migration, observability, or domain
> changes.

The user's "minimal" instinct is correct and now evidence-backed: the host move
has no technical dependency on the datastore (the seam + zero-disk sheet path
prove it), and `infrastructure.md`'s own pre-mortem forbids stacking the
datastore cutover here. The one thing the user did *not* ask about but that the
investigation surfaced — git hygiene — belongs in scope: Railway deploys from
git, so the change must (a) be planned/implemented against **current main**, not
this 13-commit-stale worktree, and (b) confirm `main` reflects everything
actually running in prod before cutover (the known hot-patches are confirmed in
main; the verification gate is what makes "repair the pipeline" real).

## Confidence

**HIGH** — two independent sub-agents converged (host-portability: no filesystem
dependency; scope-classification: datastore is a stacking risk), git archaeology
confirmed both the in-main patches and the worktree staleness, and the leading
hypothesis matches `infrastructure.md`'s explicit ruling. No credible
counter-evidence survived the steelman (co-located Railway PG is a real benefit
but available in the *next* change, once Railway is boring).

## What Changes for /10x-plan

Plan a **host-only** Railway migration. In scope: Railway service +
root-dir/`Procfile`/`$PORT` + `railway.toml` builder pin + secrets migration
(SA JSON via file-var or base64, resolving the `\n` footgun; tokens; sheet id;
CORS) + `vercel.json` rewrite cutover + rollback rehearsal + droplet
decommission + the git-hygiene prerequisite (work from current `main`; confirm
`main` == prod-intent). Out of scope, sequenced as the *next* change:
Sheets→Supabase. Out of scope, sequenceable: PostHog, custom domain. Already
closed: CI deploy automation.

## References

- Source files: `supply-os-v1/app/main.py:204` (`_choose_backend`),
  `supply-os-v1/app/sheets.py:103-141` (`_client` cred loading),
  `supply-os-v1/Procfile:1`, `frontend/vercel.json`, `.github/workflows/ci.yml`
- Git facts: `dc5e29c`/`58e5a48`/`0e438e0` in `main`; worktree `0d7ff14` is 13 commits behind `main`
- Related research: `context/changes/deploy-pipeline-repair/research.md`
- Convention: `context/foundation/infrastructure.md` "Rollout Sequencing", Railway pre-mortem
- Investigation tasks: #5 (host-portability), #6 (scope-boundary classification)
