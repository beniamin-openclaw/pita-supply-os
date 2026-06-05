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
| `ordering_method`      | enum        | `email`, `portal`, `phone`, `manual`                   |
| `delivery_days`        | string      | Free text, e.g., `Mon, Wed, Fri`                       |
| `cutoff_time`          | string      | `HH:MM` in `Europe/Warsaw`                             |
| `minimum_order_value_pln` | number   | For warning when order is below                        |
| `active`               | boolean     |                                                        |
| `notes`                | string      |                                                        |

**Why this table:** the Manager Dashboard needs supplier-specific dispatch
info (email + cutoff). In v0 only one supplier matters; in Phase 2 this is
where multi-supplier consolidation lives.

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
| `requested_delivery_date`    | date        | Set by Captain or auto-suggested from `suppliers.delivery_days`|
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
| `LOW_STORAGE`                 | Cannot accept full suggested qty                     |
| `PACKAGING_LIMITATION`        | Forced overage due to carton/pack size               |
| `SUPPLIER_UNDERDELIVERS`      | Buffer because this supplier short-delivers          |
| `SYSTEM_SUGGESTION_WRONG`     | Captain believes the suggestion is mis-calibrated    |
| `OTHER`                       | Free text in `captain_comment` is then required      |

---

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
