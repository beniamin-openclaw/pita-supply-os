# Plan: multi-location-master-data

Overnight autonomous run (operator instruction 2026-08-21). Three tracks:
**A** reconciliation engine · **B** onboarding batches for 7 new locations ·
**C** H-01 hardening as filler. Inputs: `change.md`, `research.md`, 12 downloaded
sheets in `scratchpad/sheets/`, prod read-only state of 2026-08-21.

## Execution model (operator instruction)

- **Orchestrator + reviewer: this session (Fable 5, high).** Owns the plan, reviews
  every diff, runs verification, writes the decision report.
- **Implementer: Opus 5 subagents (fast mode)** via the Agent tool, `model: "opus"`,
  one focused task per dispatch, sequential (shared working tree — no parallel
  edits). Each task gets: exact file paths, the failing tests to make pass, and the
  repo rules in play. Implementer output is reviewed here before the next dispatch.
- **TDD**: every engine behavior lands as a failing test first (fixtures cut from the
  real downloaded sheets), then the implementation. Tests live in
  `supply-os-v1/tests/test_reconcile_inventory.py`.

## What

1. **Engine** — `supply-os-v1/scripts/reconcile_inventory.py`: pure-function core
   (importable, no I/O side effects at import) + CLI. Responsibilities:
   - `parse_sheet(text) -> SheetData`: extract price-list rows (category, supplier,
     product, unit, min, max, price, vat) and stock rows (supplier, product, unit),
     using the verified grammar (research §2). Westfield's normalized-notes format
     handled by a small secondary parser.
   - `normalize_name(s) -> str`: casefold, strip accents/extra spaces/trailing
     digits-glued-to-words; the basis for matching.
   - `match_catalog(sheet_products, catalog) -> matches / near_misses / unmatched`:
     exact-normalized match only auto-links; near-misses (edit distance ≤ 2 or
     token-subset) are REPORTED, never auto-linked (research §3.7).
   - `reconcile(sheet, db_snapshot) -> Report`: missing products, sheet-vs-db
     supplier conflicts, in-sheet dual suppliers, unit mismatches, stock-vs-pricelist
     conflicts, min/max coverage.
   - `emit_reports(...)` → `context/changes/multi-location-master-data/reports/<loc>.md`
     (English) + a cross-location summary with the operator gap list.
2. **Generator** — same module, `emit_sql(...)`:
   `context/changes/multi-location-master-data/prod-sql/<NN>-<loc>.sql` batches:
   - new suppliers first (one shared batch: Selgros as active-FALSE portal/manual TBD),
   - new products (P155+ sequence, category from sheet section),
   - `supplier_products` per location's price list (price, unit, VAT note) —
     emitted **`active = FALSE`** (plan-review F1: a global catalog row for a new
     location would otherwise leak "also supplied by" badges and, once the supplier
     activates, whole picker tabs into the four LIVE locations; inactive rows are
     excluded from the orderable carrier map by the PR #26 `sp.active` filter, so
     nothing changes anywhere until activation). Packaging: default 1.0/full_only
     + `packaging TBC` note; copy packaging from an existing catalog row for the
     same product where one exists (F2). New-product ids deduped ACROSS sheets by
     normalized name before assignment (F3),
   - new `locations` rows (INACTIVE, city/address/company blank → gap list),
   - `location_product_settings` with min/max where the sheet has them
     (target = max convention), 0/0/0 otherwise (explicit gap),
   - `source_supplier_id` pins ONLY where the location's sheet supplier diverges
     from other locations' supplier for the same product; substitutes stay NULL.
   - **Per-location ACTIVATION batch** (operator-run later): flips the location
     active + its supplier_products rows active + applies pins at the four live
     locations for every product that thereby gains a second carrier — one atomic
     hand-off per location, preconditioned on 0008 + PR #26 (F1).
   - Every batch: diff-before header → apply → audit-after, and an explicit
     "requires migration 0008 + PR #26 deployed" precondition on any pin.
3. **Prod attempts**: additive + inactive + audited batches may be attempted live
   (the consented pattern); a classifier block downgrades the batch to ready-to-run
   without retry-grinding.
4. **H-01 hardening** (track C, only after A+B are green):
   - backend `requirements.lock` (pip freeze of the working venv, wired into CI),
   - ruff: add `I` (isort), `B` (bugbear), `UP` (pyupgrade) — autofix, keep green,
   - `pyright` basic config + CI job (advisory first: `continue-on-error: true`),
   - TS strict: staged — enable `strict` in `tsconfig.app.json`, fix what surfaces,
     revert-and-record if the error count exceeds a night's honest fixing.

## What we're NOT doing

- No PR merges; no real supplier order; no activation of any location.
- No auto-linking of fuzzy product matches — near-misses go to reports.
- No invented city/address/company/threshold values — blanks + gap list.
- No KULINARNA stub deletion (operator confirms the KAMIENICA merge first).
- No seed-CSV bulk dump of new locations (seed is a fixture; it gets only what a
  test needs — engine tests use their own cut-down fixtures).
- No dispatch-path or engine (suggestion.py) changes anywhere.

## Decision notes (chosen by the orchestrator, per operator's "sam decyduj")

- **Pins only on divergence.** A 1:1 product needs no pin (NULL already means "every
  carrier"), and pinning everything would turn a no-op default into 1000+ rows of
  master data to maintain. Pins are emitted only where the same product has ≥2
  catalog suppliers after onboarding AND the location's sheet names exactly one.
- **Price list beats stock section** on supplier conflict inside one sheet — it is
  the deliberate catalog; conflicts still surface in the report (research §3.4).
- **Selgros lands as `active=FALSE`** exactly like Allegro, same rationale (empty
  supplier tab in every Captain picker otherwise). `ordering_method` unknown → the
  row ships as `manual` with a note; operator confirms (gap list).
- **One Kulinarna Kamienica** — onboard into KAMIENICA, KULINARNA stub untouched
  with a report note (research §3.6).
- **Engine in `supply-os-v1/scripts/`** beside `verify_parity.py` (precedent), core
  functions imported by tests; sheets read from a `--sheets-dir` argument so the
  scratchpad path is not hardcoded into the repo.

## Progress

### Phase A0: Prod snapshot (first, while access works — plan-review F4)

#### Automated
- [x] dump products / suppliers / supplier_products / location_product_settings /
      locations to `context/changes/multi-location-master-data/snapshot/*.json`
      (read-only; retry once; on classifier block record the gap and fall back to
      the freshest in-context data) — captured live 2026-08-21, counts verified
      (154/11/7/154/578)

### Phase A1: Engine core (TDD)

#### Automated
- [x] fixtures: representative sheet snippets cut from the real downloads
- [x] failing tests first (37 added; confirmed failing before implementation)
- [x] implement `scripts/reconcile_inventory.py` to green (885 lines; 490 passed)
- [x] `ruff check .` clean; full pytest green — verified independently by the
      orchestrator. Implementer surfaced 3 real grammar edge cases: blank
      "Dostawca" header cell (elektrownia), NBSP thousands separators, and the
      two-column side-by-side stock table (the prototype silently dropped every
      right-column entry). Post-A2 review found 2 defects (supplier alias false
      positives; near-miss missing suffix variants — orchestrator brief error);
      fix dispatched to the implementer.

### Phase A2: Reports over all 12 sheets

#### Automated
- [ ] CLI run over `scratchpad/sheets/` + a prod snapshot (read-only queries dumped
      to JSON) → 12 per-location reports + cross-location summary committed under
      `context/changes/multi-location-master-data/reports/`
- [ ] summary includes the operator gap list (per location: missing thresholds,
      missing city/address/company, unresolved supplier conflicts, near-miss names)

### Phase B1: SQL generation

#### Automated
- [ ] `emit_sql` covered by tests (golden-file: one small location fixture → exact
      SQL text)
- [ ] batches generated for: shared suppliers batch, 7 new locations, and
      pin/conflict batches for existing 4 locations
- [ ] every batch carries diff-before / audit-after and the 0008 precondition where
      pins are present

### Phase B2: Prod attempt (gated pattern)

#### Manual
- [x] shared-suppliers batch applied live (SUP_SELGROS + SUP_SPEC, inactive)
- [x] new products (21, P155–P175), new pairs (74, ALL `active=FALSE`),
      locations (6 new inactive + KAMIENICA rename), settings (908 rows / 8
      locations) applied live 2026-08-22
- [x] NO pin batch applied (blocked on 0008 + PR #26 by design)
- [x] audit-after: lps 578→1486; per-location counts match the generator's
      expected table exactly; live invariants unchanged (10 active suppliers,
      4 active locations, WOLA/BRACKA/NORBLIN/KEN untouched, all 74 new pairs
      inactive). Two mechanical, semantics-preserving deviations from the
      committed files: batch-10's `source_supplier_id` column stripped (absent
      pre-0008 — generator fix dispatched) and row-INSERTs compacted to
      multi-VALUES/SELECT form (same rows, same ON CONFLICT).

### Phase C1: H-01 hardening

#### Automated
- [ ] `requirements.lock` generated + CI installs from it
- [ ] ruff rules `I`, `B`, `UP` enabled and green
- [ ] pyright config + advisory CI job
- [ ] TS strict staged: enabled if fixable tonight, else reverted with an error
      inventory committed to the change folder
- [ ] `/verify` green after each sub-step

### Phase D: Verification + closeout

#### Automated
- [ ] `/verify`: backend ruff+pytest, frontend build+lint+vitest — all green
- [ ] proof saved under `verification/`
#### Manual
- [ ] decision report for the operator (what was chosen and why, gap list, what is
      ready-to-run vs applied) written to change.md and summarized in chat
- [ ] `10x-archive` proposed, not run
