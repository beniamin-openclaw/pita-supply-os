# F-01 — Bukat master-data readiness: audit

- **Roadmap item:** F-01 `bukat-master-data-ready` (foundation; blocks S-01 → S-02 → S-03)
- **PRD refs:** FR-012 (owner verifies & corrects Bukat master data + suggestion outcomes), US-01
- **Type:** data-readiness pass — NOT a code change. No `/10x-plan` / `/10x-implement`.
- **Method:** audit → verify-with-owner → correct **live sheet** + mirror to **seed CSV** → re-validate suggestions → close.
- **Decisions (owner, 2026-06-05):** scope = suggestion data **+ Bukat ops fields** (email, cutoff_time); source of truth = live Google Sheet, mirror to seed; edits applied by owner from a paste-ready diff.

## Engine behavior (grounding for the findings)

`compute_suggestion` (`app/suggestion.py`):
- `suggested_qty_base = max(0, target − current)`; `raw_purchase = base / units_per_purchase_unit`.
- `full_only` rounding = `math.ceil(raw)` → **always rounds UP to whole purchase units** (a critical product is never under-ordered).
- `over_max` is **informational only** — it never caps/reduces the suggestion. `allow_over_max_due_to_packaging = FALSE` merely **adds a warning** "(exceeds max by N)" to the explanation; `TRUE` suppresses that warning. Quantity is identical either way.

## Coverage

All **14** Bukat SKUs have both a `supplier_products` row and a Wola `location_product_settings` row. No missing joins. (Pending owner confirmation that the list of 14 is exhaustive & correct — see Q6.)

## Validation table — suggestion @ current = 0 (full restock to target)

| SKU | name | p.unit | upp | min/max/target | → qty (p.unit) | base | over_max | note |
|-----|------|--------|-----|----------------|----------------|------|----------|------|
| P002 | Cytryna | kg | 1 | 0.5/2/2 | 2 | 2 | 0 | ok |
| P003 | Papryka zielona | kg | 1 | 0.5/2/2 | 2 | 2 | 0 | ok |
| P004 | Awokado | szt | 1 | 2/5/5 | 5 | 5 | 0 | ok |
| P005 | Ogórek | kg | 1 | 0.5/2/2 | 2 | 2 | 0 | ok |
| P006 | Pomidor | kg | 1 | 12/42/42 | 42 | 42 | 0 | tgt high? (Q3) |
| P007 | Rucola 125 gr | opak | 1 | 5/15/15 | 15 | 15 | 0 | ok |
| P008 | Sałata bolero mix 150gr | opak | 1 | 5/20/20 | 20 | 20 | 0 | ok |
| P009 | Natka Pietruszki | kg | 1 | 0.2/0.5/0.5 | 1 | 1 | 0.5 | **F-A unit mismatch** |
| P010 | Czosnek | kg | 1 | 0.2/0.5/0.5 | 1 | 1 | 0.5 | **F-A unit mismatch** |
| P011 | Tzatzyki | wiadro | 3 | 9/30/30 | 10 | 30 | 0 | clean @0 (F-B intermittent) |
| P012 | Tirokafteri | wiadro | 3 | 3/6/6 | 2 | 6 | 0 | clean @0 (F-B intermittent) |
| P014 | Feta blok | blok | 2 | 1/3/3 | 2 | 4 | 1 | **F-B packaging** |
| P016 | Cebula czerwona | kg | 1 | 5/15/15 | 15 | 15 | 0 | ok |
| P018 | Cebula Biała | kg | 1 | 0.5/1/1 | 1 | 1 | 0 | **F-D price 1.50?** |

## Findings

### F-A — P009 Natka / P010 Czosnek: target below the purchasable unit (unit mismatch)
Both are sold by the kg (`upp=1`) but target=0.5 kg, max=0.5 kg. `full_only` ceils 0.5 → 1 kg, which exceeds max by 0.5 and fires an over-max warning on every restock. You cannot buy 0.5 kg if the purchase unit is a whole kg. Options: (a) raise max to ≥1 and accept whole-kg buys; (b) if Bukat sells fresh herbs/garlic in a smaller pack, fix `purchase_unit` + `units_per_purchase_unit`; (c) set `rounding_rule = half_allowed` if half-kg is real. **Needs owner ground truth (Q1).**

### F-B — Packaging granularity over-max (Feta + wiadro dips)
Feta (blok=2 kg) and the Tzatzyki/Tirokafteri wiadra (3 kg) physically overshoot max at some stock levels; the resulting "(exceeds max by N)" is a false alarm for a product that only comes in fixed packs. Fix: `allow_over_max_due_to_packaging = TRUE` for P011, P012, P014. **Recommended; owner confirm (Q2).**

### F-C — P006 Pomidor target 42 kg
Full restock buys 42 kg tomatoes (critical, "Greek salad essential"). Plausible for a high-volume staple, but high enough to confirm. **Owner confirm (Q3).**

### F-D — P018 Cebula Biała price 1.50 zł/kg
vs Cebula czerwona 11.00 zł/kg — looks like a typo. Affects `total_value_estimate` only, not the suggested quantity. **Owner confirm real price (Q4).**

### F-E — Bukat ops fields TBD (in scope per owner decision)
`suppliers.SUP_BUKAT`: `email = TBD`, `cutoff_time = TBD` (`delivery_days = Mon, Wed, Fri` already set). Email is needed for S-02 email dispatch; cutoff_time feeds the manager-queue deadline. **Owner provides (Q5).**

### F-F — Completeness of the Bukat list
Confirm the 14 SKUs are exactly what Bukat supplies to Wola — none missing, none listed that Bukat does not actually carry. **Owner confirm (Q6).**

## Open questions for the owner

1. **P009 Natka / P010 Czosnek** — how are they really bought (whole kg? smaller pack? half-kg)? Pick fix (a)/(b)/(c).
2. **P011 / P012 / P014** — set `allow_over_max_due_to_packaging = TRUE`? (recommended)
3. **P006 Pomidor** — is target 42 kg correct?
4. **P018 Cebula Biała** — real price per kg (1.50 looks wrong)?
5. **Bukat** — order email + cutoff_time (HH:MM) on Mon/Wed/Fri?
6. **Completeness** — is the list of 14 exhaustive & correct?

## Owner answers — round 1 (2026-06-05)

- **Q1 Natka (P009):** NOT bought in whole kg — rounding is to **0.1 kg**. (Garlic P010: not stated → still open.)
- **Q2 Feta + dips:** agrees to `allow_over_max_due_to_packaging = TRUE`. Clarifies packs: feta = 2 kg blok, Tzatzyki/Tirokafteri = 3 kg wiadro. Adds: "we order in kilograms anyway" → open question whether to model these as kg-based vs keep packs.
- **Q3 Pomidor (P006):** target 42 kg **confirmed**.
- **Q4 Cebula biała price:** not answered (owner renumbered) → re-ask.
- **Q5 Bukat ops:** email = **biuro@bukat.com**; cutoff_time = **16:00**. Delivery days nuanced: habit = Mon/Wed/Fri, but deliveries possible **Mon–Sat** (Sunday order → Monday delivery). Owner asked for a recommendation on what to store.
- **Q6 Completeness:** list of 14 is **complete**.

### Engine constraint surfaced by Q1 (evidence → implementation)

The `RoundingRule` enum has only `full_only` (ceil to whole unit), `half_allowed` (→0.5), `up_for_critical`. There is **no 0.1-kg rounding rule**. So "round to 0.1 kg" has two paths:
- **(A) data-only** — model the purchase unit AS 0.1 kg (`purchase_unit = "0,1 kg"` / `"100 g"`, `units_per_purchase_unit = 0.1`, price ÷10). `full_only` ceil then steps in 0.1 kg. Stays in F-01's data-only scope. Cost: suggestion reads "5 × 0,1 kg" rather than "0,5 kg".
- **(B) code change** — add a `tenths` rounding rule to `suggestion.py` + enum. Cleaner UX (unit stays "kg"), but it is a code change → a small separate slice, outside F-01's data-only scope.

## Owner answers — round 2 (2026-06-05) + locked decisions

- **A delivery_days:** owner accepts recommendation → `Mon, Tue, Wed, Thu, Fri, Sat`; M/W/F habit + Sunday→Monday recorded in supplier `notes`.
- **B rounding (REScoped):** owner generalised — NOT just parsley. **All weight (kg) products** should suggest at 0.1-kg granularity (0.5, 0.7, 1.5 kg…), not ceil to whole kg. → This is an **engine gap**, fixed by code, NOT by data. Spun out as a new slice (see below). The data-only "100 g unit" hack is rejected (would make every kg product read "× 100 g").
- **C prices:** white onion (P018) = **1.50 confirmed correct**. RED onion (P016) is wrong: `11.00 → 2.20` (owner checked current price).
- **D garlic (P010):** folded into B — kg product, gets 0.1-kg rounding via the new slice.
- **E feta/dips representation:** owner orders Bukat **in packages** and Bukat prefers the email in packages → **keep packs** (Feta = blok 2 kg, Tzatzyki/Tirokafteri = wiadro 3 kg). No unit change; just `allow_over_max = TRUE`.
- **Pomidor (P006):** target 42 kg confirmed. **Completeness:** 14 SKUs complete.

### Locked F-01 data diff (to apply in live sheet, then mirror to seed)

`suppliers` — row `SUP_BUKAT`:
- `email`: `TBD → biuro@bukat.com`
- `cutoff_time`: `TBD → 16:00`
- `delivery_days`: `Mon, Wed, Fri → Mon, Tue, Wed, Thu, Fri, Sat`
- `notes`: append "Ordering habit Mon/Wed/Fri; deliveries Mon–Sat; Sunday order → Monday delivery."

`supplier_products` — Bukat:
- `SP_BUKAT_P016` Cebula czerwona `price_estimate_pln`: `11.00 → 2.20`
- (`SP_BUKAT_P018` Cebula Biała `1.50` — confirmed correct, no change.)

`location_product_settings` — WOLA:
- `WOLA__P014` Feta blok `allow_over_max_due_to_packaging`: `FALSE → TRUE`
- `WOLA__P011` Tzatzyki `allow_over_max_due_to_packaging`: `FALSE → TRUE`
- `WOLA__P012` Tirokafteri `allow_over_max_due_to_packaging`: `FALSE → TRUE`

### Spun-out engine improvement → NEW SLICE (code, not F-01)

**0.1-kg rounding for weight-based products.** The `RoundingRule` enum has no sub-unit granularity for kg goods; weight products ceil to whole kg, which is wrong for the domain (parsley/garlic over-max; can't suggest 0.7 / 1.5 kg). Fix = a new rounding rule in `suggestion.py` + a way to assign it (a `rounding_rule` column on `supplier_products`, currently absent, or a kg-default) + tests. Do via the full `/10x-research → /10x-plan → /10x-implement → /10x-impl-review` flow (m2l4 muscle). This fix is what truly resolves parsley P009 / garlic P010; until it lands they keep a cosmetic over-max warning (suggestion still safe, not blocking). Proposed roadmap id: **S-09** (or a `fix-` change).

## Next steps

1. Collect owner answers (Q1–Q6).
2. Read the **live sheet** Bukat slice (suppliers / supplier_products / location_product_settings @ WOLA) to lock the prod baseline before producing the diff.
3. Produce a paste-ready diff (row → old → new + rationale) for the owner to apply in the live sheet.
4. Mirror the same edits into the seed CSVs (in-repo) so tests/dev match prod.
5. Re-run the validation table — confirm no spurious over-max warnings remain and suggestions are sane.
6. Close F-01 via `/10x-archive bukat-master-data-ready` (flips roadmap F-01 → done).

## Execution log (2026-06-05) — applied & verified

Owner authorised direct execution (Claude writes both CSV + live sheet). Editor SA
`pita-supply-os-sa@` wired locally (`supply-os-v1/sa.json` + `.env`, both gitignored);
read+write path to the live sheet is live.

**Applied — 8 cells, identical in seed CSV and live Google Sheet:**

| Target | Field | Old → New |
|--------|-------|-----------|
| suppliers / SUP_BUKAT | email | `TBD → biuro@bukat.com` |
| suppliers / SUP_BUKAT | cutoff_time | `TBD → 16:00` |
| suppliers / SUP_BUKAT | delivery_days | `Mon, Wed, Fri → Mon, Tue, Wed, Thu, Fri, Sat` |
| suppliers / SUP_BUKAT | notes | appended: Mon/Wed/Fri habit + Mon–Sat delivery + Sunday→Monday |
| supplier_products / SP_BUKAT_P016 | price_estimate_pln | `11.00 → 2.20` |
| location_product_settings / WOLA__P011 | allow_over_max_due_to_packaging | `FALSE → TRUE` |
| location_product_settings / WOLA__P012 | allow_over_max_due_to_packaging | `FALSE → TRUE` |
| location_product_settings / WOLA__P014 | allow_over_max_due_to_packaging | `FALSE → TRUE` |

- Seed: `docs/pita-supply-os-v1/seed/{suppliers,supplier_products,location_product_settings}.csv`.
- Live: sheet `11aJUcM…YQ9Lo` — rows `suppliers!3`, `supplier_products!54`, `location_product_settings!12/13/15`.

**Verification:**
- Read-back from live confirms all 8 values (email / cutoff / days / notes; price = 2.2; allow_over_max = True ×3).
- `_compute_next_cutoff(Bukat)` now parses → a real dispatch deadline (was None-prone while cutoff = TBD).
- Suggestion re-validation (seed): Feta + wiadro dips no longer raise a spurious over-max warning (suppressed at current = 0 and at intermediate stock). All 14 SKUs sane.
- **Residual (expected, not a regression):** P009 Natka + P010 Czosnek still raise a *cosmetic* over-max warning (whole-kg ceil on a sub-kg target). The suggestion stays safe; the real fix is the engine 0.1-kg rounding rule → spun out as **S-09** (parked for a separate session).

**Result:** F-01 master-data readiness **COMPLETE** for the Wola × Bukat pilot.
