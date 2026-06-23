---
name: 10x-autonomous-workflow
description: >
  Use this when the user names ONE feature or bug and asks you to carry it through the
  ENTIRE 10x workflow yourself in a single hands-off run — the whole pipeline, not one
  phase — while signaling you should keep going on your own ("don't pause", "without
  approving each step", "nie pytaj na każdej bramce", "samodzielnie aż do końca", "keep
  going until it's verified green", "only stop if genuinely ambiguous"). This is the
  ORCHESTRATOR: it drives scaffold → (optional frame/research) → plan → plan-review loop
  → implement → impl-review → fix-every-finding loop → /verify (+ UI preview) → propose
  archive by invoking the existing 10x skills (10x-new, 10x-frame, 10x-research, 10x-plan,
  10x-plan-review, 10x-implement, 10x-impl-review, verify, 10x-archive) in order and
  closing the review loops itself; it never reimplements them. Strong triggers: "10x
  autonomous workflow", "autonomiczny workflow 10x", "pełna autonomiczna pętla 10x",
  "full/whole 10x loop end-to-end", "run the whole 10x loop on X", "zrób cały 10x na X",
  "take X all the way through 10x autonomously", "przeprowadź autonomicznie przez cały
  workflow 10x", "od pomysłu do zweryfikowanej implementacji", "od pomysłu do wdrożenia
  bez pytania na każdej bramce". Do NOT use for a SINGLE phase (just planning → 10x-plan;
  just a review → 10x-plan-review / 10x-impl-review), and do NOT use when the user is
  already mid-loop and wants only the remaining step (they have a plan.md and want
  implementation → call 10x-implement directly).
---

# 10x Autonomous Workflow

Take one change from idea to a verified, fully-fixed implementation by running the
existing 10x skills in order, with the review loops closed automatically. The point is
**autonomy**: you walk every gate yourself and only stop the user for the few decisions
that are genuinely theirs (see *Autonomy & stop conditions*).

You are the conductor, not the orchestra. Every phase below is **the corresponding 10x
skill invoked via the Skill tool** — do not re-derive their logic here. Your job is
sequencing, closing the loops, deciding when a decision is hard enough to deserve an
adversarial pass, and knowing when to stop.

## Why you can run this without the user

The Skill tool runs a skill **inline in this same conversation** — the sub-skill's
instructions become *your* instructions, and *you* decide which tools to call while
executing them. So when a sub-skill's text says "ask the user via AskUserQuestion"
(impl-review's triage prompt, plan's clarifying questions), you do **not** emit that
modal: you answer it yourself from the change's own artifacts and the autonomy policy,
and move on. You surface a real question to the user only when answering would cross a
stop condition. This is the entire mechanism that makes the loop autonomous — keep it
in mind at every gate.

## Before you start

1. **Load the guardrails.** Read `CLAUDE.md` and the per-area `AGENTS.md`
   (`supply-os-v1/AGENTS.md`, `frontend/AGENTS.md`) if not already in context. These
   are your fences for the whole run — most importantly: **never place a real supplier
   order or send a real dispatch from a test**, backend persistence only through
   `_choose_backend()`, frontend API only via `apiClient.ts` and copy only via
   `i18n/`, never commit secrets.
2. **Derive the change.** From the user's request, derive a kebab-case `<change-id>`
   and a one-line intent. If the request is too vague to even name what is being built,
   that's an ambiguity stop — ask one focused question first.
3. **Pre-flight for resume (idempotent re-entry).** Check whether
   `context/changes/<change-id>/` already exists. If it does, **do not call 10x-new**
   (it hard-stops on collision). Instead, detect how far the run got from the artifacts
   present — `change.md` (Phase 1 done), `plan.md` (planned), `reviews/impl-review.md`
   (reviewed), `verification/` (verified) — and resume from the furthest incomplete
   phase. Tell the user: "Found existing `<change-id>` — resuming from Phase N." A
   retried or interrupted run is the common case; treat re-entry as a feature.
4. **Open a progress task.** `TaskCreate` "10x autonomous workflow: `<change-id>`" and
   keep it updated per phase so the user can watch the long run without being
   interrupted by it.
5. **Announce, then go.** State the change-id and that you'll run the full loop
   autonomously, stopping only for the documented conditions. Then run — don't wait for
   an "ok".

## The pipeline

Run phases in order. Each `Skill(...)` is the real sub-skill; `args` is its
`<change-id>` unless noted.

### Phase 1 — Scaffold + plan

1. `Skill(10x-new, args="<change-id> <intent>")` → creates `change.md`. (Skip if the
   pre-flight found an existing folder.) 10x-new prints its own next-step suggestion —
   **you are the routing authority**, not its printout; decide the next step from the
   criteria below.
2. **Route the framing (situational).** The goal is to give the plan enough grounding
   that it can write itself without interrogating the user:
   - Request is **bug-shaped** (a symptom stated together with its supposed cause) or a
     **scope/design question** → `Skill(10x-frame, args="<change-id>")` first. Framing
     a real fork in WHAT to build is a *hard task* — run the adversary pair before
     committing to a direction.
   - The plan genuinely **cannot be written without first mapping unfamiliar code**
     (not merely because the change touches two directories) →
     `Skill(10x-research, args="<change-id>")`.
   - The intent is clear and the code is familiar → straight to planning. But if you
     skip both frame and research, make sure `change.md`'s intent is rich enough for
     the plan to proceed; if it isn't, run research/frame anyway — precisely so the
     plan has context to self-answer from instead of needing the user.
3. `Skill(10x-plan, args="<change-id>")` → writes `plan.md`. Plan design is a *hard
   task* whenever it crosses the criteria below — run the adversary pair on the shape
   of the plan **before** you let it settle.

### Phase 2 — Plan-review loop (repeat until clean)

1. `Skill(10x-plan-review, args="<change-id>")`.
2. Substantive findings → apply the fixes to `plan.md` (adversary pair for any
   HIGH-impact or genuinely-contested finding), then **re-run plan-review**.
3. Repeat until the review is clean — no substantive findings (pure optional nits may
   be folded in on the same pass rather than forcing another loop). Plan text is
   deterministic, so this converges quickly; if three rounds don't reach clean, stop
   and escalate with the residual findings.

### Phase 3 — Implement

`Skill(10x-implement, args="<change-id>")`. Let it drive the plan's phases and its own
per-phase verification. Honor the guardrails throughout (no real dispatch/order; data
through the seam; i18n/apiClient on the frontend). You need not commit — the working
tree carries the changes for review and verification.

### Phase 4 — Implementation review

`Skill(10x-impl-review, args="<change-id>")` over the full plan. Always pass the
`<change-id>` so it resolves via the plan path (this is robust regardless of
`change.md`'s status between rounds, and impl-review scopes primarily off the plan's
declared file list plus the working-tree diff). Drive it to **produce the saved
report** at `reviews/impl-review.md` — when it asks how to proceed, answer "Save report
only" (rationale: Phase 5 applies the fixes in a dedicated loop, so interactive triage
now is wasted double-work). If it returns **REJECTED** with a CRITICAL you cannot fix
without a decision that's the user's to make, that's a stop — escalate rather than
grinding.

### Phase 5 — Fix-EVERY-finding loop (repeat until clean)

This is the loop the user cares about most. **Each round, apply every finding the
review raised — every severity, cosmetic OBSERVATIONS included. Do not pre-filter a
finding as "not worth it."** A clean review is the bar, not "good enough."

1. Read `reviews/impl-review.md`. For each finding:
   - One fix option → apply it.
   - Two options → apply the `⭐ Recommended` one; if none is marked, pick the option
     that best fits existing patterns/seams with the smaller blast radius. Genuinely
     contested or Impact-HIGH → run the **adversary pair** first.
   - Edits stay **minimal and targeted** (the impl-review discipline) — fix what was
     flagged, don't refactor around it.
2. Re-run `Skill(10x-impl-review)` (save report only).
3. Repeat.

**Converging honestly.** impl-review's sub-agents are non-deterministic, so the last
residue is often fresh OBSERVATION-level subjective nits regenerated on the code you
just touched — chasing those forever is not progress. The loop has **converged** when a
round comes back with **no CRITICAL or WARNING findings** and every OBSERVATION is
either already addressed once, a documented false-positive, or a documented hard-rule
conflict. Record any such residual OBSERVATIONS with a one-line note each in the report
and proceed — this is a clean finish, not an escalation. The *only* findings you may
leave unfixed are a fix that would violate a hard repo rule or a genuine false
positive, each documented (and escalated if non-obvious). **Escalate** only if a
CRITICAL or WARNING survives with no progress after **3** fix→review rounds.

### Phase 6 — End-to-end verification

1. `Skill(verify)` — backend `ruff check .` + `pytest`, frontend `npm run build` +
   `npm run lint`. Report PASS/FAIL per step; never claim green on a failure.
   Verification runs locally against the **seed/test backend** (pytest's default, no
   cloud creds) — never point tests or the app at the production Supabase/Sheets
   backend, and never let a submit/dispatch path reach a real supplier (it must back
   out or use safe test data). Fix real failures and re-run until green. Budget: after
   **3 attempts** on the *same* failure with no progress, stop and escalate.
2. **UI-visible change** (anything under `frontend/` a user would see): also run the
   harness preview verification — start the preview, reload, check console/network for
   errors, snapshot the changed screen, exercise the changed interaction — and capture
   a screenshot as proof. If the preview harness or screenshot tool is unavailable,
   record what you tested in `verification/preview-notes.md` (route, interaction,
   console/network status) instead — a manual note beats a skipped step.
3. **Save proof** under `context/changes/<change-id>/verification/`
   (`verify-output.md`, `preview.png` or `preview-notes.md`) so the run is auditable.

> Frontend env gotcha: if `npm run build`/`vite` fails *loading native rollup*, that's
> the local node build, not a code defect — re-run with Homebrew node on PATH
> (`PATH=/opt/homebrew/bin:$PATH npm run build`). It doesn't count against the budget.

### Phase 7 — Closeout

Summarize what shipped: change-id, what was built, plan-review and impl-review both
clean, /verify green (with saved proof), and any documented exceptions. Then
**propose** `10x-archive` — do not run it automatically. Archiving is the natural human
handoff; offer it and let the user pull the trigger.

## Driving sub-skills autonomously

The sub-skills were written for an interactive human and contain their own
`AskUserQuestion` checkpoints. Per *Why you can run this without the user*, you answer
those yourself from the change's artifacts (`change.md`, `research.md`, `frame.md`,
`plan.md`) and proceed. Default resolutions:

- **impl-review "how to proceed?"** → "Save report only" (you fix in Phase 5).
- **plan / plan-review clarifications** → answer from the gathered context; pick the
  option most consistent with the plan intent and repo rules. If the context is too
  thin to answer responsibly, that's a signal you skipped grounding you needed — go
  back and run 10x-research/10x-frame rather than interrogating the user.

Surface a sub-skill's prompt to the user **only** when answering it would cross a stop
condition. When a sub-skill hard-errors on something you can't resolve from the request
(10x-new change-id collision you didn't pre-empt, missing `context/changes/`), stop and
report it.

## Hard tasks → the adversary pair

Routine work needs no ceremony. On **hard tasks** you summon two subagents **in
parallel** (one message, two `Agent` calls) to pressure-test the decision — the single
most valuable thing this orchestrator adds over running the skills by hand.

**Proactive — before committing a direction.** Trigger when the plan (or a frame fork)
introduces a non-trivial architectural choice: a new module/seam, a change near
`_choose_backend()`, new data entities/schema, auth, dispatch/email paths, or a
cross-cutting refactor touching ~5+ files. **Hard-rule territory always triggers the
proactive pair** regardless of apparent size (persistence seam, two-token auth,
`order_lines` columns, anything dispatch/order-status) — its blast radius is always
larger than it looks.

**Reactive — when already stuck.** Trigger when a single finding or question has been
re-flagged across **two consecutive review rounds** without resolution, or a finding is
rated **Impact HIGH** (not MEDIUM — MEDIUM is common; HIGH means architectural stakes
with a wide blast radius).

Skip the pair for low-impact, single-file, pattern-matching work — it would only add
latency. (Genuinely *missing* requirements are not a hard task — they're a stop
condition. Adversaries are for hard-but-resolvable calls, not for guessing intent.)

**Invocation** — give both agents the *same* bundle (the decision, the proposed
approach, relevant `file:line`, the plan excerpt, the repo rules in play):

- **Devil's advocate** — "Attack this approach. Find the flaws, risks, edge cases, and
  assumptions that may not hold. Do NOT propose a replacement — stress-test what's on
  the table. End with the single most likely way this goes wrong."
- **Constructive critic** — "Propose the strongest *alternative* and argue why it's
  better on this repo's terms — simplicity, fit with `_choose_backend()` and existing
  patterns, smaller test surface, reversibility. End with one concrete recommendation."

**Reconcile into one decision.** Weigh both against the repo's rules and the plan's
intent. On conflict, prefer the option that: (1) violates no hard rule, (2) best fits
existing patterns/seams, (3) has the smaller blast radius and test surface, (4) is more
reversible. Still tied → take the simpler path and carry the devil's-advocate's top
risk forward as something to confirm in verification. Write the reconciled decision
(2–4 sentences, including the risk you're accepting) into the change folder (plan Notes
or a short decision note) so it's auditable. Then proceed — don't bounce it to the user
unless it hit a stop condition.

## Autonomy & stop conditions

**Default: proceed through every gate without asking.** That is the whole point.

**Stop and ask the user only when:**
- **An irreversible or outward-facing action would be required** — deploy, push,
  sending an email, dispatching, or **placing a real supplier order**. HARD RULE: never
  place a real order or send a real dispatch from this loop; tests and verification
  back out or use safe test data, against the seed/test backend only. Implementation +
  verification stay local.
- **impl-review returns REJECTED** with a CRITICAL you can't fix without a user-level
  decision.
- **Repeated failure** — 3 attempts on the same verification failure, or 3 fix→review
  rounds with a surviving CRITICAL/WARNING, with no progress.
- **Genuine ambiguity in WHAT to build** — a requirement gap that changes the outcome,
  not merely the implementation detail. Ask one focused question, then resume.

**Do not** commit or push as part of this loop unless the user explicitly asked —
implement and verify; leave version control and deployment to the user. Archiving
(Phase 7) is *proposed*, never auto-run.

## Operating notes

- **Keep the main context lean.** Let each sub-skill and its sub-agents read the files
  they need; don't pre-read source into the orchestrator context. The durable state is
  the change folder (`plan.md`, `reviews/`, `verification/`) — re-read those rather
  than holding everything in context. This also makes resume (pre-flight) reliable.
- **Update the progress task** at each phase boundary so the long run is legible.

## Definition of done

Before you call the run complete, confirm every box:

- [ ] `context/changes/<change-id>/` has `change.md` and `plan.md`.
- [ ] Plan-review loop ended **clean** (no substantive findings).
- [ ] Implementation complete — all plan phases done.
- [ ] impl-review **converged**: no CRITICAL or WARNING findings; every OBSERVATION
      fixed or documented (false-positive / hard-rule conflict) — flagged to the user
      if non-obvious.
- [ ] `/verify` green — backend `ruff` + `pytest`, frontend `build` + `lint`.
- [ ] UI-visible change: preview verified, screenshot (or `preview-notes.md`) captured.
- [ ] Proof saved under `context/changes/<change-id>/verification/`.
- [ ] `10x-archive` proposed (not auto-run).

If any box is unchecked and isn't covered by a documented stop/escalation, the run
isn't done — keep going.
