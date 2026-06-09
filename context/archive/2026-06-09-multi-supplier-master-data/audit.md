# F-02 — Multi-supplier master-data readiness: audit

- **Roadmap item:** F-02 `multi-supplier-master-data` (foundation; pairs with S-10, unlocks M-01 in-store demo)
- **PRD refs:** FR-012 (data correctness so suggestions hold), FR-013 (channel-aware dispatch needs per-supplier method + contact)
- **Type:** data-readiness pass — NOT a code change. No `/10x-plan` / `/10x-implement` of code; mirrors archived F-01.
- **Method:** audit → verify-with-owner → correct **live sheet** + mirror to **seed CSV** → re-validate suggestions/dispatch → close.
- **Hard constraints (this session):** data only, zero code changes; do NOT touch `app/main.py` / `app/*.py` (demo-backend session territory); do NOT start S-10; never commit secrets (`sa.json`/`.env`). Data lands in seed CSV + the live sheet; it migrates to Supabase when S-10 runs.

## Engine behavior (grounding for the findings)

`compute_suggestion` (`app/suggestion.py`), unchanged since F-01 except S-09 added `tenth_kg`:
- `suggested_qty_base = max(0, target − current)`; `raw_purchase = base / units_per_purchase_unit`.
- `full_only` rounding = `ceil(raw)` → always rounds UP to whole purchase units (a critical product is never under-ordered).
- `tenth_kg` (S-09, now on `main`) → rounds UP to the next 0.1 (kg). The correct rule for **loose weight goods** sold by the kg; replaces the rejected "model the unit as 100 g" data hack.
- `over_max` is **informational only** — never caps/reduces the suggestion. `allow_over_max_due_to_packaging = TRUE` suppresses the "(exceeds max by N)" warning for fixed-pack SKUs; quantity is identical either way.

## Current-state inventory (seed CSV, mirrors live sheet pre-F-02)

**The seed is NOT empty — it already carries all 10 suppliers, 134 products, ~127 supplier_products.** F-02 is a *verify-and-complete* pass (like F-01), not a from-scratch population. The gaps below are what's missing/unverified, not what's absent.

| Supplier | Channel | Contact (email/phone/portal) | delivery_days / cutoff | Orderable @ Wola today | Note |
|----------|---------|------------------------------|------------------------|------------------------|------|
| SUP_BUKAT | email | `biuro@bukat.com` ✓ | Mon–Sat / 16:00 ✓ | 14/14 ✓ | **Done in F-01** |
| SUP_PAGO | email | **TBD** | Tue / 14:00 | 6 of 18 (meat + przyprawa only) | v0 pilot; packaging/office SKUs have no Wola setting |
| SUP_INTERMLECZ | email | **TBD** | TBD / TBD | ~26/26 ✓ | dairy/olives/frozen/dry/spices — settings present |
| SUP_KUCHNIE | email | **TBD** | TBD / TBD | 1/1 ✓ (Falafel) | settings present |
| SUP_FILBER | email | **TBD** | TBD / TBD | 3/3 ✓ (lemoniady) | settings present |
| SUP_EUROFOOD | email | **TBD** | TBD / TBD | 0 of 6 | wines/Retsina/Mythos — no Wola settings |
| SUP_COCACOLA | portal | **TBD** (URL known: `cchbcshop.com`) | TBD / TBD | 0 of 14 | beverages — no Wola settings |
| SUP_BLUESERV | email | **TBD** | TBD / TBD | 0 of ~40 | packaging + chemia — no Wola settings |
| SUP_KAMINO | phone | **TBD** | TBD / TBD | 0 of 1 (gas) | no Wola setting |
| SUP_INTERNAL | manual | N/A | daily | 0 of 9 | on-site preps; not a real ordering supplier |

## Gap clusters

### G-A — Supplier contact / ops fields (the universal dispatch blocker)
Every external supplier **except Bukat** has `email`/phone/portal = **TBD**. This blocks dispatch regardless of orderability:
- Email channel: `manager_dispatch` returns 400 (`supplier has no email`) when `email` is empty → Pago, Intermlecz, Kuchnie, Filber, Eurofood, Blue Service all currently un-dispatchable by email.
- Phone channel (Kamino): the dispatch panel parses a `tel:` number from `supplier.notes` — needs the number put there.
- Portal channel (Coca Cola): no `order_portal_url` column on the `Supplier` model (schema change = out of data-only scope); URL goes in `notes` (the S-04 placeholder follow-up). Template already records `https://cchbcshop.com/websitePL/en/`.
- `delivery_days` + `cutoff_time` feed the manager-queue deadline (`_compute_next_cutoff`); only Bukat (full) + Pago (Tue/14:00) are set. Optional but nice for the queue.

> Schema note: the richer `supplier_base_template.csv` has `order_email / order_portal_url / contact_person / contact_phone` columns, but the **live `suppliers` schema + `Supplier` model carry only `email`** (+ method, days, cutoff, min_value, notes). Adding portal/phone columns is a code change → portal URL + phone go in `notes` for v0.

### G-B — `location_product_settings` @ Wola coverage (the big one)
Only **52 of 134** products have a Wola par-level row (min/target/max/critical). A product with no setting is **neither orderable** (`captain_orderable` filters to products with a setting; `captain_submit` 400s) **nor countable** (`captain_inventory_products` requires one). Missing settings, grouped by the supplier that would order them:

| Supplier | Products lacking a Wola setting | Count |
|----------|---------------------------------|-------|
| SUP_COCACOLA | P063–P071, P074, P078–P081 (beverages) | 14 |
| SUP_EUROFOOD | P059–P062 (Ionos wines), P072 Retsina, P073 Mythos | 6 |
| SUP_BLUESERV | P082–P088, P093–P126 (packaging + chemia) | ~40 |
| SUP_PAGO | P089–P092, P098 (PB packaging), P127–P133 (office) | 12 |
| SUP_KAMINO | P134 (gas cylinder) | 1 |
| SUP_INTERNAL | P029–P037 (on-site preps) | 9 |

Each new setting needs the owner's real par-levels (min / target / max) + a critical flag — this is the bulk of F-02's ground-truth ask, and it's why supplier scope must be decided first.

### G-C — `supplier_products`: prices + rounding rules
- **TBD prices** (affect `total_value_estimate` only, never the quantity): `P105` Płyn do zmywarek 5L, `P078` Lech Free, `P079` Tonic Water, `P060` Ionos Białe 2l, `P062` Ionos Czerwone 2l.
- **rounding_rule for loose-weight kg goods** (currently blank → `full_only` → ceils to whole kg). The S-09 generalisation ("all weight goods bought loose by the kg suggest at 0.1-kg granularity") was only applied to Bukat. Candidates among other suppliers' `kg` SKUs:
  - Pago `P019` Przyprawa do souvlakow (kg).
  - Intermlecz spices billed by the kg: `P050` Pieprz, `P051` Oregano, `P052` Papryka mielona, `P054` Liść Laurowy, `P055` Ziele Angielskie.
  - Likely NOT tenth_kg (fixed packs, leave `full_only`): `P049` Miód 1 kg, `P053` Sól 1kg (1-kg packs), `P056` Cukier (saszetki). Needs owner ground-truth which are loose vs packed.

### G-D — Fractional-unit SKUs flagged "verify with Captain"
`supplier_products` rows whose `units_per_purchase_unit` was set provisionally and carry a "verify" note — wrong `upp` distorts the suggestion's purchase-unit math:
- `P015` Halloumi `szt`, upp=0.2 (200 g block?); `P017` Florinis `opak`, upp=3.6; `P021` Frytki Aviko `opak`, upp=2.5; `P022` Frytki batat `opak`, upp=2.27.
- Plus location_product_settings "verify Wzór range" flags: `P015` Halloumi (24/72/72), `P026` Pita (1/5/5; 17_05 actual 52 opak), `P027` Souvlaki Kurczak (4/12/12; 17_05 actual 53 kg).

### G-E — New / changed SKUs
Are there products the store now orders that aren't among the current 134 (or SKUs to retire / mark `active = FALSE`)? Owner to confirm.

## Open questions for the owner

**Scope (gates everything):**
1. Which suppliers does this F-02 pass complete? (all 9 external / a channel-representative few / the kitchen-critical food set / a named subset)
2. How far to expand Wola `location_product_settings` — only the in-scope suppliers' products, the full 134-product catalog, or leave the non-food surface out of this pass?

**Data (per in-scope supplier — to turn into a paste-ready diff):**
3. Contact per channel: order **email** (email suppliers), confirmed **portal URL** (Coca Cola), **phone** number (Kamino). Plus `delivery_days` + `cutoff_time` where known.
4. For each newly-covered product: Wola **min / target / max** + **critical?** flag.
5. The 5 TBD prices (G-C) — real values, or leave blank?
6. Which other-supplier `kg` SKUs are **loose by weight** → `tenth_kg` vs fixed packs → `full_only` (G-C)?
7. Confirm the fractional `units_per_purchase_unit` for Halloumi / Florinis / Frytki ×2 (G-D).
8. Any new / retired SKUs (G-E)?

## Owner answers / decisions — round 1 (2026-06-09)

- **Q1 Supplier scope:** **all 9 external suppliers** (Pago, Intermlecz, Kuchnie, Filber, Eurofood, Coca Cola, Blue Service, Kamino; Bukat already done in F-01). SUP_INTERNAL is not an external ordering supplier.
- **Q2 Wola par-levels — explained + decided:** With Q1 = all external suppliers, option 1 ("in-scope suppliers' products") already covers **125 of 134** products (every product maps to exactly one supplier; no orphans). The only delta vs option 2 ("full catalog") is the **9 internal-production preps P029–P037** (Spicy Mayo, 2× Musztarda, Ketchup, Ladolimono, Ogórek+papryka, Masło czosnkowe, Kasza Pęczak, internal Gyros) — made on-site, never ordered. Adding their settings only makes them appear on the one-pass inventory-count screen (countable); it never makes them orderable (SUP_INTERNAL = manual channel; no Captain orders from it). **Decision: option 2 (full 134 catalog)** — the in-store demo (M-01) includes the whole-location inventory count (S-06 / US-02), which is only complete if on-site preps are countable too; the marginal cost is 9 rows on top of the ~73 external rows already required, and internal par-levels double as on-hand production-replenishment levels. Internal preps stay non-ordered.
- **Net target:** every active product (P001–P134) has a Wola `location_product_settings` row; every external supplier has complete contact/ops fields + verified `supplier_products`.

### Par-level sourcing (open — gates G-B, the bulk of F-02)
~82 products currently lack a Wola par-level. F-01 derived Bukat levels from a "Wzór" reference (hence the "verify Wzór range / 17_05 actual" notes). **Open:** is there an existing par-level source — a Wzór sheet / GoStock export / stock spreadsheet — to derive min/target/max from, or does the owner provide them per product? This decides whether G-B is "derive + confirm" or "owner dictates ~82 rows."

## Round 2 — reconciliation vs Wolska inventory DRUK (2026-06-09)

Source: owner-supplied `Wolska - Inwentaryzacja - Spożywcze & napoje - DRUK.csv` — a **blank physical count form** for the Wolska location, listing every Spożywcze & napoje SKU with its **Dostawca (supplier)**, inventory **category**, and **Jedn. Miary (count unit)**. Quantities are blank (it's a print form). **Page 1/2** — covers Chłodnia, Spożywcze, Mrożonki, Produkcja, Wino, Napoje. Does NOT cover Opakowania / Chemia / Biurowe / Gaz (Blue Service, Pago packaging, Kamino) → those need the other DRUK page.

**Overall: strong match.** All 59 food/drink SKUs on the DRUK map to an existing backend product; categories align with `products.product_category`. Discrepancies below.

### R2-A — Supplier attribution mismatches (backend vs DRUK) — NEEDS OWNER DECISION
The DRUK's supplier column disagrees with the seed on 5 SKUs. These change which supplier's order screen shows the item and where dispatch routes — do not flip without confirmation (3 of them were owner-verified as Bukat in F-01 just 4 days ago).

| Product | Seed supplier | DRUK supplier | My read |
|---------|---------------|---------------|---------|
| P011 Tzatzyki | **Bukat** (SP_BUKAT_P011) | **Pago** | F-01 owner-confirmed Bukat (2026-06-05). Did dips move to Pago, or dual-source? |
| P012 Tirokafteri | **Bukat** (SP_BUKAT_P012) | **Pago** | same as Tzatzyki |
| P014 Feta blok | **Bukat** (SP_BUKAT_P014) | **Pago** | same; both Bukat + Pago are Greek-import suppliers, so plausible either way |
| P072 Retsina 500 ml | **Eurofood** (SP_EUROFOOD_P072) | **Coca Cola Hub** | Eurofood = "Greek wine + retsina" → seed looks right; DRUK likely mis-grouped |
| P074 Corona | **Coca Cola Hub** (SP_COCACOLA_P074) | **Eurofood** | Corona via Coca Cola Hub → seed looks right. **Retsina+Corona appear swapped on the DRUK** |

### R2-B — New SKUs on the DRUK, absent from backend — NEEDS DETAILS TO ADD
| DRUK item | DRUK supplier | Note |
|-----------|---------------|------|
| Kinley | Coca Cola Hub | Almost certainly the existing **P079 "Tonic Water"** (Kinley = Coca-Cola's tonic brand). Likely a **rename**, not a new SKU. Confirm. |
| Promo Beer 0,33l | Filber Wyspy Piwne | New. Needs product_id, category (Napoje/Alkohol?), price, unit (szt). |
| Promo Beer 0,5l | Coca Cola Hub | New. Different supplier than the 0,33l. Needs same details. |

### R2-C — Backend SKUs absent from this DRUK page — CONFIRM STATUS
| Product | Note |
|---------|------|
| P078 Lech Free (Coca Cola) | Not on the DRUK. Discontinued at Wola, or just off this count? Mark `active = FALSE`? |
| P079 Tonic Water (Coca Cola) | Not present by that name — but "Kinley" is (see R2-B). Rename P079 → Kinley? |

(Lemoniady P075–077 ARE on the DRUK ✓. All other backend food/drink SKUs accounted for.)

### R2-D — Inventory-unit mismatches (`products.inventory_unit` vs DRUK "Jedn. Miary") — NEEDS AUTHORITATIVE UNIT
The unit the Captain counts in must match `inventory_unit` or the suggestion math + par-levels are off (the PRD's "unit pain"). 10 SKUs differ:

| Product | Backend inventory_unit | DRUK count unit |
|---------|------------------------|-----------------|
| P021 Frytki Aviko | kg | **Szt** (packages) |
| P022 Frytki z batatów | kg | **Szt** |
| P023 Fasolka Szparagowa | kg | **Szt** |
| P024 Gyros 15 KG | kg | **Szt** (blocks) |
| P025 Gyros 25 KG | kg | **Szt** |
| P042 Ketchup Fanex VII 1,1 kg | szt | **Kg** |
| P043 DEVELEY MUSZTARDA 3 kg | szt | **Kg** |
| P044 FANEX MAJONEZ 4kg | szt | **Kg** |
| P047 Kasza Pęczak Melvit 900g | szt | **Kg** |
| P048 Sriracha chili 730 ml | szt | **Kg** |

These cut both ways (frozen: backend kg vs count szt; bottles/bags: backend szt vs count kg), so neither source is uniformly right — owner picks the authoritative count unit per item. Note: changing `inventory_unit` ripples into the matching `location_product_settings` (min/target/max are in that unit) and the `supplier_products` purchase math.

### R2-E — Confirmed: Produkcja = count-but-don't-order (validates Q2 option 2)
The DRUK's **Produkcja** section lists all 9 internal preps (P029–P037, "Pita Bros") as counted inventory, with the owner's note "we make it in-house from ordered products." This confirms the round-1 decision: internal preps need a Wola `location_product_settings` row to be **countable**, while staying **non-ordered** (SUP_INTERNAL = manual).

### Still open after R2 (the DRUK doesn't carry these)
The DRUK is a blank form, so it does NOT provide: par-levels (min/target/max), supplier contacts, or prices. Round-1 asks #1 (par-level source), #2 (contacts), #3 (prices) remain open. Plus the **page-2 / Opakowania-Chemia DRUK** is needed for Blue Service, Pago packaging, and Kamino.

### R2 resolutions (owner, 2026-06-09)

- **R2-A — all 5 supplier mismatches resolved IN FAVOUR OF THE BACKEND (no change):** owner confirms Tzatzyki / Tirokafteri / Feta = **Bukat**, Retsina = **Eurofood**, Corona = **Coca Cola Hub** — exactly what the seed already records. The DRUK's supplier column was loose for these 5; `supplier_products` stays as-is. ✅ No diff.
- **R2-D — unit mismatches folded into par-level collection:** `inventory_unit` must equal the unit the staff actually count in. Rather than decide the 10 in isolation, they resolve together with par-levels — when the owner states each product's min/target/max, they state it in their counting unit, which fixes `inventory_unit` (+ the matching `units_per_purchase_unit`) at the same time. Tracked, not yet applied.
- **Still open (round-1 + R2-B/C):** new SKUs (Kinley rename? Promo Beer ×2), Lech Free status, par-level source, supplier contacts, 5 TBD prices, and the page-2 Opakowania/Chemia/Gaz DRUK.

## Round 3 — owner resolutions + deliverables (2026-06-09)

- **R2-B Kinley:** owner confirms "same drink" → **rename P079 `product_name_pl` "Tonic Water" → "Kinley"** (locked; apply in batch).
- **R2-B Promo Beers:** both are category **Alkohol** (owner). Two NEW SKUs to add — `P135` Promo Beer 0,33l (supplier Filber), `P136` Promo Beer 0,5l (supplier Coca Cola Hub). **Pending price + final product name** (owner sending later) → not added yet. Note: existing beers (Corona/Mythos/Corona 0%) sit under category `Napoje`; using `Alkohol` per owner's explicit call — minor existing-data inconsistency, flagged, not auto-changed.
- **R2-C Lech Free (P078):** = the non-alcoholic beer; owner unsure if currently stocked → **keep on sheet, stays active** (no change).
- **R2-D unit mismatches → GoStock:** owner wants units aligned with **GoStock** too. Out of this session's scope (no GoStock access) → **spun off as a separate task** ("Align inventory units with GoStock"). The 10 mismatches resolve there + when par-levels arrive (stated in the counting unit).
- **Deliverable — par-level gaps report:** generated `par-level-gaps.md` + fillable `par-level-gaps.csv` (134 products: **52 have / 82 missing**; missing = Blue Service 40, Coca Cola 14, Pago 12, internal 9, Eurofood 6, Kamino 1).
- **Deliverable — Sławek email:** Polish Gmail **draft created** asking whether the min/target/max for the 82 products exist anywhere (GoStock / sheet). Recipient set to a placeholder (owner's own address) — owner sets Sławek + may attach `par-level-gaps.csv`.
- **Contacts (round-1 #5):** owner will provide supplier emails later — not blocking now.
- **Page-2 (Opakowania/Chemia/Gaz) DRUK:** owner doesn't have it handy → reconcile those suppliers (Blue Service, Pago packaging, Kamino) from the existing seed instead. Their supplier_products already exist; they need contacts + par-levels only.

## Locked diff (running — apply to seed CSV + live sheet in one verified batch)

Accumulating confirmed edits; applied together at the end (mirrors F-01's single verified pass). Nothing applied yet.

| Target | Field | Old → New | Status |
|--------|-------|-----------|--------|
| products / P079 | product_name_pl | `Tonic Water → Kinley` | locked |
| products / P135 (new) | row | Promo Beer 0,33l · Alkohol · szt · supplier Filber | pending price/name |
| products / P136 (new) | row | Promo Beer 0,5l · Alkohol · szt · supplier Coca Cola Hub | pending price/name |
| location_product_settings / WOLA (×82) | min/target/max | per `par-level-gaps.csv` | pending owner/Sławek |
| suppliers (×8 external) | email / phone / portal-in-notes / days / cutoff | per round-1 #5 | pending owner |
| supplier_products | price_estimate_pln (×5 TBD) + rounding_rule (loose-kg → tenth_kg) | per round-1 #5/#6 | pending owner |

<!-- Execution log appended below once the batch is applied (mirrors F-01). -->
