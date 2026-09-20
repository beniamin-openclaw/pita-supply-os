---
change_id: week2-feedback-quantities
title: Week 2 captain/manager feedback — inventory vs order quantities, unit clarity, list usability, info-only signals
status: in-progress
created: 2026-09-17
updated: 2026-09-20
archived_at: null
---

## Notes

Source: Connecteam chat "Pita Supply OS" export `~/Downloads/Pita Supply OS (1).xlsx`
(2026-09-17 21:26, 79 rows). Everything after Khushi 2026-09-06 19:50 is new and was not
triaged anywhere in the repo before this change (the previous round,
`context/archive/2026-09-06-week1-feedback-targets/`, consumed the export up to that row).
Eight chat messages are image-only (rows 28, 35, 37, 57, 58, 60, 63, 71, 73–75 of the export);
their text captions are in `analysis.md` §1, the pictures themselves were not readable
from this session (Connecteam did not render in the automated browser tab).

Operator framing (2026-09-17): "musimy ogarnąć te ilości, jakie są na inwentaryzacji, jak
zamawiamy, jak to podzielić, gdzie dać informacje jako tylko informacje — nie chcę zaszywać za
dużo zasad, żeby nie było komplikacji."

Prod evidence (Supabase `lpzhphufjwrndfogkfub`, read-only SELECTs 2026-09-17 evening) is
quoted in `analysis.md` §2. No prod write, no migration, no code change in this step —
`analysis.md` is a recommendation + implementation plan draft for the operator to pick from.

Standing rules that bind this change: engine suggests, never blocks; minimum order value,
`over_max`, `min` are informational (see `analysis.md` §3 for the sources); no real supplier
order from tests; persistence only via `_choose_backend()`; master-data ops = diff before,
audit after.

## Planning (2026-09-19)

Operator accepted every solution from `meeting-2026-09-18.md` §3; gas bottles have no limits ("free").
`plan.md` + `plan-brief.md` written: Phase 0 prod master-data package (sections A–I) and cleanup, Phases 1–7
code (suggestion-0 information state; location e-mail in DW via migration 0019; inventory info layer; product
list toolbar; queue lanes + archive; post-send edit with `order_events` via migration 0020; receipt notes,
Coca-Cola crates note, changed-quantities banner). Migrations take 0019/0020 because 0018 is on PR #30.

Still waiting on external input (not blocking the phases): Marek — crate rules (Bartek), sponge catalogue
name, Blue Service Browary/Norblin, gąbki pack 10 confirmation; Sławek — uniform ordering days for Warsaw
(section H), Bukat product order, majonez Browary target; Beniamin — feta 2 kg, location mailboxes (section I).

## Phase 0 applied (2026-09-19)

Prod master-data package executed via the Supabase MCP (project `lpzhphufjwrndfogkfub`), BEFORE
diff saved to `prod-diff-before.md`, statements recorded in `prod-sql.sql`.

- Sections A–G applied (bifteki upp 4.2 + settings; Coca-Cola P068/P069 renamed to 0,33 l puszka,
  new P186/P187 0,25 l szkło with SP_COCACOLA_P186/P187 crate 24 and settings copied from the cans at
  WOLA/BRACKA/KEN; Filber 7 rows box/12, lemonade prices 35.7 → 71.4; gąbki P121 in pieces,
  druciak P122 moved to SUP_MORY, new P188 szczotka do grilla at five locations; butle P181 0/0/0 at
  WOLA/BRACKA/KEN and NORBLIN P181/P182 settings deleted; Bombilla P135 sp inactive + settings
  deleted; Florinis P017 renamed, tzatzyki pojemnik, order notes). Section H (supplier days) skipped —
  still TBD with Sławek. Section I applied: `locations.email` set for the eight locations
  (per-location gmail.com mailboxes; source: Marek's "Raport z punktów" mail, 2025-07-28).
- Migrations 0019 (`locations.email`) and 0020 (`order_events`) applied on prod via
  `apply_migration` before any dependent code.
- AFTER audit green: bad_thresholds 0, cc_can_rows_left 0, cc_glass_rows 6, filber_not_12 0,
  long_notes 0, products 188, dup_active_sp 0, bombilla_rows 0, brush_rows 5, order_events present.
- Cleanup J: J1 done — 17 `manager_sent` orders that already had receipts (pre "first receipt
  closes" code) moved to `closed`. J2 (18 Wola pre-September `manager_sent` without receipts →
  closed), J3 (7 stale `manager_claimed` submitted before 2026-09-12 → cancelled with trace) and
  J4 (transport draft `TRN-20260902-PAGO-aa283f` → cancelled) could not be executed from this
  session (the tool classifier blocks bulk `UPDATE orders`); the exact statements with explicit
  order-id lists sit in `prod-sql.sql` section J for the operator. The four fresh `manager_claimed`
  orders from 14–15.09 are left for Marek.
- Orders after Phase 0: cancelled 54, closed 70, manager_claimed 11, manager_sent 33 (J2–J4 pending).

## Plan review (2026-09-20)

Verdict APPROVE WITH NOTES (Fable high, read-only). No blockers. Amendments folded into `plan.md` as
"Plan-review amendments" blocks under Phases 2–7: Transport batch members excluded from post-send edit and
"locked" keyed on `closed` (Phase 6); `groupProductsByCategory` third importer / re-export shim (Phase 4);
"w kolejce od N dni" wording and `lib/dates.ts` as a new file (Phase 5); extend the existing
`managerChanged` hint instead of duplicating it and treat the crates prefix as a data-format constant
(Phase 7); fixture wiring 0016/0019/0020 before `email` joins `_LOCATION_COLUMNS` (Phase 2);
`packUnits.test.ts` as the Phase 3 criterion. Phase 1 note (suggestion 0 below target under
`half_allowed`/`up_for_critical` rounding) is handled in the Phase 1 impl-review loop.

## Phase 1 implemented (2026-09-20)

Suggestion 0 on a counted line is information: backend third branch in `_evaluate_submit_line`
(delta None, no critical-under / deviation gate, "(info)" warning when something is ordered), frontend
yellow pill `state.aboveTargetInfo` (or the neutral `state.suggestionZeroInfo` when rounding produced 0
while stock is still below target), read-only views print "ponad cel" / "—" for qty-0 skeleton lines.
Impl-review (Fable high): APPROVE WITH NOTES — manager-queue None-delta case, dash for qty-0 lines and the
edit-route docstring applied before commit; over-MAX asymmetry between the uncounted and the new branch
judged consistent with "engine suggests, never blocks". Verify: ruff clean, pytest 682, vitest 372,
build + lint clean. Manual items 1.5–1.7 remain for the operator after deploy.

## Phase 2 implemented (2026-09-20)

`Location.email` (migration 0019, already on prod) reaches the dispatch e-mail as a second DW address:
backend `_join_cc` composes `settings.order_cc_email` + `location.email` ("@"-gated, placeholders dropped)
for `gmail_url.build_draft_url`; `ManagerOrderDetail.location_email`; frontend `joinCc` in the DispatchPanel
(both addresses in the DW row and in the compose URL). Integration fixture now applies 0016, 0019, 0020 and
knows `order_events`. Seed `locations.csv` gained `email` (WOLA test value only). Impl-review: APPROVE WITH
NOTES (doc-comment placement fixed; DATA_MODEL.md locations table updated). Verify: ruff clean, pytest 690,
vitest 379, build + lint clean. Progress 2.1 waits for the CI integration job (no local Postgres here).
