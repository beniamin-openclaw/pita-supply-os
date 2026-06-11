# Railway Backend Host Migration — Plan Brief

> Full plan: `context/changes/deploy-pipeline-repair/plan.md`
> Frame brief: `context/changes/deploy-pipeline-repair/frame.md`
> Research: `context/changes/deploy-pipeline-repair/research.md`

## What & Why

Execute a clean, isolated backend host migration to Railway with the Sheets
datastore kept unchanged behind `_choose_backend()`, making **`main` (git) the
deployable source of truth** — explicitly NOT bundling the Postgres migration,
observability, or domain changes. This repairs a pipeline that was never
automated (deploys were manual rsync, disconnected from git) and unlocks the
agent-operable deploy/rollback loop both Railway triggers (scale + agent-owned
deploys) call for.

## Starting Point

The backend runs on a DigitalOcean droplet via a flat rsync copy of `app/` that
is not a git checkout; `git push` never deployed it. The code is already
Railway-ready: `Procfile` binds `--port $PORT`, `config.py` is fully env-driven,
and `_client()` loads credentials from an env string with zero local-disk
dependency on the sheet path. The worktree is now fast-forwarded to current
`main` (carries the seam fix, P006, and GR-01 as real commits).

## Desired End State

The backend runs on Railway, auto-deploying on push to `main`. `vercel.json`
rewrites `/api/*` to the Railway URL; the droplet service is stopped+disabled
(code kept as a warm fallback) after one green pilot cycle. A committed
`RAILWAY_DEPLOY_RUNBOOK.md` makes the deploy repeatable and the agent can run
`railway logs` / `railway redeploy` for the deploy/rollback loop.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Datastore in scope? | No — sequence it next | `_choose_backend()` keeps Sheets on Railway unchanged; infra.md forbids stacking | Frame |
| Adjacent items (PostHog/domain)? | Out — minimal scope | Not host-move dependencies; sequenceable | Frame |
| Git source of truth | Deploy from current `main` | Railway deploys from git; worktree was 13 commits behind | Frame |
| SA JSON handling | base64 inline via a centralized resolver (Sheets + Drive) | CLI-safe single line for `railway variables --set`; one loader so b64 works for both backends | Plan |
| Cutover strategy | Parallel run + flip `vercel.json` | Rollback = revert one commit (~1 min); droplet is the safety net | Plan |
| Agent/owner split | Agent prepares artifacts; owner runs prod | Prod secrets stay with the owner (hard rule) | Plan |
| Droplet decommission | Keep warm 1 cycle, then stop+disable | Instant fallback in the risky window; reversible | Plan |

## Scope

**In scope:** base64 SA-JSON credential support + test; `railway.toml` builder
pin; `.env.example` docs; `RAILWAY_DEPLOY_RUNBOOK.md` + dry-run-safe smoke kit;
`vercel.json` cutover; droplet stop+disable; roadmap close-out.

**Out of scope:** Sheets→Postgres migration (next change); PostHog; custom domain;
CI deploy job (Railway-native); any code-behavior change; droplet deletion.

## Architecture / Approach

Agent-prepared, fully-committable artifacts land first (base64 creds, builder pin,
runbook, smoke kit). The owner then runs the Railway deploy + secret-setting via
the runbook; the agent prepares the `vercel.json` flip as a reviewable commit the
owner merges/pushes to repoint traffic. The droplet stays running as the rollback
target (revert one commit). The agent never handles a production secret.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend creds + Railway config | centralized base64 SA-JSON resolver + test, `railway.toml`, `.env.example` | Missing a cred consumer (Sheets gate / GR-01 Drive) — mitigated by routing all four through one resolver |
| 2. Deploy runbook + smoke kit | `RAILWAY_DEPLOY_RUNBOOK.md` + dry-run-safe smoke script | Runbook missing an env var or a step that needs agent secrets |
| 3. Production cutover (owner) | `vercel.json` flip; live Railway deploy + smoke | Sheets/Drive auth under Railway env; body-size limit on WZ upload |
| 4. Decommission + close-out (owner) | droplet stop+disable; roadmap updated | Decommissioning before the cycle proves Railway boring |

**Prerequisites:** Railway account + CLI (owner); the production secret values
(owner's droplet `.env`); the worktree on current `main` (done).
**Estimated effort:** ~1 session for Phases 1-2 (agent); Phases 3-4 are owner-run
across one pilot cycle (a few days warm-window).

## Open Risks & Assumptions

- The inline service-account JSON must round-trip through Railway env correctly —
  base64 is chosen specifically to de-risk this; verified by the Phase 1 test +
  the Phase 3 live smoke.
- GR-01 WZ-photo multipart upload assumes Railway imposes no prohibitive request
  body limit — verified by one real upload in Phase 3 (photos are client-compressed).
- The Railway URL is unknown until `railway up`; the `vercel.json` destination is
  filled from that output during Phase 3.

## Success Criteria (Summary)

- Prod (via the Vercel domain) serves through Railway against the live Sheet; one
  back-out captain submit + one GR-01 WZ upload succeed on the new stack.
- A push to `main` auto-deploys the backend (pipeline repaired; git is the source
  of truth).
- Rollback is a one-commit revert; the droplet is decommissioned only after one
  green pilot cycle.
