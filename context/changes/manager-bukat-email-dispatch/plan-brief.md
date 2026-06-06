# Manager Bukat Email Dispatch (S-02) — Plan Brief

> Full plan: `context/changes/manager-bukat-email-dispatch/plan.md`
> Research: `context/changes/manager-bukat-email-dispatch/research.md`

## What & Why

S-02 is the roadmap **north star** — the terminal proof of the governing rule (one path from cooler to supplier): a real Wola×Bukat order leaves the system as a ready-to-send Gmail draft, in correct purchase units, after the Captain's stock-based submission flowed through the Manager queue. Research found the entire flow is **already built and supplier-agnostic**, so — like S-01 — this is a *validation* slice: prove it works for Bukat via a manual sheet-mode smoke, and close the single highest-value test gap.

## Starting Point

Backend dispatch (`main.py:1157-1300`), the Gmail builder (`gmail_url.py`), and the full Manager frontend (queue → claim → edit/save → send-back → dispatch-opens-Gmail-draft) are all wired, channel-aware, and free of Bukat hardcodes. F-01 already corrected Bukat's master data (`biuro@bukat.com`, `ordering_method=email`). 217 tests pass — but all Pago, with no `conftest.py` and no assertion that dispatch preserves per-line history.

## Desired End State

A focused regression test guards that dispatch never overwrites captain/suggested/reason columns; a session-scoped `conftest.py` makes the suite order-independent *and* unconditionally safe against the live sheet; both email-body builders carry a NOTE about their divergence; and a manual Wola×Bukat smoke has run the full chain through to a verified Gmail draft and **backed out without sending**. S-02 is ready for `/10x-archive`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Slice scope | Smoke + 1 regression test | North star deserves more than S-01's smoke-only; per-line-history (FR-011) is a PRD guardrail that's currently untested. | Plan |
| Which test | Per-line history preservation on dispatch | Highest value-per-effort; asserts key-absence in the write payload, robust + cheap. | Plan |
| Two email builders | Leave + NOTE (S-09 style) | Unifying is a real UI change with regression risk on the north star; a 2-line note documents the trap. | Research → Plan |
| Smoke breadth | Full chain (claim→edit/save→send-back→dispatch) | Covers the whole S-02 outcome (FR-007/008/009/010), not just the email. | Plan |
| conftest.py | Add session-scoped; also force `seed` backend | Closes `lessons.md` order-dependence debt AND neutralizes the sheet-mode `.env` footgun so tests never hit the live sheet. | Research → Plan |

## Scope

**In scope:** one history-preservation test in `test_manager_dispatch.py`; new `tests/conftest.py` (tokens + seed backend); NOTE comments in `gmail_url.py` + `emailBody.ts`; the manual full-chain Bukat smoke with clean back-out.

**Out of scope:** unifying the two builders; a Bukat fixture / e2e chain / units-edge tests; removing per-file env preambles; any endpoint/model/Gmail-logic change; dispatching a real Bukat order; closing the roadmap item (that's `/10x-archive`).

## Architecture / Approach

Two phases. **Phase 1 (automated):** the test + `conftest.py` + NOTE comments — all gated by `pytest` (218), a 2-file subset for order-independence, `ruff`, and the frontend type-check. **Phase 2 (manual, no diff):** submit a Bukat order as Captain → claim → edit/save → send-back/resubmit → dispatch → verify the **frontend** Gmail draft (recipient/purchase-units/PL total/address) → close unsent + delete the test rows from the live sheet.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Test + safety hardening | History-preservation test, session `conftest.py`, builder NOTEs | conftest must set identical tokens (verified) + not break the 217 existing tests |
| 2. Manual Bukat smoke | Full-chain dispatch verified against the live sheet, backed out | Accidentally clicking Send / leaving test rows in the sheet (mitigated by explicit back-out) |

**Prerequisites:** S-01 done (✓); sheet-mode `.env` + `sa.json` + live sheet id present locally (✓ from F-01/S-01); both tokens set; frontend on Homebrew node (rollup gotcha).
**Estimated effort:** ~1 session — small automated phase + a guided manual smoke.

## Open Risks & Assumptions

- The smoke verifies the **frontend** `emailBody.ts` draft (what reaches Bukat), not the backend `gmail_url.py` URL — confirmed in research.
- Operational go-live gate (who holds the Manager token at Wola, Open Roadmap Q1) does not block the smoke; the owner can hold it during the test.
- `conftest.py` forcing `seed` is safe because every dispatch test patches `sheets.settings.data_backend` directly per-test; the global default only matters for non-mocked paths.

## Success Criteria (Summary)

- Dispatch is proven (by test) to preserve captain/suggested/reason history; the suite passes order-independently and with the sheet-mode `.env` present.
- A Wola×Bukat order has gone Captain-submit → claim → edit/save → send-back → dispatch → verified Gmail draft, and been backed out with no real order placed.
- S-02 ready to archive.
