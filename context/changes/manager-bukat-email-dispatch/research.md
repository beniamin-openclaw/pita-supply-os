---
date: 2026-06-06T09:13:12+0200
researcher: Beniamin
git_commit: 12acbbd67e27c77c1a76ca12581b24423c8cad28
branch: main
repository: beniamin-openclaw/pita-supply-os
topic: "S-02 — Manager dispatches the Wola×Bukat order by email (north star)"
tags: [research, codebase, manager-dispatch, gmail, channel-aware, per-line-history]
status: complete
last_updated: 2026-06-06
last_updated_by: Beniamin
---

# Research: S-02 — Manager dispatches the Wola×Bukat order by email

**Date**: 2026-06-06T09:13:12+0200
**Researcher**: Beniamin
**Git Commit**: 12acbbd67e27c77c1a76ca12581b24423c8cad28
**Branch**: main
**Repository**: beniamin-openclaw/pita-supply-os

## Research Question

For the north-star slice S-02 (`manager-bukat-email-dispatch`, roadmap lines 94–104 — outcome: Manager claims → edits/saves or sends-back → dispatches the Bukat order by email producing a ready-to-send Gmail draft in purchase units, with per-line history recorded; PRD US-01, FR-006…FR-011): map the full Manager-dispatch surface (backend + frontend + tests), and gap-hunt the four risk areas — **(1) email content + purchase units**, **(2) frontend Manager UX**, **(3) status workflow + per-line history**, **(4) test coverage + manual smoke** — to determine what S-02 actually has to *build* vs *validate*.

## Summary

**S-02 is built. Like S-01, the slice is validation + a manual sheet-mode smoke, not a feature build.** Every backend endpoint (queue / claim / release / save / dispatch) and the entire Manager frontend (queue → claim → edit/save → send-back → email dispatch that opens a ready-to-send Gmail draft) are present, wired, and channel-aware. There are **no Bukat hardcodes** anywhere — dispatch is fully generic and driven by master data, which F-01 already corrected (`SUP_BUKAT` email `biuro@bukat.com`, `ordering_method=email`). So the residual risk is **operational, not build**: right recipient, right purchase units, correct Polish body — verified by opening the draft and **backing out without clicking Send** (hard rule: never place a real Bukat order from a test).

Three findings shape the plan:

1. **There are TWO email-body builders, and the one the operator actually sees is the frontend one.** `app/gmail_url.py` (backend) builds the `gmail_compose_url` returned in the dispatch response — but the frontend does **not** use it to open the draft. The frontend rebuilds the URL **client-side** from *editable* subject/body fields (`frontend/src/pages/manager/lib/emailBody.ts`) and opens it via a same-click `<a href>`. The backend URL is only stashed for a session-only "re-open" link. ⇒ **The smoke must verify the FRONTEND draft content** (that's what reaches Bukat); the backend builder is a parallel implementation that the response carries but the open-path ignores. This is a divergence in the same spirit as the S-09 `compute.ts`↔`suggestion.py` split.

2. **Test coverage proves the mechanism is supplier-agnostic but gives zero Bukat-specific confidence.** All 13 `gmail_url` content tests + 22 dispatch tests are `SUP_PAGO`. No Bukat fixture, no end-to-end `submit→claim→dispatch` chain, no per-line-history-non-regression assertion on dispatch, units only at a single `units_per_purchase_unit=5.0` granularity. (217 tests pass on `main`; root `CLAUDE.md` "196 tests" is stale.)

3. **Dispatch is sheet-mode-only** (seed returns 503 for every write; queue returns `[]`). The smoke requires the live-sheet `.env` (already configured locally from F-01/S-01) and both tokens set.

**Net:** the plan is most likely a thin one — (a) optional small test additions to close the Bukat/e2e/history gaps, (b) the manual sheet-mode smoke (submit a Bukat order → claim → dispatch → verify Gmail draft → back out), (c) roadmap close. No backend or core-UI changes are required for the flow to work.

## Detailed Findings

### Area 1 — Backend dispatch + email content (FR-010, FR-011)

`POST /api/manager/dispatch` ([main.py manager_dispatch](https://github.com/beniamin-openclaw/pita-supply-os/blob/12acbbd67e27c77c1a76ca12581b24423c8cad28/supply-os-v1/app/main.py#L1157)) is complete:

- **Channel branch on `supplier.ordering_method == EMAIL`** (source of truth, never the request's `sent_method`). Non-email channels skip the URL build and just record `sent_method` + the `manager_sent` transition. Email channel with no `supplier.email` → 400. (`main.py:1196-1208`)
- **Per-line history write (FR-011):** only `manager_final_qty_purchase`, `manager_final_qty_base` (= qty × `units_per_purchase_unit`), and `manager_comment` are written back; lines the manager didn't touch fall back to the captain qty. `suggested_*`, `captain_final_*`, `delta_vs_suggestion_pct`, `reason_code`, `captain_comment` are **never overwritten** — preservation is structural (those keys are simply absent from the `line_updates` dict). Writes are ordered lines-then-status so a crash leaves the order in `manager_claimed`, not torn. (`main.py:1224-1287`)
- **`gmail_url.build_draft_url`** ([gmail_url.py](https://github.com/beniamin-openclaw/pita-supply-os/blob/12acbbd67e27c77c1a76ca12581b24423c8cad28/supply-os-v1/app/gmail_url.py#L1)): recipient = `supplier.email` (`:141-142`); Polish subject `Zamowienie {id} - {supplier} - dostawa {date|do potwierdzenia}` (`:38-46`); plaintext Polish body `Lp. | Produkt | Ilosc` (`:49-121`); **quantity = `_effective_qty` = `manager_final_qty_purchase` if >0 else `captain_final_qty_purchase` — purchase units, never base, never suggested** (`:31-35`); unit label = `SupplierProduct.purchase_unit` (fallback `inventory_unit`); optional total (`zl`), delivery address (from location), delivery date; Gmail compose URL `view=cm&fs=1&to=&su=&body=` with an 8000-char length guard raising `ValueError` (`:154-169`).
- **No Bukat hardcodes** — all behavior flows from `supplier.ordering_method` / `supplier.email` / `SupplierProduct.purchase_unit` / `units_per_purchase_unit`.

### Area 2 — Frontend Manager UX (FR-006…FR-010)

`/manager` → `ManagerPage` ([App.tsx:89-96](https://github.com/beniamin-openclaw/pita-supply-os/blob/12acbbd67e27c77c1a76ca12581b24423c8cad28/frontend/src/App.tsx#L89)), `AuthGate role="manager"`, hardcoded `LOCATION_ID="WOLA"` (`ManagerPage.tsx:34`). Fully wired:

- **Queue:** three parallel `api.managerQueue` calls (`captain_submitted` / `manager_claimed` / `manager_sent`) on mount + 60s refresh, rendered as 3 collapsible groups; supplier-agnostic so Bukat shows. (`ManagerPage.tsx:63-86`, `ManagerQueue.tsx:36-182`)
- **Claim "Przejmij":** button gated on `status==captain_submitted` → `api.managerClaim`. (`OrderDetailPane.tsx:187-203`)
- **Edit/Save:** editable only when `manager_claimed`; **read-modify-write contract honored** — `dirtySavePayload` emits qty **and** comment per dirty line (avoids the comment-wipe the backend warns about); empty payload = no-op. (`draftState.ts:72-83`, `ManagerPage.tsx:215-233`)
- **Send-back "Odrzuć do poprawy":** reason via `window.prompt` (a UX rough edge, not a blocker) → `api.managerRelease`. (`ManagerPage.tsx:192-210`)
- **Dispatch (the critical UX):** the "ready-to-send Gmail draft" is delivered by a **client-built `<a href>`**, NOT `window.open` and NOT the server URL. `EmailDispatch` seeds *editable* subject/body from `buildEmailSubject`/`buildEmailBody`, then `buildGmailComposeUrl` assembles the URL in-browser; the anchor (`target="_blank"`, no `preventDefault` — deliberately avoiding popup blockers) **simultaneously** opens the draft tab and fires `api.managerDispatch` to persist `manager_sent`. (`DispatchPanel.tsx:191-314`, `:280-292`; `emailBody.ts:32-112`; `ManagerPage.tsx:239-265`)
- **Channel-aware:** `DispatchPanel` branches on `detail.ordering_method` (email / portal / phone / manual); Bukat lands on the email branch. (`DispatchPanel.tsx:53,128-174`)
- **No TODO/stub/disabled blockers; all `manager.*` i18n keys exist.** Non-blocking nits: send-back `window.prompt`; body uses `location_name` (no `delivery_address` field on `ManagerOrderDetail` — cosmetic, documented `emailBody.ts:46-48`); the "Otwórz email" re-open link is **session-only** (`dispatchedLinks` state) so it disappears after refresh — primary dispatch still opens the draft fine.

### Area 3 — Status workflow + per-line history integrity

State machine and guards are sound (`main.py` + [sheets.py](https://github.com/beniamin-openclaw/pita-supply-os/blob/12acbbd67e27c77c1a76ca12581b24423c8cad28/supply-os-v1/app/sheets.py#L498)):

| Transition | Endpoint | Guard |
|---|---|---|
| `captain_submitted → manager_claimed` | claim | re-read after `invalidate_cache`; 409 if not `captain_submitted` |
| `manager_claimed → captain_submitted` | release | 409 if not `manager_claimed`; reason → `notes` |
| `manager_claimed → manager_sent` | dispatch | 409 if not `manager_claimed`; **`OrderAlreadyDispatchedError`** defense-in-depth on the `manager_sent` write (`sheets.py:523-535`) |
| `captain_submitted → (edit)` | captain PATCH | 409 if not `captain_submitted` — the only gate protecting a manager-claimed order from captain corruption |

- Every manager write path calls `invalidate_cache("orders")` → re-read → status check before writing; narrow Sheets-has-no-row-lock TOCTOU windows remain (accepted v0). `manager_order_save` has its own 409 preflight and intentionally does NOT transition status or throw `OrderAlreadyDispatchedError`.
- **Per-line history: no overwrite path exists.** `suggested_*` / `captain_final_*` / `delta` / `reason_code` / `captain_comment` are write-once at submit; `manager_final_*` / `manager_comment` are written only by save/dispatch. (`models.py:104-121` OrderLine)
- **Seed vs sheet:** queue → `[]` (+warning); order-detail / claim / release / dispatch / save → **503** in seed mode. ⇒ smoke must be sheet mode.
- `manager_user` on dispatch is the hardcoded proxy `"manager-default"` — per-manager identity is a confirmed PRD Non-Goal.

### Area 4 — Tests + manual smoke

- **Coverage (217 tests on `main`):** `test_manager_dispatch.py` (22 — status gates, auth, channel branching email/portal/phone, write-ordering, total recompute, payload field-names), `test_gmail_url.py` (13 — **draft CONTENT**: recipient, purchase-unit qty in body, Polish diacritics round-trip, total in Polish comma `668,00 zl`, zero-qty skip, manager-wins-else-captain, error paths), `test_manager_queue.py` (30 incl. order-detail), `test_manager_claim_release.py` (11), `test_manager_save.py` (12).
- **Safety pattern:** pure mock isolation — `_activate_sheet_backend` flips the backend flag and `mocker.patch.object`s every read AND both writes (`update_order_lines`, `update_order`) to `MagicMock`s; `build_draft_url` only *builds a string* (nothing sends). **Nothing is ever persisted or sent in the suite** — that's the codified meaning of "never place a real order from a test"; back-out discipline applies to the *manual* smoke only.
- **Gaps for S-02:** (a) **no Bukat fixture** — everything is Pago; (b) **no e2e submit→claim→dispatch chain** — each phase tested with a hand-built `Order` at the right status, so the cross-endpoint status contract is only covered piecewise; (c) **per-line-history non-regression on dispatch is untested** (preservation is structural, not asserted) — relevant to the PRD "every dispatched line stays inspectable" guardrail; (d) units only at `units_per_purchase_unit=5.0`; (e) **no `tests/conftest.py` on `main`** — files still use per-file `os.environ.setdefault`, the fragile order-dependent pattern `lessons.md:40-44` warns against (the conftest fix lives only in a worktree).

## Code References

- `supply-os-v1/app/gmail_url.py:31-35` — `_effective_qty` (manager-final-else-captain, **purchase units**)
- `supply-os-v1/app/gmail_url.py:49-169` — Polish subject/body build + Gmail compose URL + 8000-char guard
- `supply-os-v1/app/main.py:1157-1300` — `manager_dispatch` (channel branch, per-line write, status gate)
- `supply-os-v1/app/main.py:1196-1208` — email-channel branch on `supplier.ordering_method`
- `supply-os-v1/app/sheets.py:498-551` — `update_order` + `OrderAlreadyDispatchedError` concurrency guard
- `frontend/src/pages/manager/DispatchPanel.tsx:191-314` — `EmailDispatch` (editable subject/body, `<a href>` open-and-persist)
- `frontend/src/pages/manager/lib/emailBody.ts:32-112` — **client-side** subject/body/URL builder (the draft the operator actually sees)
- `frontend/src/pages/ManagerPage.tsx:239-265` — `onDispatch` → `api.managerDispatch`, stashes session-only re-open link
- `supply-os-v1/tests/test_gmail_url.py` (13) + `tests/test_manager_dispatch.py` (22) — content + dispatch coverage (all Pago)

## Architecture Insights

- **Two parallel email builders.** Backend `gmail_url.py` and frontend `emailBody.ts` independently assemble the Gmail compose URL. The frontend's is authoritative for what's sent (it reads the operator's edited text); the backend's populates the response `gmail_compose_url` used only for a session-only re-open link. Any future change to email format must touch both, or they drift — same shape as the S-09 `compute.ts`↔`suggestion.py` preview/engine split flagged on S-01.
- **Supplier-agnostic dispatch.** Channel, recipient, units, and label are all master-data-driven; the Pago→Bukat "pivot" needs zero backend/frontend branching (mirrors the S-01 lesson: a supplier pivot is data + a frontend default, not code).
- **Sheet-mode is the persistence boundary** for the entire manager half; the seam (`_choose_backend`) degrades reads to empty and hard-fails writes with 503 — so any S-02 verification of the queue→dispatch contract is inherently a live-sheet exercise.

## Historical Context (from prior changes)

- `context/archive/2026-06-05-captain-bukat-submit/plan.md` + `reviews/impl-review.md` — S-01 smoked only submit→queue, backed out (no dispatch); established the sheet-mode `.env` + submit-and-back-out pattern S-02 extends one stage further (through dispatch, stopping at the un-sent Gmail draft).
- `context/archive/2026-06-05-bukat-master-data-ready/audit.md` — F-01 set `SUP_BUKAT` email `biuro@bukat.com`, `cutoff_time 16:00`, `ordering_method=email` — the master data S-02's email channel depends on.
- `context/foundation/lessons.md:40-44` — order-independent tests (session-scoped conftest); `:12-17` — never bypass `_choose_backend()`; `:33-38` — skill artifacts in English.

## Related Research

- `context/archive/2026-06-05-captain-bukat-submit/research.md` — the S-01 map of the Captain half (the producing side of the order this slice consumes).

## Open Questions

1. **Build scope:** does S-02 add any code (e.g. a Bukat-specific dispatch test, an e2e submit→claim→dispatch test, or a per-line-history-preservation assertion to close the Area-4 gaps), or — like S-01 — is it **smoke-only + roadmap close**? (Decision for `/10x-plan`.)
2. **Which draft to verify in the smoke:** confirmed it's the **frontend** `emailBody.ts` draft (what reaches Bukat), with the backend `gmail_url.py` builder noted as a parallel implementation. Worth a one-line note in the plan so the smoke checks the right artifact.
3. **Operational go-live gate (not a planning blocker):** who holds the Manager token at Wola day-to-day (Open Roadmap Question 1). Does not block planning or the smoke (owner can hold it during the test).
