---
date: 2026-09-01T17:43:39+02:00
researcher: Claude (Opus 5)
git_commit: fec545a9945196ec7b0cfdad569c8342b1802a56
branch: claude/feedback-szkolenie-0109
repository: JARVIS / 10xDEVS
topic: "Training-session feedback — ordering UX, inventory edit, master data, transport documents"
tags: [research, codebase, captain-mp, inventory-count, transport, master-data]
status: complete
last_updated: 2026-09-01
last_updated_by: Claude (Opus 5)
---

# Research: Training-session feedback (2026-09-01)

## Research Question

Ground the operator's training feedback (see `change.md`) in the codebase and in live
prod data, so a staged implementation plan can be written without guessing.

## Summary

Four parallel code probes plus five read-only prod queries. Six findings materially
change the shape of the work:

1. **The "Pago pokazuje wszystkie produkty" bug is NOT a supplier-mixing bug.** Verified
   on prod: the only two `TRN-` batches each contain exactly one `supplier_id`
   (`SUP_PAGO`). The real problem is that `SUP_PAGO` is a *purchasing channel*, not a
   warehouse — its 14-product batch spans `Biurowe` (till rolls), `Opakowania` (napkins,
   trays), `Chłodnia` and `Mrożonki`. The self-pickup document ("ZLECENIE ODBIORU
   WŁASNEGO", i.e. the Lineage cold-storage run) must list only goods physically picked
   up there. This needs a **classification flag**, not a supplier filter.
2. **`price_estimate_pln` is not exposed to the Captain order screen at all**
   (`_build_orderable_item`, `supply-os-v1/app/main.py`), and the screen deliberately
   shows no money (`ConfirmSubmitDialog.tsx:11-12`). A "value vs. minimum" indicator can
   therefore only land cheaply on the **Manager** side, where the total already renders.
3. **A resumable inventory draft already exists** (`InventoryCountPage.tsx:231-244`,
   localStorage via `auth.ts`). What actually forces a redo is that a *submitted* count
   is immutable: `inventory_counts` is the only persisted entity with **zero** update
   path in either backend.
4. **Corfu Pilsner already exists on prod** as `P157` — but with `purchase_unit='szt'`,
   `units_per_purchase_unit=1`, while its siblings (Lager/Weiss/Free) are `zgrzewka`/6.
   It is missing `location_product_settings` rows, not the product row.
5. **Prod diverges from the seed CSVs** in ways that matter: `Selgros` already carries
   `supplier_products` rows despite `active=false`; seed has zero KEN/BROWARY threshold
   rows; `Tirokafteri` has two supplier rows with different units.
6. **Nine backup tables on prod have RLS disabled** — readable and writable with the
   anon/authenticated key. Every real table carries deny-all RLS (migration 0002).

## Detailed Findings

### Captain order screen (`frontend/src/pages/captain-mp/`)

- Per-line state is owned solely by `CaptainMP.tsx:59` (`useState<Record<string, OrderLine>>`);
  `ProductCard` and `ReasonPicker` are controlled/stateless. An "overrule all" control has a
  precedent to copy exactly: `PrefillControl.tsx`, rendered as a sibling section above the card
  list (`CaptainMP.tsx:619-629`), whose `fillEmpties`/`overwriteAll` handlers
  (`CaptainMP.tsx:331-374`) already implement "loop every line, conditionally patch, one batched
  `setLines`".
- The deviation gate is mirrored client-side in `lib/compute.ts:71-168` (`computeRowState`),
  returning `requiresReason` — the single flag that shows `ReasonPicker`. Reason `OTHER`
  additionally requires a comment (`ReasonPicker.tsx:32-33`).
- **`notes` is hardcoded empty on submit**: `CaptainMP.tsx:418` (`notes: ""`) and
  `OrderEditPage.tsx:196`. There is no authoring UI for an order-level comment.
- **No free-text/ad-hoc product concept exists anywhere.** `AddProductPicker.tsx` can only
  select an existing `OrderableItem`; the backend `ManagerAddLineRequest` requires a real
  `product_id` + `supplier_product_id` resolved against master data.
- **`notes` is already overloaded**: `manager_release` writes the send-back reason into
  `orders.notes` (`main.py`, `manager_release`). Ad-hoc items must NOT reuse that field.
- The three attribution inputs (`ordered_by` `CaptainMP.tsx:585-593`, `count_user`
  `InventoryCountPage.tsx:440-447`, `received_by` `ReceiveDeliveryPage.tsx:228-237`) are plain
  text inputs; two carry `autoComplete="name"`, the receipt one carries none. No suggestion
  list of any kind exists.
- `Supplier.minimum_order_value_pln` exists end-to-end (`types.ts:44`, `models.py:64`,
  `supabase_backend.py:90`) and is **referenced by zero business logic**. `activeSupplier` is
  already in scope on `CaptainMP.tsx:465-466`.

### Inventory count

- Routes: `main.py:2089-2124` (products), `2127-2230` (submit), `2233-2289` (latest),
  `2290-2341` (counts), `2342-2439` (detail), `2440-2494` / `2495+` (manager views).
  **No PATCH/PUT/DELETE exists.**
- Seam: `sheets.py` and `supabase_backend.py:535-564` both expose only
  `load_*` / `append_*` / `get_inventory_count`. Every *other* entity has an update path
  (`update_order` 382, `update_order_lines` 422, `update_receipt` 636,
  `update_transport_batch` 679) — inventory is the sole exception.
- Best audit template: **`transport_events`** (`models.py:989-1004`, migration
  `0010_transport_events.sql`, emitter `_log_transport_event` at `main.py:1476-1514`) — an
  append-only child table written best-effort inside `try/except` so an audit failure never
  breaks the business action. Superior to `last_edited_at` (no actor, no diff) and to the
  cancel trace (single fixed slot, not repeatable).
- Submit accepts a partial count (`min_length=1`, no completeness check); the confirm dialog
  only warns "counted/total" (`InventoryCountPage.tsx:113`). A partial submit is then
  permanently frozen — exactly the operator's complaint.
- Categories render **raw** from `products.product_category` (`main.py:2119` →
  `InventoryCountPage.tsx:327,520`). The only translated string in that path is the
  empty-category fallback `inventory.uncategorized` (`strings.ts:672`). Verified on prod: all
  175 products use 10 Polish categories (`Biurowe` 8, `Chemia` 34, `Chłodnia` 23, `Gaz` 1,
  `Mrożonki` 10, `Napoje` 35, `Opakowania` 26, `Produkcja` 9, `Spożywcze` 25, `Wino` 4) —
  no English value exists in the data.

### Transport documents

- `buildTransportPagoPrintDoc` (`transport.ts:706-745`) filters only on
  `total_qty_purchase > 0` (`transport.ts:730`). Backend `_aggregate_transport_lines`
  (`main.py:3095-3184`) has no supplier scoping and documents that it *trusts* the
  single-supplier invariant (`main.py:3115-3117`) rather than checking it.
  `manager_transport_batch_detail` builds its member set by pure marker equality
  (`main.py:3409`) and derives `isPago` from `group[0].supplier_id` (`main.py:3438-3441`).
- Write paths are sound: `manager_transport_create` guards per order (`main.py:3720`) and on
  `append_to` (`main.py:3684`); `add-location` creates orders with
  `supplier_id=batch.supplier_id` (`main.py:4136`) and prefills through
  `_build_orderable_items` (`main.py:4151`), which is supplier-scoped (`main.py:206-214`).
  `order.supplier_id` is never mutated. **Confirmed against prod: no mixed batch exists.**
- Old entity appears in five places: the `PAGO_ENTITY` constant (`transport.ts:675-680`), the
  title bar literal (`transport.ts:719`), the i18n pickup bar (`strings.ts:1267-1270`), and two
  tests (`transport.test.ts:689-700`, `transportPdf.test.ts:192-197`).
- The unit column is `SupplierProduct.purchase_unit` passed straight through
  (`transport.ts:637`, `transportPdf.ts:245`) — **a data fix, not a code fix**.
- No string `"LOTS"` exists anywhere in the repo. Existing driver columns: `Lp.`
  (`strings.ts:1252`), `Produkt` (`transportPdf.ts:151`), `Jm.` (`strings.ts:1253`),
  one `LOC • <location>` per location (`transportPdf.ts:153`, a literal template, not an
  i18n key), `Razem` (`strings.ts:1254`).
- PDF generation (`downloadTransportPdf` `transportPdf.ts:310-335`,
  `generateTransportPdfBase64` `:341-383`) lazily imports pdfmake and is explicitly untested
  (`transportPdf.ts:13-15`) — the exact area `lessons.md:82-87` warns fails silently.

### Live prod master data (read-only queries, 2026-09-01)

| product | id | category | supplier(s) | purchase_unit | units/pu | note |
|---|---|---|---|---|---|---|
| Tirokafteri | P012 | Chłodnia | SUP_BUKAT / SUP_PAGO | `wiadro` / `kg` | 3.0 / 3.0 | operator: 2 kg tubs, and the Pago row should not be `kg` |
| Rolki do kasy (×4) | P128/129/130/142 | Biurowe | SUP_PAGO | `szt` | 1.0 | operator: packs of 10 or 6 |
| Gyros 15/25 KG | P024/P025 | Mrożonki | SUP_PAGO | `blok` | 15 / 25 | no pork/chicken split |
| Gyros (ścięty + nieścięty) | P037 | Produkcja | SUP_INTERNAL | `kg` | 1.0 | cut+whole mixed in one SKU |
| Souvlaki Kurczak / Wieprz | P027/P028 | Mrożonki | SUP_PAGO | `karton` | 5.0 | already split |
| Butla gazowa 10L | P134 | Gaz | SUP_KAMINO | `szt` | 1.0 | no open/closed split |
| Bombilla | P135 | Napoje | SUP_EUROFOOD + SUP_BUKAT | `szt` | 1.0 | to deactivate ("bąbila") |
| Corfu Pilsner | **P157** | Napoje | SUP_FILBER | `szt` | **1.0** | exists; siblings are `zgrzewka`/6 |
| Corfu Lager/Weiss/Free | P136/137/138 | Napoje | SUP_FILBER | `zgrzewka` | 6.0 | |
| Kasza Pęczak | P036 | Produkcja | SUP_INTERNAL | `kg` | 1.0 | cooked |
| CIECIORKA | P046 | Spożywcze | SUP_SELGROS + SUP_INTERMLECZ | `szt` | 1.0 | no cooked counterpart in `Produkcja` |

Absent from prod entirely (genuinely new SKUs): **skrzynki** (crates) and **taśmy** (tapes).

`suppliers.minimum_order_value_pln` is NULL for all 13 rows. `Allegro` / `Selgros` /
`Spec Food` exist with `active=false` — but Selgros already has `supplier_products` rows.

### Prod hygiene finding

Nine `public` tables have `relrowsecurity = false`: `_lps_backup_20260831`,
`_draft_bak_{batches,lines,orders}_20260901`,
`_training_bak_{batches,lines,orders,receipts,receipt_lines}_20260901`. Every real table
carries deny-all RLS from `0002_rls_deny_all.sql`. These snapshots are reachable with the
anon key.

## Architecture Insights

- The repo's additive-migration discipline is strong: `IF NOT EXISTS`, nullable/defaulted
  columns, a `-- Rollback:` comment, deny-all RLS on new tables, and "apply to prod BEFORE
  deploying backend code" stated in the file header (`0004`, `0010`, `0012`).
- ID conventions verified against seed: products `P###`, supplier_products
  `SP_<SUPPLIER>_<PRODUCT>`, settings `<LOCATION>__<PRODUCT>` (double underscore).
  `location_product_settings` has `UNIQUE (location_id, product_id)`; `supplier_products`
  has **no** uniqueness on `(supplier_id, product_id)` — one-product-one-supplier is
  convention only.
- `product_category` is free text — no CHECK constraint, no Pydantic enum, no TS union.

## Historical Context

- `context/changes/ken-browary-master-data/rollout-notes.md:57-59` already logged the gyros
  pork/chicken split as an unresolved TODO ("KEN: dwa wiersze arkusza, jeden produkt w
  katalogu — nie sumowano bez decyzji"). This feedback is the decision point.
- `context/changes/wolska-blueservice-master-data/prod-sql.sql` is the best template for a
  prod batch: BEFORE snapshot as a comment block, idempotent `INSERT ... ON CONFLICT DO
  NOTHING` apply section, AUDIT + ROLLBACK as commented SQL in the same file.
- `context/changes/to-ordering-pago/verification/deploy-proof.md` records the prod check
  proving migration 0008 is absent and no `main` code references `source_supplier_id`.
  Re-verified: zero hits in `supply-os-v1/app/`. The 0008 hazard is inert on `main`.

## Open Questions

1. **"LOTS"** on the driver list — no such string exists. Needs a screenshot before any fix.
2. **Category language** — prod categories are all Polish and deliberately so
   (`CATEGORIES_AND_UNITS.md`). Does the operator want EN translations under the EN toggle,
   or did he see the `Uncategorized` fallback chip?
3. **Gyros split shape** — two products (cut / whole) per meat type, or a variant attribute?
   Affects KEN's two-chicken ask and the deferred ken-browary TODO together.
4. **Roll pack sizes** — which of P128/129/130/142 is 10 and which is 6.
5. **Corfu Pilsner packaging** — align P157 to `zgrzewka`/6 like its siblings, or is `szt`
   correct for this SKU?
