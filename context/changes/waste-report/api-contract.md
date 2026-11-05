# Waste report integration contract

JSON quantities and totals are ordinary decimal strings. IDs are strings, timestamps ISO UTC, business dates `YYYY-MM-DD` in Europe/Warsaw. Requests forbid extra fields. All Captain locations derive only from the token. Shared location tokens do not identify an employee.

## Catalog

`GET /api/captain/waste/catalog` returns `{items: WasteCatalogItem[], max_quantity: "999999.999"}`.

`WasteCatalogItem`: `product_id`, `name_pl`, `name_en`, `section` (`fridge|freezer|dry`), canonical `unit` (`kg|szt`), `display_unit` (`g|szt`), `quick_additions: string[]`, `calibration` (`supported|provisional`). Seventeen fixed paper identities plus explicit Other handled by the form; no purchasing-product mapping. Read `calibrated-catalog.json` for metadata when available. Every tile adds, repeated and mixed clicks allowed. Sparse evidence is provisional.

## Save

`POST /api/captain/waste/reports` body:

```json
{"batch_uuid":"UUID","business_date":"2026-11-04","lines":[{"product_id":"tomato","description":null,"quantity":"100","unit":"g","reason":"dropped","reason_detail":null}]}
```

`product_id: string|null`; null requires nonblank Other `description` (max120) and kg/szt unit. Known catalog product description is null/absent. `quantity: string`, strictly positive, <=3dp kg/szt or integer g, canonical <=999999.999. `reason` is `burned|dropped|expired|spoiled|other`; other requires nonblank `reason_detail` (max500). Batch has 1..100 lines. `batch_uuid` valid UUID; business date cannot be future. Returns `WasteReport` on first save or identical-key retry; changed payload under existing key gives409.

`WasteReport`: `report_id`, `location_id`, `business_date`, `batch_uuid`, `created_at`, `lines: WasteReportLine[]`.

`WasteReportLine`: `line_id`, `product_id: string|null`, `description: string|null`, snapshot `name_pl`, `name_en`, canonical `quantity`, `unit`, `submitted_quantity`, `submitted_unit`, `reason`, `reason_detail: string|null`, `voided_at: string|null`, `void_reason: string|null`, `void_role: captain|manager|null`.

## Read and correction

Captain routes: list `/api/captain/waste/reports`; detail `/{report_id}`; by-batch `/by-batch/{batch_uuid}`; void `/{report_id}/lines/{line_id}/void` POST `{reason: string}` (nonblank max500). Manager: list/detail/void under `/api/manager/waste/reports`, optional location filter. Repeated void preserves original metadata. Missing and foreign records share404.

List query: `date_from`, `date_to` (inclusive, defaulttoday, <=366days), `cursor` optional, `limit` default50 max100; manager optional `location_id`. Return `{reports: WasteReport[], totals: WasteTotal[], next_cursor: string|null}`. Totals cover the entire filtered period, exclude void lines, and never combine locations/units/Other descriptions. `WasteTotal`: `location_id`, `product_id`, `description`, `name_pl`, `name_en`, `quantity`, `unit`. Cursor uses immutable `(created_at, report_id)`; reverse chronological order.

Manager CSV: `GET /api/manager/waste/export` same date/location filters, full period with original and void metadata; authenticated `apiGetBlob` client.

## Errors and retry

Feature business errors return `detail: {code: "waste_unavailable|waste_conflict|waste_not_found|waste_invalid_date|waste_invalid_cursor|waste_storage_error", write_outcome: "rejected|unknown"}`. Only failures proven before writing use rejected; outages/internal failures unknown. FastAPI422 validation is definitive prewrite. Local scope mismatch makes no request. UI maps codes and waste422 to i18n, including empty lines (not order-empty copy). Capture request token and compare with draft token immediately before request, never send a previous scope's data using a new scope's token.

Uncertain save freezes original body+UUID, supports by-batch readback and identical retry. A racing404 never unlocks edits/newUUID; definitive422/capability rejection permits correction with a freshUUID. Preserve draft on every failure. This is local lifecycle state, no extra server job.
