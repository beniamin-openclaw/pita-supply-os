# Gdańsk Słony Spichlerz (SLONY) rollout — Plan Brief

> Full plan: `context/changes/gdansk-rollout/plan.md`
> Research: `context/changes/gdansk-rollout/research.md`

## What & Why

Gdańsk Słony Spichlerz should count stock and order in Supply OS like Katowice: from its own Gdańsk
suppliers with Marek's min/max thresholds ("Miasta poza Warszawą", tab Gdańsk), with captain access
under the code `<kod demo SLONY>`.

## Starting Point

`SLONY` exists in prod as an inactive placeholder with 115 empty template settings and no history.
The own-catalog machinery (migration 0029, scoped catalog, backups) is live and used by FORUM and
SUPERSAM.

## Desired End State

The SLONY captain logs in with `<kod demo SLONY>`, sees five Gdańsk tabs (Kuchnie Świata, Selgros,
Coca-Cola, Pago + Magazyn + Lemoniady, Blue Service) with suggestions from the sheet, and counts a
121-item inventory list. Nothing changes for Warsaw, Kraków or Katowice.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Model | Own catalog + 5 city supplier records (`SUP_*_GDA`) | Shared records would carry Warsaw e-mails/minimums and leak nothing into SLONY | Research + Plan |
| Duplicates | Kuchnie/Blue Service primary, Selgros backup | One threshold per product drives one suggestion (Katowice decision 3/6) | Plan |
| Missing products | 20 rows held, no new products | Katowice precedent; list goes to Marek | Plan |
| 0/0 Blue Service rows | Primary at 0/0/0 | Orderable ad hoc, counted, no forced reason | Plan |
| Alerts | On for Kuchnie, Selgros, Coca-Cola, Blue Service; off for Pago + Magazyn + Lemoniady (Gdańsk) | Same as the Warsaw twins (SUP_PAGO, SUP_WARSZAWA_KAT off) | Plan + review |
| Leftovers | Delete 12 template rows in a separate step | They would appear on the inventory list; DELETE needs the operator | Research + Plan |
| Rehearsal | Prod dry run (transaction raises at the end) | No local Postgres; real data, zero writes | Plan |
| Captain code | `<kod demo SLONY>`, set on Railway by the operator | Operator's choice; this host has no Railway access | Operator + Plan |

## Scope

**In scope:** SLONY location data, 5 suppliers, 130 scoped catalog rows, 121 settings, deletion of 12
leftovers, rollback, rollout notes, COMPANY_ENTITIES/checklist docs.

**Out of scope:** code, migrations, new products, supplier contacts/minimums/days, delivery rules,
seed export, test orders, Gmail alias.

## Architecture / Approach

`sheet-mapping.csv` (built from the sheet dump + per-row decisions) → generator → Katowice-shaped SQL
(STEP 0 diff, guarded `DO` block with dry-run switch, STEP 2 audits). Catalog rows are copied from
named Katowice/Warsaw source rows with overrides, so packs/prices/rounding are inherited.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Mapping + SQL | Mapping CSV, step 1/2 SQL, rollback, prod dry run | A wrong unit factor → wrong suggestions |
| 2. Prod apply | Location, suppliers, catalog, settings; leftovers deleted | DELETE confirmation timing out unattended |
| 3. Access + docs | Token (operator), GET smoke, docs, /verify | Token not set → captain cannot log in |

**Prerequisites:** prod Supabase via connector (works); Railway access by the operator for the token.
**Estimated effort:** one session.

## Open Risks & Assumptions

- `<kod demo SLONY>` is guessable; replace with a random code once the demo is over.
- Several conversions are flagged "do potw." (rolls 80/20 pack, przyprawa 2 kg, zmywak, spices).
- Supplier contacts unknown: the manager orders Gdańsk suppliers manually until Marek confirms.

## Success Criteria (Summary)

- Captain `<kod demo SLONY>` sees 5 Gdańsk tabs with suggestions and a 121-item count list.
- Audits: all invariants 0 rows; Warsaw/FORUM/SUPERSAM fingerprints unchanged.
