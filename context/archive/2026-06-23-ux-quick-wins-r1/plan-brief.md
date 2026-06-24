# UX Quick-Wins Round 1 — Plan Brief

> Full plan: `context/changes/ux-quick-wins-r1/plan.md`

## What & Why

Five owner-requested UX quick-wins for the Captain/Manager flows, shipped as one
change in five phases. They remove friction the owner hit in demo feedback:
over-strict deviation gating, meaningless ∞ percentages on bucket SKUs, a colour
collision between variance and deviation, silent pre-filling at goods-receiving,
and hard-to-find order history.

## Starting Point

Working prod app (Railway backend + Vercel frontend, Supabase datastore). The
deviation gate is 20% across backend (`main.py`) and frontend (`compute.ts`);
variance and deviation both render amber/red; the receiving screen pre-fills
delivered = ordered; order history exists at `/captain-v2/orders` but isn't in the
persistent tab bar.

## Desired End State

24% deviations need no reason (26% still do); suggestion-0 lines show "brak bazy"
not "+∞%"; variance is sky/indigo and deviation stays amber/red; receiving starts
blank and forces a conscious count per line; a "Historia" tab reaches order history
in one tap from any captain screen.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Threshold operator | Keep `>` gate / `>=` badge, just swap 0.20→0.25 | Preserves existing boundary semantics; parity with frontend | Plan |
| Phase 1 i18n | No string edit | Copy uses runtime `{pct}`; no literal "20%" exists | Research |
| Boundary tests | Add 22% (FE+BE) regression cases | Existing tests use 100% deviations — boundary was untested | Research |
| Phase 2 scope | Display-only guard, keep gate/state | Owner asked only to fix the shown % | Owner |
| Variance hue | sky (over) / indigo (under) | Clear of amber/red deviation and blue manager-Δ | Research |
| Recount gate | Blank-until-entered + one-tap "= zamówione" | Forces intent with least friction | Owner |
| History nav | Persistent `CaptainTabs` "Historia" tab | One tap from every screen; hamburger/inline already exist but aren't sticky | Research |

## Scope

**In scope:** deviation threshold (BE+FE), no-baseline copy (FE), variance recolour
(FE), receiving recount gate (FE), persistent history tab (FE).

**Out of scope:** `ManagerSuggestionReviewPage` heat-bands; backend deviation math;
receipt-save/lock/photo flow; a new receipts route.

## Architecture / Approach

Five sequential commits. Phase 1 changes backend + frontend together and runs both
test suites for parity. Phases 2–5 are frontend-only. A shared
`formatDeviationPct` helper centralizes the Phase 2 guard.

## Phases at a Glance

| Phase | Delivers | Key risk |
| --- | --- | --- |
| 1. Threshold 20→25% | BE+FE gate + badge at 0.25 + regression tests | BE/FE drift if not changed in lockstep |
| 2. No-baseline copy | "brak bazy" instead of ∞/large % | Pill grammar when {pct} sits in a sentence |
| 3. Variance hue | sky/indigo variance | Picking a hue that collides elsewhere |
| 4. Recount gate | Blank-until-entered + "= zamówione" + submit gate | Breaking the save/photo/lock flow |
| 5. History tab | Persistent "Historia" tab | Crowding the mobile tab bar (3 tabs) |

**Prerequisites:** none. **Estimated effort:** ~1 session, 5 commits.

## Open Risks & Assumptions

- Phase 2 pill wording: keeping the reason-required STATE while changing only the
  shown text is correct (it matches the backend gate); a dedicated message variant
  avoids awkward grammar.
- Three tabs must remain legible on a ~380px phone (flex-1 split).

## Success Criteria (Summary)

- 24% no reason / 26% reason, BE+FE agree.
- No giant/∞ % anywhere a suggestion is 0.
- Variance and deviation never share a hue on one screen.
- A receipt can't be submitted without a conscious value per line.
- Order history is one obvious tap from the primary captain screen.
