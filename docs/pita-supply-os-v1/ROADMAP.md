# Roadmap — Pita Bros Supply OS v1 → Full Supply OS

Nothing from the source spec is removed. Every item is either **Phase 1
(now)** or postponed to a later phase. This roadmap is the contract that
keeps v0 small without losing the full vision.

## Phase 1 — Wola pilot (now)

**Goal:** prove the Captain-submit → Manager-dispatch loop reduces Manager
send-time by 70% at Wola.

- Master data: `products`, `suppliers`, `locations`, `supplier_products`,
  `location_product_settings` (5 tables, 20 products, 1 supplier, 1 location).
- Captain Submit screen — entered current stock + suggestion + final qty +
  reason (when deviation > threshold).
- Manager Dashboard — queue of submitted orders, line-level review,
  one-click send via Gmail draft.
- Order audit: `orders` + `order_lines` capture suggestion / captain_final /
  manager_final / reason / actor / timestamp.
- 4-state status model: `draft → captain_submitted → manager_sent → closed`.
- Google Sheets backbone.
- Success metric: Manager time-to-send < 10 min, 0 stockouts on v0 products.

## Phase 2 — Receiving + WZ + multi-supplier (after Wola proves v0)

**Goal:** close the delivery side of the loop and prove the dashboard at 3+
suppliers.

- `receipts` + `receipt_lines` tables.
- Captain Receive screen: what arrived per line, in purchase unit + base unit.
- Required WZ photo per receipt; if missing → `received_with_missing_wz`
  status flag.
- Discrepancy capture: short delivery / overdelivery / damaged / substitute.
- `discrepancies` table; first owner = Captain, escalates to Office after 24h.
- Multi-supplier in Manager Dashboard — group by supplier, parallel orders,
  per-supplier dispatch methods (email, portal-paste, CSV).
- "Final accept" action — Captain or Manager locks the receipt; locked
  receipts become candidates for export.
- New status states: `received_by_point`, `receiving_exception`,
  `final_accept_pending`, `final_accepted`.

## Phase 3 — Remanent + GoStock export

**Goal:** standardize full inventory counts and stop manual GoStock retyping.

- `inventory_counts` + `inventory_count_lines` tables.
- Full Remanent screen — point counts in inventory unit only, validation
  against previous count and against GoStock state.
- Critical-product small remanent screen (subset; shorter cycle).
- Remanent → GoStock CSV export.
- Final-accepted-receipt → GoStock CSV export.
- `export_runs` table.
- `audit_log` dedicated immutable table (Phase 1 audit is inferable from
  `order_lines` only).
- Validation rules: missing value, negative value, value far from previous
  count, zero on critical product.
- Multi-location rollout (add 3–4 points beyond Wola).

## Phase 4 — Forecasting, finance, KSeF

**Goal:** turn the data asset into automation and finance-readiness.

- **Forecasting (suggestion engine v2+):** same-weekday averages, recent
  4–8 record blends, supplier delivery rhythm, supplier minimum order value,
  product criticality, storage constraints, eventually event/weather/seasonal
  signals.
- **Captain vs suggestion analysis dashboard:** which products are
  consistently overridden, which Captains drive the most deviation,
  which reasons dominate per product.
- **Supplier quality dashboard:** ordered vs received history, short-delivery
  rate, missing-WZ rate, unresolved discrepancies.
- **Operations dashboard:** orders by status, deliveries expected today,
  missing WZ count, exports pending.
- **Remanent dashboard:** completion per point, last-count age, delta vs
  GoStock.
- **Finance pipeline:**
  - WZ vs invoice match.
  - KSeF invoice ingest.
  - Expected price vs actual price variance per supplier × product.
  - Payment / accounting status tracking.
  - `finance_export` runs.
- **Live GoStock API integration** (replacing CSVs).
- **Exception-review queue** for management on high-risk orders.

## Per-spec-item mapping

This table maps every item from the source spec to its phase. Use it to
defend against scope creep ("which phase owns this?").

| Source spec item                              | Phase | Notes                                       |
| --------------------------------------------- | ----- | ------------------------------------------- |
| Master data — products, suppliers, locations  | 1     | 5 tables only in v0                         |
| `product_unit_conversions`                    | 1     | Collapsed into `supplier_products` for v0   |
| `location_product_settings`                   | 1     | Min/max/target in inventory unit            |
| `inventory_counts` / `inventory_count_lines`  | 3     | Replaced by current-stock-on-submit in v0   |
| Remanent validation rules                     | 3     |                                             |
| Remanent → GoStock export                     | 3     |                                             |
| Stock & usage context (averages, last orders) | 4     | v0 uses target − current only               |
| Purchase guidance engine (simple)             | 1     | target − current, with rounding             |
| Purchase guidance engine (averaging)          | 4     |                                             |
| Captain review screen                         | 1     | This is the Captain Submit screen           |
| `suggested_qty` vs `captain_final_qty` audit  | 1     | Core v0 asset                               |
| Reason capture                                | 1     | 7 reason codes                              |
| Exception review (management)                 | 1*    | Becomes Manager Dashboard review (different from spec exception queue) |
| Exception-review queue (spec's version)       | 4     | Separate queue for high-risk orders         |
| Supplier order generation                     | 1     | Gmail draft per (location, supplier)        |
| Email draft vs auto-send                      | 1     | Draft only in v0; auto-send postponed       |
| Supplier minimum order warning                | 2     |                                             |
| Expected delivery view                        | 2     |                                             |
| Delivery receiving                            | 2     |                                             |
| Required WZ photo                             | 2     |                                             |
| Discrepancy handling                          | 2     |                                             |
| Final accept                                  | 2     |                                             |
| Adjustment records after final accept         | 2     |                                             |
| Export — remanent to GoStock                  | 3     |                                             |
| Export — receipt to GoStock                   | 3     |                                             |
| Export — finance pipeline                     | 4     |                                             |
| GoStock live API                              | 4     | CSV until then                              |
| Operations dashboard                          | 4     | Manager Dashboard is its v0 ancestor        |
| Remanent dashboard                            | 4     |                                             |
| AI/System vs Captain dashboard                | 4     |                                             |
| Supplier quality dashboard                    | 4     |                                             |
| Product risk dashboard                        | 4     |                                             |
| Export dashboard                              | 4     |                                             |
| KSeF integration                              | 4     |                                             |
| Invoice matching                              | 4     |                                             |
| Supplier price variance                       | 4     |                                             |
| `audit_log` table                             | 2     | v0 audit is via `order_lines` columns       |
| `export_runs` table                           | 3     |                                             |
| Roles: Captain                                | 1     |                                             |
| Roles: Manager Bro / Office Bro               | 1     | Combined into "Manager" for v0 dispatch     |
| Roles: Point Operator / Leader / Bro          | 2     | Used at receiving                           |
| Roles: Owner / Georgios / Beniamin            | 2     | View-only dashboards                        |
| Roles: Finance                                | 4     |                                             |
| Status: `draft → submitted → approved → sent` | 1     | 4-state v0 model                            |
| Status: receiving / final-accept states       | 2     |                                             |
| Status: inventory_count states                | 3     |                                             |
| Status: export states                         | 3     |                                             |
| Status: discrepancy states                    | 2     |                                             |
| Unit conversion engine                        | 1     | One factor per `supplier_products` row      |
| Rounding rules per product                    | 1     | 3 rules: full / half / up-for-critical      |
| Storage capacity warnings                     | 2     | Beyond simple `allow_over_max` flag         |
| Event / weekend / weather signals             | 4     |                                             |
| Coca-Cola / platform-only suppliers           | 2     | Manual entries in dashboard, no auto-draft  |
| Frozen business decisions (spec §27)          | All   | Carried forward unchanged                   |

*Phase 1 has a Manager Dashboard that reviews every order before send. That
is not the same as the source spec's "exception-review queue," which is a
sample-based review of high-risk orders only. Both exist in the long-term
vision; in v0 every order is reviewed because volume is small.

## When does a phase start?

Each phase starts when the previous phase has:
1. Run for at least 4 ordering cycles at Wola without breakage.
2. Hit its success metrics.
3. Had a written retrospective documenting what to change.

Phase boundaries are not calendar-driven. They are quality-driven.
