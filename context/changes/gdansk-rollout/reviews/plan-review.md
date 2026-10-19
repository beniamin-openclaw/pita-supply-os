<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Gdańsk Słony Spichlerz (SLONY) rollout

- **Plan**: `context/changes/gdansk-rollout/plan.md`
- **Mode**: Deep (round 1)
- **Date**: 2026-10-16
- **Verdict**: REVISE
- **Findings**: 0 critical, 8 warnings, 10 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
6/6 paths ✓, 4/4 symbols ✓, brief↔plan ✓. Prod checks by the orchestrator: SLONY template = 115
products incl. the 12 leftovers, P037 the only inactive; P177 active (121 inventory items).

Confirmed by the verification agent (file:line in its report): 0/0/0 rows never force a reason
(`main.py:883,904-913`, `compute.ts:204-261`); backups never force a reason and share settings
(`main.py:265,1081,1998`); every purchase unit in the mapping is in `PACK_UNIT_FORMS`
(`frontend/src/i18n/packUnits.ts:21-78`); suggestion converts inventory-unit thresholds via
`units_per_purchase_unit` and cases (`suggestion.py:136-188`, `compute.ts:35-100`); inventory list =
all settings with active product (`main.py:3279-3285`); captain tabs = suppliers with orderable rows
(`main.py:515-541`). Mapping CSV structure: no duplicate pairs, no double primary, every backup has a
primary, 121 settings.

## Findings

### F1 — Alerts ON for "Pago + Magazyn + Lemoniady" contradicts Warsaw Pago precedent
- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW
- **Detail**: SUP_PAGO and SUP_WARSZAWA_KAT have alerts off (`context/archive/2026-09-27-pago-suggestion-no-alerts/change.md:16-22`); critical lines would force reasons on every deviation.
- **Fix**: SUP_WARSZAWA_GDA `suggestion_alerts_enabled=false`; keep Coca-Cola ON (as Warsaw).
- **Decision**: FIXED

### F2 — Coca-Cola max 36 szt = 1,5 crates
- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW
- **Detail**: checklist §2 / feedback-1001 D25 round drinks max to whole crates; rows 88-91 give 12/36.
- **Fix**: round Coca-Cola max up to whole crates of 24 (36 → 48).
- **Decision**: FIXED

### F3 — Several thresholds far above Warsaw scale (tzatziki 28, rolls 120, zmywak 120, souvlaki 110 kg, gyros 225 kg)
- **Severity**: ⚠️ WARNING · **Impact**: 🔎 MEDIUM
- **Detail**: target = max, so the first suggestion orders up to max.
- **Fix**: keep Marek's values (the sheet is the source, Katowice rule) and list them first in the questions for Marek; settings are editable in the manager UI.
- **Decision**: FIXED (documented as accepted risk + question)

### F4 — Inactive source rows would be copied as inactive
- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW
- **Detail**: SP_KUCHNIE_P015, SP_SELGROS_P144, SP_BLUESERV_P169, SP_BLUESERV_P122 are inactive in prod.
- **Fix**: generator sets `active=true` explicitly; STEP 0 prints source `active`; audits count active rows.
- **Decision**: FIXED

### F5 — P066/P067 change purchase unit without pinning units_per_purchase_unit
- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW
- **Fix**: explicit `upp=24` override + guard on the source; `supplier_sku` NULL.
- **Decision**: FIXED

### F6 — Rollback PART 2 re-opens the Warsaw catalog if the token is live
- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW
- **Fix**: PART 2 precondition = SLONY token removed from Railway; note that PART 1 is not a hard stop (removing the token is).
- **Decision**: FIXED

### F7 — Crate-return prompt is wired to SUP_COCACOLA only
- **Severity**: ⚠️ WARNING · **Impact**: 🔎 MEDIUM
- **Detail**: `frontend/src/pages/captain-mp/lib/supplierPrompts.ts:18-20`; Gdańsk orders returnable glass.
- **Fix**: no code change in this data-only rollout; rollout notes + captain instruction (crates in the comment) and a proposed one-line follow-up for SUP_COCACOLA_GDA/_KAT.
- **Decision**: FIXED (documented follow-up)

### F8 — `<kod demo SLONY>` is guessable
- **Severity**: ⚠️ WARNING · **Impact**: 🏃 LOW
- **Fix**: operator's explicit choice; rotation recommendation in rollout notes and final report.
- **Decision**: FIXED (documented)

### F9 (O1–O10 consolidated) — Observations
- O1 rolls pack conflict → with F3 question. O2 cross-supplier sources carry SKU/order_note/pickup → null them for cross-brand rows (WAW rows keep them, B2 pattern). O3 compute expected inventory count with `products.active` → done (121). O4 0/0 rows → question for Marek. O5 row 76 note (P153 exists, ambiguous) and row 80 (150 ml vs 200 ml cups → held). O6 step 2 before the token. O7 clear localStorage on the demo device. O8 name "Pago + Magazyn + Lemoniady (Gdańsk)". O9 half-pack maxima = Katowice precedent. O10 fix research.md leftover sentence; regenerate inventory-card-order SQL later.
- **Decision**: FIXED (all applied or documented)

## Round 2 (quick, document-only) — 2026-10-16

All F1–F9 fixes applied to `plan.md`, `plan-brief.md`, `research.md` and `tools/build_mapping.py`
(mapping rebuilt: 130 catalog rows, Selgros 30 P + 19 B, 20 held, Coca-Cola max in whole crates).
Counts consistent across plan/brief/CSV (130 rows, 121 settings, 101 thresholds / 20 zero, 12
leftovers); Progress ↔ phases consistent (3 phases, 13 items). No new findings.

- **Verdict**: SOUND
