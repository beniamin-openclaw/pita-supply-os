---
change_id: multi-supplier-master-data
title: Verify & complete master data for suppliers beyond Bukat (Pago + the rest)
status: archived
created: 2026-06-09
updated: 2026-06-09
archived_at: 2026-06-09T14:04:15Z
---

## Notes

Verify & complete master data for suppliers beyond Bukat (Pago + the rest used in the store): supplier contact/ops fields (email/portal/phone, delivery_days, cutoff_time), supplier_products (units_per_purchase_unit, rounding_rule incl. tenth_kg, price_estimate), Wola location_product_settings (min/target/max, critical), and any new SKUs — so the suggestion engine holds per SKU and channel-aware dispatch (FR-013) routes correctly for the full supplier set. DATA-ONLY, no code changes; mirrors archived F-01 (bukat-master-data-ready). Roadmap: Horizon 2, F-02. Refs: FR-012, FR-013.
