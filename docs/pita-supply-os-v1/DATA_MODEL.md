# Data Model — Pita Bros Supply OS v1 (Wola Pilot)

7 tables. English column names. Product names and units stay Polish.

## Entity-relationship overview

```
locations ─┐
           │
           ├──< location_product_settings >──┐
           │                                  │
products ──┤                                  ├── products
           │                                  │
           ├──< supplier_products >──┐        │
           │                          │       │
suppliers ─┘                          └── products

orders ───────< order_lines >─── products
   │                  │
   └── location       └── (refs supplier_products for purchase unit & conversion)
   └── supplier
```

A line on an order always references **one product**, and uses the
`supplier_products` row for that `(supplier, product)` pair to know the
purchase unit and conversion factor.

---

## 1. `products`

The master list of every SKU Pita Bros tracks at the inventory level.

| Column            | Type         | Notes                                                  |
| ----------------- | ------------ | ------------------------------------------------------ |
| `product_id`      | string (PK)  | Stable code, e.g., `HALLOUMI`, `SUWLAKI`               |
| `product_name_pl` | string       | Polish display name, e.g., `Halloumi`                  |
| `product_category`| string       | `Cheese`, `Meat`, `Vegetable`, `Beverage`, `Other`     |
| `inventory_unit`  | string       | Polish unit symbol, e.g., `kg`, `szt`, `l`             |
| `is_critical`     | boolean      | Stockout has high operational cost                     |
| `active`          | boolean      | Soft-delete flag                                       |
| `notes`           | string       | Free text                                              |
| `inventory_order` | integer, nullable | Position on the common inventory-card template (migration 0027). See `location_product_settings.inventory_order` |

**Why this table:** the canonical product list. Captains and Managers never
type product names; they pick from this list.

---

## 2. `suppliers`

Master list of suppliers.

| Column                 | Type        | Notes                                                  |
| ---------------------- | ----------- | ------------------------------------------------------ |
| `supplier_id`          | string (PK) | Stable code, e.g., `SUP_KEY_ACCOUNT_A`                 |
| `supplier_name`        | string      | Display name                                           |
| `email`                | string      | Order destination email                                |
| `ordering_method`      | enum        | `email`, `portal`, `phone`, `manual`, `transport` (0021) |
| `delivery_days`        | string      | Free text, e.g., `Mon, Wed, Fri`                       |
| `cutoff_time`          | string      | `HH:MM` in `Europe/Warsaw`                             |
| `minimum_order_value_pln` | number   | For warning when order is below                        |
| `active`               | boolean     |                                                        |
| `notes`                | string      |                                                        |
| `suggestion_alerts_enabled` | boolean | (0022) default true; false = Captain sees the suggestion but no deviation alert and never a reason (Pago) |
| `coverage_prompt_enabled` | boolean | (0025) default false; true = on a Warsaw Thursday the Captain order screen shows the informational "na 1 dzień / na 3 dni" choice (Bukat, Intermlecz) |

**Why this table:** the Manager Dashboard needs supplier-specific dispatch
info (email + cutoff). In v0 only one supplier matters; in Phase 2 this is
where multi-supplier consolidation lives.

### 2a. `supplier_delivery_rules` (migration 0025, delivery-calendar)

When a supplier can deliver, per supplier (shared row, `location_id` NULL) or
per supplier + location (override). Read by `app/delivery_calendar.py` to
propose the Captain's delivery date and the order-by moment.

| Column              | Type        | Notes |
| ------------------- | ----------- | ----- |
| `rule_id`           | string (PK) | E.g. `DR-PAGO-WOLA`, `DR-BUKAT-ALL` |
| `supplier_id`       | string (FK) | → `suppliers.supplier_id` |
| `location_id`       | string (FK), nullable | → `locations.location_id`; NULL = shared rule for every location |
| `order_weekdays`    | string      | Days an order counts, strict `Mon..Sun` comma list, e.g. `Sun,Thu` |
| `lead_days`         | smallint    | 0..14; minimum calendar days from the order day to delivery |
| `delivery_weekdays` | string      | Allowed delivery days, same format |
| `order_deadline`    | string      | `HH:MM` Europe/Warsaw on the order day, default `17:00` |
| `active`            | boolean     | Inactive rows are ignored |
| `notes`             | string      | Source of the rule (e.g. `Marek 28.09`) |

`UNIQUE NULLS NOT DISTINCT (supplier_id, location_id)`: at most one shared rule
and one override per location per supplier.

---

## 3. `locations`

| Column             | Type        | Notes                                          |
| ------------------ | ----------- | ---------------------------------------------- |
| `location_id`      | string (PK) | Stable code, e.g., `WOLA`                      |
| `location_name`    | string      | Display name, e.g., `Pita Bros Wola`           |
| `delivery_address` | string      | One-line address for supplier order            |
| `city`             | string      |                                                |
| `active`           | boolean     |                                                |
| `notes`            | string      |                                                |
| `company_name`     | string?     | Operating company for the e-mail footer (0007) |
| `company_address`  | string?     | (0007)                                         |
| `company_nip`      | string?     | (0007)                                         |
| `email`            | string?     | Location mailbox, CC'd on dispatch (0019)      |
| `sender_email`     | string?     | Send-as alias used as From on the order e-mail (0026) |
| `phone`            | string?     | Location phone printed in the order e-mail (0026) |

**Why this table:** the order header references it. In v0 only `WOLA` is
active. In Phase 2 we add more locations and the Manager Dashboard
consolidates across them.

---

## 4. `supplier_products`

Mapping between supplier and product, with the purchase-unit logic. This is
where the **unit conversion** lives.

| Column                       | Type        | Notes                                                                 |
| ---------------------------- | ----------- | --------------------------------------------------------------------- |
| `supplier_product_id`        | string (PK) | Stable code, e.g., `SUP_A__HALLOUMI`                                  |
| `supplier_id`                | string (FK) | → `suppliers.supplier_id`                                             |
| `product_id`                 | string (FK) | → `products.product_id`                                               |
| `supplier_product_name`      | string      | Polish, what the supplier calls it on their invoice                   |
| `purchase_unit`              | string      | Polish unit, e.g., `karton`, `szt`, `worek`                           |
| `units_per_purchase_unit`    | number      | Inventory units in one purchase unit. E.g., 1 karton Halloumi = 9 kg → `9.0` |
| `rounding_rule`              | enum        | `full_only`, `half_allowed`, `up_for_critical`, `tenth_kg`            |
| `price_estimate_pln`         | number      | Optional in v0, populated when known                                  |
| `active`                     | boolean     |                                                                       |
| `notes`                      | string      | E.g., `1 karton = 36 szt = 9 kg`                                      |
| `display_order`              | integer     | Optional position in the supplier's list (migration 0023). Every per-supplier screen and document sorts by it, then by `supplier_product_id`; empty = no position (keeps id order, after positioned rows) |
| `counts_toward_minimum`      | boolean     | Default `true`. `false` = excluded from the basis the informational minimum-order chip compares with `suppliers.minimum_order_value_pln` (Bukat: Tzatzyki, Tirokafteri, Feta). Never a gate (migration 0023) |

**Why this table:** suggestion calculation requires this. Without
`units_per_purchase_unit`, you cannot translate "need 9.5 kg" into "order 1
carton." Hand-validate every row before pilot launch.

---

## 5. `location_product_settings`

The min / max / target stock per product per location, all in inventory unit.

| Column                            | Type        | Notes                                                       |
| --------------------------------- | ----------- | ----------------------------------------------------------- |
| `setting_id`                      | string (PK) | Stable code, e.g., `WOLA__HALLOUMI`                         |
| `location_id`                     | string (FK) | → `locations.location_id`                                   |
| `product_id`                      | string (FK) | → `products.product_id`                                     |
| `min_stock_qty`                   | number      | In `products.inventory_unit`                                |
| `max_stock_qty`                   | number      | In `products.inventory_unit`                                |
| `target_stock_qty`                | number      | In `products.inventory_unit`. Default = `max_stock_qty`     |
| `is_critical_for_location`        | boolean     | Overrides `products.is_critical` if set                     |
| `allow_over_max_due_to_packaging` | boolean     | When `true`, packaging-driven overage doesn't trigger reason |
| `notes`                           | string      |                                                             |
| `inventory_order`                 | integer, nullable | Per-location override of `products.inventory_order` (migration 0027) |

**Inventory card order (inventory-card-order, migration 0027).** The location-wide inventory
screens (Captain count grid and correction, Captain count history, Manager inventory detail and
its CSV) list products in the order of the location's printed inventory card. Effective position
= `location_product_settings.inventory_order` when set, else `products.inventory_order`; rows
sort by it, then by `product_id`, and rows without a position go last (`app/product_order.py`).
Both columns are master data owned by the card pipeline in
`context/changes/inventory-card-order/data/` — never hand-edit them; re-run the pipeline and its
gated SQL after a card changes.

**Why this table:** the heart of the suggestion logic. Same product can have
different settings per location (Wola has 20 m² of cooler; another point has
40 m²).

---

## 6. `orders`

Order header. One row per `(location, supplier, order_date)`.

| Column                       | Type        | Notes                                                          |
| ---------------------------- | ----------- | -------------------------------------------------------------- |
| `order_id`                   | string (PK) | E.g., `WOLA__SUP_A__2026-05-22`                                |
| `location_id`                | string (FK) | → `locations.location_id`                                      |
| `supplier_id`                | string (FK) | → `suppliers.supplier_id`                                      |
| `order_date`                 | date        | `YYYY-MM-DD`                                                   |
| `requested_delivery_date`    | date        | Chosen by the Captain; prefilled from the delivery calendar (0025) or, without a rule, from `suppliers.delivery_days` |
| `suggested_delivery_date`    | date        | (0025) What the delivery calendar proposed at submit; NULL when no rule applied. The Manager marker shows only when it differs from `requested_delivery_date` |
| `coverage_days`              | smallint    | (0025) Thursday choice, 1 or 3; NULL = not asked / not answered. Informational only |
| `status`                     | enum        | `draft`, `captain_submitted`, `manager_sent`, `closed`, `cancelled` |
| `captain_user`               | string      | Identifier of submitting Captain                               |
| `captain_submitted_at`       | timestamp   | ISO 8601, `Europe/Warsaw`                                      |
| `manager_user`               | string      | Identifier of dispatching Manager                              |
| `manager_sent_at`            | timestamp   |                                                                |
| `sent_method`                | enum        | `gmail_draft`, `email_direct`, `csv`, `portal_manual`, `phone` |
| `supplier_order_reference`   | string      | The supplier's confirmation/reference code, manually pasted    |
| `total_value_estimate_pln`   | number      | Calculated from `order_lines × supplier_products.price_estimate_pln` |
| `notes`                      | string      |                                                                |

**Why this table:** the dispatch state machine lives here. The Manager
Dashboard's queue is a query against `status = 'captain_submitted'`.

---

## 7. `order_lines`

Line-level data. This is **the audit asset** of the whole system.

| Column                         | Type        | Notes                                                          |
| ------------------------------ | ----------- | -------------------------------------------------------------- |
| `order_line_id`                | string (PK) |                                                                |
| `order_id`                     | string (FK) | → `orders.order_id`                                            |
| `product_id`                   | string (FK) | → `products.product_id`                                        |
| `supplier_product_id`          | string (FK) | → `supplier_products.supplier_product_id` (locks conversion)   |
| `current_stock_qty_base`       | number      | Reported by Captain, in inventory unit                         |
| `target_stock_qty_base`        | number      | Snapshot from `location_product_settings.target_stock_qty`     |
| `suggested_qty_base`           | number      | Computed: `max(0, target − current)`                           |
| `suggested_qty_purchase`       | number      | Computed: rounded per `rounding_rule`                          |
| `captain_final_qty_purchase`   | number      | Captain's decision in purchase unit                            |
| `captain_final_qty_base`       | number      | = `captain_final_qty_purchase × units_per_purchase_unit`       |
| `manager_final_qty_purchase`   | number      | Manager override (defaults to captain's qty)                   |
| `manager_final_qty_base`       | number      |                                                                |
| `delta_vs_suggestion_pct`      | number      | `(manager_final − suggested) / suggested × 100`. Null if suggested = 0 |
| `reason_code`                  | enum        | See below. Null if no deviation                                |
| `captain_comment`              | string      | Free text                                                      |
| `manager_comment`              | string      | Free text                                                      |

### Reason codes

Required when `|delta_vs_suggestion_pct| > 20%`, or `manager_final_qty_base = 0`
on a critical product, or order exceeds `max_stock × 1.2`.

| Code                          | Meaning                                              |
| ----------------------------- | ---------------------------------------------------- |
| `EVENT_HIGH_TRAFFIC`          | Known event raising demand                           |
| `WEEKEND_HIGH_TRAFFIC`        | Weekend uplift expected                              |
| `STOCK_UNTIL_NEXT_DELIVERY`   | Ordering for the whole cycle ahead of a fixed delivery day (migration 0016) |
| `LOW_STORAGE`                 | Cannot accept full suggested qty                     |
| `PACKAGING_LIMITATION`        | Forced overage due to carton/pack size               |
| `SUPPLIER_UNDERDELIVERS`      | Buffer because this supplier short-delivers          |
| `SYSTEM_SUGGESTION_WRONG`     | Captain believes the suggestion is mis-calibrated    |
| `OTHER`                       | Free text in `captain_comment` is then required      |

---

## 7a. `finance_documents`, `finance_document_lines`, `finance_receipt_reviews`, `finance_line_aliases` (migration 0017, finance-invoice-reconciliation)

READ-ONLY mirror of the accountant's verified purchase invoices from Symfonia eBiuro plus the
Manager's reconciliation verdicts. Supabase-only (`SUPPORTS_FINANCE`); the app never writes back
to eBiuro. Also adds `suppliers.nip` (digits only) — the key pairing an eBiuro document with our supplier.

| Table | Key | Purpose |
|---|---|---|
| `finance_documents` | `doc_id` (eBiuro id, global across companies) | header: `company_id`/`company_nip` (buyer spółka), `contractor_nip`/`contractor_name` (seller), `doc_type` ("Faktura zakupu" / "Korekta zakupu"), `invoice_number`, `ksef_number`, `issue_date`, `sell_date`, `payment_deadline`, `netto`/`brutto`/`vat`, `pdf_url` (never sent to the SPA), `listing_fp` (change detector), `last_seen_at` (stale-doc guard), `synced_at` |
| `finance_document_lines` | `(doc_id, ordinal)` | invoice positions: `name` (supplier wording), `quantity`, `unit` (supplier label, e.g. "CS"), `netto`, `brutto`, `unit_price_netto`, `vat_rate` |
| `finance_receipt_reviews` | `receipt_id` | Manager verdict: `doc_id`, `status` `confirmed` \| `mismatch`, `note`, `actor`, `reviewed_at`. Partial UNIQUE on `doc_id WHERE status='confirmed'`: one invoice confirmed against ONE receipt |
| `finance_line_aliases` | `(contractor_nip, invoice_name_norm)` | learned "how supplier X names our product": `product_id`, `invoice_name`, `actor`, `created_at` |

Matching is computed at read time (`app/finance_match.py`), never persisted: candidates by seller
NIP + buyer NIP + date window, lines by name coverage / aliases, quantities in purchase units
(a base-unit conversion is only tried when the invoice unit family differs and yields
`ok_converted`, never `ok`). Advisory statuses: `no_invoice` / `unsure` / `possible_collective` /
`ok` / `diff`; a review overrides with `confirmed` / `mismatch`.

## Derived calculations (read-only, computed at write time)

```
suggested_qty_base       = max(0, target_stock_qty - current_stock_qty_base)
suggested_qty_purchase   = round_per_rule(suggested_qty_base / units_per_purchase_unit, rounding_rule)
captain_final_qty_base   = captain_final_qty_purchase × units_per_purchase_unit
manager_final_qty_base   = manager_final_qty_purchase × units_per_purchase_unit
delta_vs_suggestion_pct  = ((manager_final_qty_base - suggested_qty_base) / suggested_qty_base) × 100
                          (null if suggested_qty_base = 0)
```

`round_per_rule`:
- `full_only`: `ceil(x)` for critical or low-stock products, `round(x)` otherwise
- `half_allowed`: `round(x × 2) / 2`
- `up_for_critical`: `ceil(x)` always
- `tenth_kg`: `ceil(x × 10) / 10` — round up to the next 0.1 (weight goods, e.g. 0.7 / 1.5 kg)

---

## What's NOT in v0 (will live in extra tables later)

These tables are designed and documented in [ROADMAP.md](ROADMAP.md) but not
created in v0:

- `receipts` + `receipt_lines` (Phase 2 — receiving + WZ)
- `discrepancies` (Phase 2)
- `inventory_counts` + `inventory_count_lines` (Phase 3 — remanent module)
- `audit_log` (v0 logs are inferable from `order_lines` history; Phase 2
  adds a dedicated immutable log)
- `export_runs` (Phase 3 — GoStock export tracking)

The 7 tables above are sufficient for the v0 Captain-submit → Manager-dispatch
loop.
