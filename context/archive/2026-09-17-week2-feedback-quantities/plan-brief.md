# Week 2 Feedback — Quantities, Units, Lists, Info-Only Signals — Plan Brief

> Full plan: `context/changes/week2-feedback-quantities/plan.md`
> Analysis: `context/changes/week2-feedback-quantities/analysis.md`
> Meeting notes: `context/changes/week2-feedback-quantities/meeting-2026-09-18.md`

## What & Why

Captains order in pieces while suppliers ship cartons, the engine forces a reason whenever stock is already
above target, and the manager's queue and inventory views are too flat to decide from. The operator's framing:
show information instead of adding rules. This change applies the 2026-09-18 meeting decisions to prod master
data, removes the one noisy rule (reason at suggestion 0), and delivers the manager asks needed before all
Warsaw locations order through the app on 2026-10-01.

## Starting Point

Backend gate `_evaluate_submit_line` and its FE twin `compute.ts` turn suggestion 0 into a hard "reason
required"; 28 of 59 reasoned lines in 7–17.09 are `SYSTEM_SUGGESTION_WRONG`. Prod master data still has
bifteki as 1 kg per carton, one Coca-Cola SKU per flavour, Korfu at 6 per box, sponges in packs, gas bottles
with a target of 8. The inventory grid shows no pack hint or previous count, the manager inventory detail is a
two-column table, the queue opens all lanes, sent orders are frozen, and supplier e-mails CC only `biuro@`.

## Desired End State

A captain with stock above target orders freely and sees "zamawiasz ponad cel". Coca-Cola glass and cans are
separate products per location, Korfu is 12 per box, bifteki is a 4,2 kg carton, gas bottles are free. The
inventory grid says "1 box = 12 szt · ostatnio 36 · 13.09" and warns above 3 × max. Sławek's inventory view
groups by supplier, sorts A→Z, flags attention rows. The queue opens on the two working lanes, flags orders
in progress for more than 3 days, and archives received ones. Managers can top up a sent order with a logged
change until the delivery is received, and every supplier e-mail carries the location mailbox in DW.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Suggestion 0 | Information, no reason, `delta` stored as None | The rule has no baseline to compare against and only produces noise in FR-012 stats | Analysis §3.A, operator |
| Bifteki | Purchase unit karton, upp 4,2, thresholds in kg | Never split; Browary needs 2 cartons | Meeting §1.1 |
| Coca-Cola | Rename P068/P069 to 0,33 l puszka; new P186/P187 0,25 l szkło; glass at WOLA/BRACKA/KEN, cans at NORBLIN/BROWARY | Different purchase price and delivery form; no space for crates at Norblin/Browary | Meeting §1.2 |
| Halloumi, frytki, onion | Stay in pieces/kg, `order_note` with pack size | Paid per piece; operator wants no hard rule | Meeting §1.3–4 |
| Korfu + lemonades | Box of 12 | Current 6 is wrong for every Filber row | Meeting §1.9 |
| Sponges, scrubbers, brush | Sponges in pieces (pack 10 as note); scrubbers and grill brush move to Mory | Blue Service has no good ones; supplier delivers any count | Meeting §1.5–7 |
| Gas bottles | Thresholds 0/0/0 at WOLA/BRACKA/KEN, note "bez limitu", none elsewhere | Operator: bottles are free, no limits | Operator 2026-09-19 |
| Tzatzyki | Unit renamed to pojemnik, thresholds unchanged | No decision to lower 36 kg | Meeting §1.11 |
| Coca-Cola crates | Note variant now (two inputs serialised into `captain_note`) | Structural columns wait for Bartek's rules | Meeting §3 |
| Location e-mail | `locations.email` via migration 0019, joined into CC on both builders | "Bardzo ważne" for the 1.10 rollout | Meeting §2.1 |
| Queue | Sent/closed collapsed by default; chip after 3 days claimed; archive page after 3 days received | Keep the working lanes clean without hiding unreceived orders | Meeting §2.2 |
| Edit after send | Allowed on `manager_sent` until first receipt; `order_events` table (0020) logs it | Manager tops up by e-mail and wants it in the app with a trace | Meeting §2.3 |
| Migration numbers | 0019 and 0020 | 0018 belongs to PR #30 | Plan |
| Ordering calendar per location | Not this round; only uniform supplier days filled | Needs Sławek's matrix and a per-location structure | Plan |
| Dynamic target (PR #30) | Not this round | Don't stack two big changes | Analysis §3.C |

## Scope

**In scope:** prod master-data package (sections A–I with diff/audit) and manual cleanup of stuck orders;
suggestion-0 information state; location mailbox in DW; inventory grid hints, previous count, 3 × max warning;
product list toolbar (search, group, sort, flags) on manager detail and captain grid; queue lanes, "w realizacji
od N dni", archive page; post-send edit with `order_events` and "dosyłka" Gmail link; receipt notes, Coca-Cola
crates prompt, "menedżer zmienił ilości" banner; team message after Phase 1.

**Out of scope:** dynamic target / PR #30; structural crate columns; per-location ordering calendar and
reminders; Bukat product sort order; automatic top-up e-mail; location e-mail in Transport drafts; renames
waiting on Marek/Sławek (sponge name, majonez Browary, Blue Service Browary/Norblin, feta); any change to the
>25 %, critical-under, uncounted over-MAX gates.

## Architecture / Approach

Data first (Phase 0), then the smallest code change with the largest effect (Phase 1), then the manager's
process asks (Phases 2, 5, 6), then the information layer and lists (Phases 3, 4) and small items (Phase 7).
Each phase merges to `main` alone (Railway + Vercel auto-deploy); migrations 0019/0020 are applied by the
operator before the dependent code. Backend twins (`suggestion.py`/`compute.ts`, `gmail_url.py`/`emailBody.ts`)
change together. New fields are optional on both sides; every new signal is informational, never a gate,
except the receipt lock on post-send edits.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 0. Prod master data + cleanup | Meeting decisions in prod with diff/audit; stuck orders closed | Coca-Cola crate size (assumed 24) and glass thresholds copied from cans |
| 1. Suggestion 0 = information | No reason when stock ≥ target, yellow card, `delta` None | FR-012 stats lose `SYSTEM_SUGGESTION_WRONG` volume (intended) |
| 2. Location mailbox in DW | 0019, `Location.email`, CC on both builders | Deploy before migration → NULL only, but must not be inverted |
| 3. Inventory info layer | Pack hint, previous count, 3 × max warning | Choosing the "primary" supplier product for multi-supplier SKUs |
| 4. Product lists | Toolbar + grouping + attention flags on manager and captain | Polish collation and category/supplier grouping shared code |
| 5. Queue lanes + archive | Collapsed lanes, 3-day chip, `/manager/archive` | Hiding unreceived sent orders (avoided: only received ones archive) |
| 6. Edit after send + log | 0020 `order_events`, save/add-line on `manager_sent`, dosyłka link | Must never re-dispatch; guarded by `expected_status` and receipt check |
| 7. Small items | Receipt notes, crates prompt, changed-quantities banner | Free-text crates must stay parseable for the later structural variant |

**Prerequisites:** operator applies SQL sections and migrations; Sławek's uniform supplier days (section H)
and the five location mailboxes (section I) available at execution time.
**Estimated effort:** ~7 sessions (one per phase; Phase 0 mostly operator time).

## Open Risks & Assumptions

- Coca-Cola 0,25 l glass crate assumed 24 bottles; only `upp`/`order_note` change if Marek says otherwise.
- Sponge thresholds at BRACKA/BROWARY/KEN/NORBLIN are treated as pieces already; WOLA is corrected.
- The Sheets backend is legacy; new column/worksheet only matter if it is ever reused.
- Archive uses receipt time, so orders sent outside the app and never received stay in the queue until the operator closes them (Phase 0 cleanup).

## Success Criteria (Summary)

- Captains stop choosing `SYSTEM_SUGGESTION_WRONG` for stock-above-target lines; reasons remain only where a suggestion exists.
- Sławek can decide an order from the inventory view in a minute (supplier block, A→Z, attention rows) and the queue shows only live work.
- Every supplier e-mail carries the location mailbox; a sent order can be topped up with a visible history until delivery.
