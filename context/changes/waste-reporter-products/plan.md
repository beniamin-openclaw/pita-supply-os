# Plan: Reporter attribution and full-database waste products

## Desired state

Every newly created report requires a trimmed nonblank reported_by name (maximum120characters), entered using the existing name/datalist pattern. The name belongs to the immutable report batch, appears in both histories and CSV and is never invented for historical rows. The existing17curated cards remain. + Product opens a small searchable chooser over the existing complete authenticated /api/products response, without supplier/location filtering. Added rows use the actual product name and inventory_unit, a +1 addition and manual quantity, with reason and removal. Retain free-form Other separately.

## Contract and safety decisions

- Add nullable reported_by to waste_reports and nullable source_product_id to waste_report_lines via migration0033. Old rows remain null. Never backfill a guessed person or map curated IDs to purchasing IDs by name.
- source_product_id identifies a master product independently of the existing curated product_id. Exactly one curated/master/manual identity; master rows have no free-form description and use server-resolved immutable name/unit snapshots. Totals group by source_product_id as well as existing identity/unit/location. CSV appends attribution/source fields without moving existing columns.
- Master units are arbitrary inventory-unit strings, including opak/box; never coerce them to kg/szt. Master g is a base unit and is not the curated display-grams-to-kg conversion. All base quantities retain exact3decimal precision/bounds. Existing curated and Other validation stays intact.
- Request reads may parse an absent reporter only for old exact-batch replay. Before any new INSERT, a name is mandatory and master IDs/units are checked against real backend products. Existing exact legacy batch replay must still succeed even if a product's current metadata changed. Missing name/unknown ID/wrong unit is definitive rejected422, not unknown503.
- Omit newly introduced null fields from the digest to preserve existing legacy hashes; new names/source IDs participate in immutable payload digest and response matching. Changed name/source with same batch409. Backend data access stays behind _choose_backend and shared error types.
- Fresh/ordinary restored drafts gain a blank name; preserve previous quantities, duplicates and selected master metadata. Never mutate an already frozen legacy payload, add fields during retry or unlock on a by-batch404. Expose a clear localized message for legacy uncertain drafts needing readback.
- All API use goes via apiClient; all copy PL/EN via i18n. Source snapshots are revalidated by the server, not trusted from the browser. Name suggestions are stored only after a confirmed successful save.
- Existing0032constraint names are changed explicitly only where needed; preserve quantity/reason/void/curated checks. Migration is additive/transactional with named checks. Rollback after non-kg/szt data cannot use ae643989's narrow readers; preserve all data and retain a widened reader, or temporarily restore pre-waste02a0930 with the feature unavailable. No automatic DROP/DELETE.

## Phase 1: Persisted attribution and master-product contract

Modify backend models/errors/main/supabase backend, add0033migration, update waste unit/integration fixtures and meaningful tests. Ensure legacy digest/readback, missing reporter prewrite rejection, actual master units/snapshots, total grouping, CSV and role isolation.

### Success criteria

#### Automated verification
- Backend validates new attribution and master identity/unit before writes, preserves legacy exact retry and returns stable rejection/conflict outcomes.
- Disposable Postgres proves migration compatibility, snapshots, mixed units, totals/CSV, atomic rollback and scoped attribution/history without altering existing rows.

#### Manual verification
- Ben reviews the concrete migration, candidate and rollback before any new production promotion.

## Phase 2: Familiar name entry and searchable product additions

Modify waste page/helper/types/quantity input/history/i18n plus nameSuggestions role and focused tests. Reuse existing primitives and API product shape; do not pretend a supplier OrderableItem exists for a master row. Add accessible search/list controls, lazy product loading with clear errors/retry, and preserve legacy draft/frozen safety.

### Success criteria

#### Automated verification
- Missing/blank names block save with accessible focus; confirmed names persist to payload/history/CSV and suggestions, with legacy read fallback.
- + Product searches the complete master list, preserves exact unit and immutable identity on add/remove/reload and supports repeated additions/manual input without changing curated cards or Other.
- Scope/late-response/frozen-body guards remain intact, including legacy uncertain drafts and name/source mismatch detection.

#### Manual verification
- Inspect mobile/desktop entry, chooser and both histories with auth enabled against a real local database.

## Phase 3: Verification, independent review and release proposal

Run full backend Ruff/pytest/integration and frontend build/lint/Vitest. Local browser E2E must prove required name, product search, kg/szt/opak/box/master-g correctness, repeat/manual quantity, reload retention, actual save/readback, both histories, CSV and immutable retry. Use synthetic local records only. Independently review the full delta, fix findings and prepare exact migration-before-code release proposal and rollback. Do not change the Office draft/send anything in this task.

### Success criteria

#### Automated verification
- Full product gates and auth-enabled real-Postgres browser E2E pass for the final application candidate.
- Independent implementation review resolves actionable findings and release artifacts identify exact source, schema prerequisite, rollback and pending operator acceptance.

#### Manual verification
- After an authorized verified deployment, Ben accepts actual reporter/product save/history/CSV behavior; archive only after acceptance.

## Progress

### Phase 1: Persisted attribution and master-product contract

#### Automated
- [ ] 1.1 Backend validates new attribution and master identity/unit before writes, preserves legacy exact retry and returns stable rejection/conflict outcomes.
- [ ] 1.2 Disposable Postgres proves migration compatibility, snapshots, mixed units, totals/CSV, atomic rollback and scoped attribution/history without altering existing rows.

#### Manual
- [ ] 1.3 Ben reviews the concrete migration, candidate and rollback before any new production promotion.

### Phase 2: Familiar name entry and searchable product additions

#### Automated
- [ ] 2.1 Missing/blank names block save with accessible focus; confirmed names persist to payload/history/CSV and suggestions, with legacy read fallback.
- [ ] 2.2 + Product searches the complete master list, preserves exact unit and immutable identity on add/remove/reload and supports repeated additions/manual input without changing curated cards or Other.
- [ ] 2.3 Scope/late-response/frozen-body guards remain intact, including legacy uncertain drafts and name/source mismatch detection.

#### Manual
- [ ] 2.4 Inspect mobile/desktop entry, chooser and both histories with auth enabled against a real local database.

### Phase 3: Verification, independent review and release proposal

#### Automated
- [ ] 3.1 Full product gates and auth-enabled real-Postgres browser E2E pass for the final application candidate.
- [ ] 3.2 Independent implementation review resolves actionable findings and release artifacts identify exact source, schema prerequisite, rollback and pending operator acceptance.

#### Manual
- [ ] 3.3 After an authorized verified deployment, Ben accepts actual reporter/product save/history/CSV behavior; archive only after acceptance.
