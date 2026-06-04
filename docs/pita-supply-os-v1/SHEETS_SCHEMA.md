# Google Sheets Backbone — Pita Bros Supply OS v1

One Google Sheet holds all 7 tables as separate tabs. The Sheet is the
single source of truth for v0. Both the Captain Submit screen and the
Manager Dashboard read from / write to it. Other agents (Gmail,
COO-CFO reports) can read it via existing Sheets MCP connections.

## File location

**Live Sheet (2026-05-23):**
- URL: <https://docs.google.com/spreadsheets/d/11aJUcMUvb6Uuc8XcH8KdBdWr-iyvoJOZrsh2O2YQ9Lo/edit>
- Sheet ID: `11aJUcMUvb6Uuc8XcH8KdBdWr-iyvoJOZrsh2O2YQ9Lo`
- Drive parent: `Pita Bros Office Files / Pita Bros Supply OS — Wola Pilot`
  (`1R5P47KMc8yaEaifJ8Oy8r8IbmorMsb2w`)
- Owner: beniamin@pitabros.pl
- Created from xlsx upload + manual "Save as Google Sheets" conversion on 2026-05-23
- Original xlsx remains in same folder as backup (`supply_os_master_v0.xlsx`, id `1jYFQ5ZH07EeLWZ2lEtgNtv0v9DOw0X4A`)

Tabs follow the [DATA_MODEL.md](DATA_MODEL.md) table names 1:1.

## Tabs

| Tab name                    | Source table                | Pre-seeded?                |
| --------------------------- | --------------------------- | -------------------------- |
| `products`                  | `products`                  | Yes — 20 v0 products       |
| `suppliers`                 | `suppliers`                 | Yes — 1 v0 supplier        |
| `locations`                 | `locations`                 | Yes — `WOLA`               |
| `supplier_products`         | `supplier_products`         | Yes — 20 rows              |
| `location_product_settings` | `location_product_settings` | Yes — 20 rows for `WOLA`   |
| `orders`                    | `orders`                    | Empty (filled by submits)  |
| `order_lines`               | `order_lines`               | Empty (filled by submits)  |
| `_meta`                     | (system)                    | Version, last-updated, owner contacts |
| `_reason_codes`             | (lookup)                    | 7 reason codes from [DATA_MODEL.md](DATA_MODEL.md) |

## Tab structures (headers in row 1)

### `products`
```
product_id | product_name_pl | product_category | inventory_unit | is_critical | active | notes
```

### `suppliers`
```
supplier_id | supplier_name | email | ordering_method | delivery_days | cutoff_time | minimum_order_value_pln | active | notes
```

### `locations`
```
location_id | location_name | delivery_address | city | active | notes
```

### `supplier_products`
```
supplier_product_id | supplier_id | product_id | supplier_product_name | purchase_unit | units_per_purchase_unit | rounding_rule | price_estimate_pln | active | notes
```

### `location_product_settings`
```
setting_id | location_id | product_id | min_stock_qty | max_stock_qty | target_stock_qty | is_critical_for_location | allow_over_max_due_to_packaging | notes
```

### `orders`
```
order_id | location_id | supplier_id | order_date | requested_delivery_date | status | captain_user | captain_submitted_at | manager_user | manager_sent_at | sent_method | supplier_order_reference | total_value_estimate_pln | notes
```

### `order_lines`
```
order_line_id | order_id | product_id | supplier_product_id | current_stock_qty_base | target_stock_qty_base | suggested_qty_base | suggested_qty_purchase | captain_final_qty_purchase | captain_final_qty_base | manager_final_qty_purchase | manager_final_qty_base | delta_vs_suggestion_pct | reason_code | captain_comment | manager_comment
```

### `_meta`
```
key | value
```
Pre-filled rows:
```
schema_version          | v1.0
sheet_created_at        | 2026-05-22
pilot_location          | WOLA
pilot_supplier          | <SUPPLIER_TBD>
owner_business          | Ben (CFO/CTO)
owner_operations        | <MANAGER_USER_TBD>
contact_for_data_issues | Ben
```

### `_reason_codes`
```
code | label_en | requires_comment
```
Pre-filled:
```
EVENT_HIGH_TRAFFIC       | Event / higher traffic expected            | false
WEEKEND_HIGH_TRAFFIC     | Weekend / high traffic                     | false
LOW_STORAGE              | Low storage space                          | false
PACKAGING_LIMITATION     | Packaging / order-unit limitation          | false
SUPPLIER_UNDERDELIVERS   | Supplier often underdelivers               | false
SYSTEM_SUGGESTION_WRONG  | System suggestion likely wrong             | false
OTHER                    | Other — comment required                   | true
```

## Sample data plan

Pre-seed `products`, `suppliers`, `locations`, `supplier_products` and
`location_product_settings` with the 20 v0 products at Wola once the
following are decided:

1. The v0 supplier (`<SUPPLIER_TBD>`).
2. The 20 product list with their `inventory_unit` and `purchase_unit`.
3. `units_per_purchase_unit` for each.
4. `min_stock` / `max_stock` / `target_stock` for each (Wola-specific).

`orders` and `order_lines` stay empty at seed time. The first Captain submit
during pilot writes the first rows.

## Access model

| Audience                | Permission | Notes                                          |
| ----------------------- | ---------- | ---------------------------------------------- |
| Ben (CFO/CTO)           | Editor     | Master data steward                            |
| Office Bro / Manager Bro| Editor     | Master data + Manager Dashboard role           |
| Wola Captain            | Editor     | Through Captain Submit screen (not raw Sheet)  |
| Claude / Codex agents   | Editor     | Via Google Sheets MCP / Drive MCP              |
| Other COO-CFO agents    | Viewer     | Read-only for reporting / cross-checks         |

## How agents read it

- **Claude (this repo):** via the Google Drive MCP already connected
  (`mcp__3e1b56c7-*`). Read with `read_file_content` or via Sheets-aware
  query tools when needed.
- **Captain Submit screen (Phase 1 build):** writes a new `orders` row +
  N `order_lines` rows on submit.
- **Manager Dashboard (Phase 1 build):** queries `orders` where `status =
  'captain_submitted' AND location_id = 'WOLA'`, joins with `order_lines`,
  `supplier_products`, `products`, `location_product_settings`.
- **Cross-agent visibility:** any other agent with Drive access can read
  the Sheet to enrich its own outputs (e.g., a daily COO brief can summarize
  yesterday's orders and overrides).

## Validation rules (enforced at the screen/dashboard layer, not at the Sheet layer)

- `product_id`, `supplier_id`, `location_id` must reference existing rows.
- `current_stock_qty_base >= 0`.
- `captain_final_qty_purchase >= 0`.
- `manager_final_qty_purchase >= 0`.
- `units_per_purchase_unit > 0` for any row used in a `supplier_products`
  reference.
- `reason_code` populated when `|delta_vs_suggestion_pct| > 20`, or when
  `manager_final_qty_base = 0` on a critical product, or when order exceeds
  `max_stock × 1.2`.

The Sheet itself is intentionally loose — validation is the screen's job.
This keeps the Sheet readable and editable by hand when we need to fix data
without booting the app.

## Provisioning steps (next slice)

1. Decide Drive folder location.
2. Create the Google Sheet with the 9 tabs and the headers above.
3. Pre-fill `_meta` and `_reason_codes`.
4. Hold `products`, `suppliers`, `locations`, `supplier_products`,
   `location_product_settings` for the data-input session with the Wola
   Captain (where we walk 20 products and capture real values together).
5. Share the Sheet with Manager / Office Bro / agents.
