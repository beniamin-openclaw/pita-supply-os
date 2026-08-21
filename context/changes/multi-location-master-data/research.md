# Research — multi-location-master-data

Date: 2026-08-21, run inline as the grounding pass for the autonomous overnight run.
Sources: 12 per-location "Inwentaryzacja" sheets (downloaded to `scratchpad/sheets/`,
5.4 MB, session-independent), prod Supabase (read-only queries), the repo.

## 1. The headline fact framing everything

Prod has 4 configured locations; **only WOLA has ever ordered** (86 orders through
2026-08-13; BRACKA / NORBLIN / KEN: zero). Three more location stubs exist inactive
with no settings (BROWARY, KAMIENICA, KULINARNA). Meanwhile Drive holds **12 live
inventory sheets** — the company runs on sheets while the app waits.

## 2. Sheet grammar (verified across all 12)

Every sheet is the same template, two row families:

- **Stock rows** (dated count sections):
  `[Category?] | Supplier | Product | Magazyn | Wydawka | Suma | Jedn. Miary`
- **Price-list rows** (the per-location catalog — header found verbatim in
  Norblin line 225):
  `idx | Kategoria | Dostawca | Produkt | Ilość | Jedn. Miary | Minimalna ilość |
  Maksymalna ilość | jednostka miary | Cena | Cena za jednostkę miary | VAT | Wartość`

So the sheets carry **min/max thresholds and prices with authoritative column
semantics** — no guessing needed. One prototype parser (`scratchpad/proto_parse.py`)
handled all 12 sheets with two heuristics (supplier-name set + numeric-index rows).

### Per-sheet stats (prototype run 2026-08-21)

| sheet | price-list rows | with min/max | stock products | dual-supplier (in sheet) |
|---|---|---|---|---|
| wolska | 160 | 56 | 160 | 6 PL / 11 stock |
| bracka | 152 | 0 | 167 | 1 / 10 |
| norblin | 127 | **109** | 127 | 4 / 8 |
| ken | 142 | 0 | 145 | 3 / 5 |
| stary_browar | 122 | 0 | 139 | 1 / 5 |
| browary | 119 | 0 | 121 | 1 / 5 |
| elektrownia | 122 | 0 | 125 | 4 / 4 |
| slony_spichlerz | 118 | 0 | 123 | 3 / 1 |
| kulinarna_kamienica | 127 | 0 | 117 | **21** / 4 |
| forum | 120 | **25** | 84 | 3 / 0 |
| supersam | 120 | 0 | 83 | 0 / 0 |
| westfield | (captured as notes, prices present) | 0 | 90 | 0 |

Westfield's raw capture is `sheets/westfield.md` (hand-normalized markdown, prices
included) — the engine needs a small special case or a re-normalization for it.

## 3. Findings that shape the design

1. **Substitutes are systemic, not anecdotal.** Kulinarna Kamienica's price list
   marks 20 Spożywcze products as `Intermlecz OR Selgros` (both rows priced).
   Wolska/Bracka show the same for the packaging five (P088/P102 Selgros,
   P095–P097 Intermlecz). The supplier-per-location model (PR #26) maps this as:
   both catalog entries exist, location stays unpinned → product visible at both.
2. **Per-location supplier divergence is real.** Westfield buys Chłodnia/Spożywcze
   from Selgros/Kuchnie Świata where Warsaw locations use Bukat/Intermlecz. Same
   products, different city, different suppliers — the geographic-expansion case.
3. **Selgros appears in every sheet; it does not exist in `suppliers`.** Blocking
   for any pin that involves it (same class as the Allegro decision — add it as a
   supplier row first).
4. **Stock-section vs price-list conflicts exist inside single sheets** (Supersam:
   Tzatzyki/Tirokafteri/Feta stock says Pago, price list says Bukat; Forum+Supersam:
   Oliwki kalamata stock says Kuchnie Świata, price list Selgros). The price list is
   the deliberate catalog; the stock section is where people type fast. Report both,
   trust the price list for master data, list conflicts as operator questions.
5. **Min/max exist only in Norblin (109), Wolska (56), Forum (25).** Everywhere else
   thresholds are a gap for the operator. Convention where present: target = max
   (matches existing BRACKA/NORBLIN rows in prod).
6. **KAMIENICA + KULINARNA stubs vs ONE sheet** ("Kulinarna Kamienica"): the two prod
   stubs almost certainly describe one location. Decision: onboard as ONE location
   (reuse KAMIENICA, name "Pita Bros Kulinarna Kamienica"), leave KULINARNA stub
   untouched-inactive with a note; operator confirms or deletes.
7. **Product identity is name-based and dirty.** Bracka alone: 41 unmatched name
   variants (six spellings of "Butla gazowa 10L", "Cappy Jabłk", "Liść Laurowy2").
   The engine needs accent/case/space-insensitive normalization + a variant map, and
   must NEVER mint a new product id for a fuzzy near-match — near-misses go to the
   report for the operator instead (lesson: absence/mismatch is information).
8. **New-location city/address/company data is NOT in the sheets** — gap list per
   location for the operator (delivery_address, city, company_*, captain token).
   Known from ops memory: Stary Browar = Poznań. Westfield/Forum/Supersam are malls;
   cities unconfirmed → left blank rather than guessed.

## 4. Prod state entering the run (read 2026-08-21)

- `products` 154 · `supplier_products` 154 (1:1, zero dual-supplier products) ·
  `suppliers` 11 (10 active + SUP_ALLEGRO inactive) · `location_product_settings` 578
- `location_product_settings.source_supplier_id` exists only on branch (PR #26,
  unmerged); prod does NOT have migration 0008 yet. **Any onboarding SQL that pins
  must be sequenced after 0008 + PR #26 deploy** — the batches must state this.
- Locations: WOLA/BRACKA/NORBLIN/KEN active+configured; BROWARY/KAMIENICA/KULINARNA
  inactive stubs (0 settings).

## 5. Existing seams the work must respect

- Backend reads via `_choose_backend()`; the engine is OFFLINE tooling → it belongs
  in `supply-os-v1/scripts/` beside `verify_parity.py` / `sync_master_data.py`, pure
  functions importable and unit-testable from `tests/` (repo has precedent:
  `scripts/` modules are plain Python, tests run with pytest).
- Seed CSVs are a **fixture, not a mirror** (`docs/pita-supply-os-v1/seed/README.md`)
  — onboarding data goes to gated prod SQL batches + reports, NOT bulk-dumped into
  seed. Seed gets only what a test needs.
- Master-data ops protocol: diff-before → apply → audit-after (lessons.md), and the
  new lesson: verify premises against the location's own records (this run IS that
  verification, industrialized).
- H-01 (roadmap): lockfile, staged TS strict, wider ruff, mypy/pyright in CI.
  CI exists (`.github/workflows/ci.yml`) and can host a type-check job.

## 6. Open questions routed to the plan

- Pin policy for onboarding: pin every single-supplier product, or only where the
  sheet's supplier differs from the global catalog? → Plan decides (see plan
  Decision notes; recommendation: pins ONLY on divergence, unpinned elsewhere — the
  default already means "every carrier", and 1:1 products need no pin).
- New product ids: continue P155+ sequence, category from the sheet section.
- Supersam/Forum tiny stock sections (83/84) vs price lists (120) — stock sections
  are partial counts; price list drives membership.
