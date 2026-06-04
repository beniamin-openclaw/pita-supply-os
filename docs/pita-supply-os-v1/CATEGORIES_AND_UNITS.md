# Categories and Units — Unification

This doc explains how we reconcile the two existing data sources:

1. **`Wolska - Inwentaryzacja - 17_05.csv`** — actual remanent data from Wola
   with real product names, suppliers, units, prices and counted quantities.
2. **`Categories_en.csv`** — the canonical category list from GoStock
   (despite the `_en` suffix, the names are kept in Polish to match GoStock UI).

The unified seed lives in [seed/](seed/).

---

## Categories

GoStock has **15 categories**. The Wola inventory uses **10**. One category
(`Gaz`) appears in the inventory but not in GoStock. Six GoStock categories
are POS/menu-only and never apply to inventory.

### Unified 16-category list

See [seed/_categories.csv](seed/_categories.csv).

| Category       | In GoStock | In Inventory | Used for inventory | Used for POS/menu | Notes |
|----------------|:---------:|:-----------:|:------------------:|:-----------------:|-------|
| Alkohol        | ✓         |             | ✓                  | ✓                 | Beer + spirits; separate from Wino |
| Biurowe        | ✓         | ✓           | ✓                  |                   | Office supplies |
| Chemia         | ✓         | ✓           | ✓                  |                   | Cleaning chemicals |
| Chłodnia       | ✓         | ✓           | ✓                  |                   | Refrigerated |
| Combo          | ✓         |             |                    | ✓                 | POS-only |
| Dania Główne   | ✓         |             |                    | ✓                 | POS-only |
| Dodatki        | ✓         |             |                    | ✓                 | POS-only |
| **Gaz**        |           | ✓           | ✓                  |                   | **New** — added to canonical list from inventory |
| Mrożonki       | ✓         | ✓           | ✓                  |                   | Frozen |
| Napoje         | ✓         | ✓           | ✓                  |                   | Beverages |
| Opakowania     | ✓         | ✓           | ✓                  |                   | Packaging |
| Połączenia     | ✓         |             |                    | ✓                 | POS-only |
| Produkcja      | ✓         | ✓           | ✓                  |                   | Internal sauces / preps |
| Snacks         | ✓         |             |                    | ✓                 | POS-only |
| Spożywcze      | ✓         | ✓           | ✓                  |                   | Dry goods |
| Wino           | ✓         | ✓           | ✓                  |                   | Wine |

**Inventory-relevant categories for Supply OS v0 (10):** Alkohol, Biurowe,
Chemia, Chłodnia, Gaz, Mrożonki, Napoje, Opakowania, Produkcja, Spożywcze, Wino.

**POS-only categories (5, ignored by Supply OS):** Combo, Dania Główne,
Dodatki, Połączenia, Snacks. These live in GoPOS, not in inventory.

Decision: we adopt the GoStock category list as the canonical reference and
add **Gaz** as a 16th category to cover Kamino's gas cylinders.

---

## Units

The inventory CSV uses these unit strings (mixed case and Polish):

`Kg`, `kg`, `Szt`, `szt.`, `Opak`, `Box`, `l`

We normalize to lowercase canonical units in the seed CSVs:

| Canonical | Meaning              | Used by                                     |
|-----------|----------------------|---------------------------------------------|
| `kg`      | Kilograms            | All Chłodnia + Spożywcze in weight + Produkcja |
| `szt`     | Pieces (units)       | Napoje + Wino + frozen blocks + cleaning bottles + most Spożywcze items |
| `opak`    | Packaging unit       | Bags, packs, boxes of disposables           |
| `box`     | Larger box           | Larger packaging like takeaway bag rolls    |
| `l`       | Liters               | Reserved for future use; not in current CSV |
| `karton`  | Carton (purchase)    | Purchase unit only; e.g., 1 karton Souvlaki = 5 kg |
| `wiadro`  | Bucket (purchase)    | Purchase unit only; e.g., 1 wiadro Tzatziki = 3 kg |
| `blok`    | Block (purchase)     | Purchase unit only; e.g., 1 blok Feta = 2 kg |
| `zgrzewka`| Shrink-wrap multipack| Purchase unit (future)                      |

### Inventory unit vs purchase unit

The inventory CSV blends these. The system needs both. Rule:

- **Inventory unit** (`products.inventory_unit`) = what you count in
  remanent and what min/max are expressed in. From the CSV's
  `Jedn. Miary` column.
- **Purchase unit** (`supplier_products.purchase_unit`) = what the supplier
  delivers in and what the order email/invoice says. May differ.

### Identifying purchase units from the CSV

For most products, `Cena` ≈ `Cena za jednostkę miary` → purchase unit = inventory unit
(1:1, `units_per_purchase_unit = 1`).

For products where they differ, the ratio reveals the conversion:

```
units_per_purchase_unit = Cena ÷ Cena za jednostkę miary
```

Examples from the Wola inventory:

| Product               | Cena       | Cena/jm   | Ratio | Inventory unit | Purchase unit | Units per purchase unit |
|-----------------------|-----------:|----------:|------:|----------------|---------------|------------------------:|
| Souvlaki Kurczak      | 145.00 zł  | 29.00 zł  |  5.00 | kg             | karton        | 5                       |
| Souvlaki Wieprz       | 157.00 zł  | 31.40 zł  |  5.00 | kg             | karton        | 5                       |
| Gyros 15 KG           | 378.00 zł  | 25.20 zł  | 15.00 | szt            | szt (=15 kg)  | 1 (but each szt = 15 kg)|
| Gyros 25 KG           | 627.48 zł  | 25.10 zł  | 25.00 | szt            | szt (=25 kg)  | 1 (each szt = 25 kg)    |
| Pita opakowania szt 10| 94.00 zł   | 7.83 zł   | 12.00 | opak           | opak (=12 szt)| 1 (each opak = 12 szt)  |
| Falafel               | 160.00 zł  | 32.00 zł  |  5.00 | kg             | karton        | 5                       |
| Tzatziki              | 40.00 zł   | 13.33 zł  |  3.00 | kg             | wiadro        | 3                       |
| Tirokafteri           | 60.00 zł   | 20.00 zł  |  3.00 | kg             | wiadro        | 3                       |
| Feta blok             | 95.00 zł   | 47.50 zł  |  2.00 | kg             | blok          | 2                       |
| Halloumi              | 7.73 zł    | 38.65 zł  |  0.20 | kg             | szt (200 g)   | 0.2                     |
| Oliwki kalamata       | 45.31 zł   | 22.66 zł  |  2.00 | kg             | opak          | 2                       |

The seed [seed/supplier_products.csv](seed/supplier_products.csv) captures these.

Halloumi is unusual — the CSV's pricing suggests pieces ~200 g each, not the
36-piece karton mentioned in the source spec example. **This needs Captain
verification before pilot starts.**

A handful of spice products (Pieprz, Papryka słodka, Ziele Angielskie,
Pieprz w saszetkach) have ratios that don't cleanly map to a single
package size — flagged as TBD in the seed for Captain validation.

---

## Suppliers — what came out of the CSV

10 distinct suppliers + 1 internal "production":

| Supplier              | SKU count | Categories                              | Ordering method (assumed) |
|-----------------------|----------:|-----------------------------------------|---------------------------|
| Blue Service          | 39        | Opakowania, Chemia                      | email                     |
| Bukat                 | 14        | Chłodnia (produce + Greek dairy)        | email (Mon/Wed/Fri)       |
| Coca Cola Hub         | 14        | Napoje, Alkohol                         | platform (manual in v0)   |
| Eurofood              | 6         | Wino, Napoje (Greek imports)            | email                     |
| Filber Wyspy Piwne    | 3         | Napoje (lemoniady)                      | email                     |
| Intermlecz            | 28        | Chłodnia, Mrożonki, Spożywcze           | email                     |
| Kamino                | 1         | Gaz                                     | phone                     |
| Kuchnie Świata        | 1         | Mrożonki (falafel)                      | email                     |
| **Pago**              | 18        | Mrożonki (souvlaki, gyros, pita), Opakowania (PB-branded), Biurowe | email |
| Pita Bros (internal)  | 9         | Produkcja                               | n/a (internal)            |

**v0 pilot supplier recommendation: Pago.** Reasoning:
- 18 SKUs is a clean v0 footprint.
- Core menu impact: souvlaki, gyros, pita.
- Weekly cadence (predictable for testing the loop).
- Assumed email-based ordering → Gmail-draft send works.
- Mixed unit complexity (kartons, szt, opak) gives the conversion logic real
  exercise.

Runner-up: **Bukat** — also strong (14 SKUs, daily cadence, simple kg/szt
units). Could be Phase 1b or a parallel pilot if Wola Captain commits.

Avoid for v0:
- **Coca Cola Hub** — platform-based, manual workaround needed.
- **Blue Service** — 39 SKUs, biweekly, low menu impact.
- **Intermlecz** — 28 SKUs too broad for v0; tackle in Phase 1b.

---

## Critical-product flagging

In [seed/products.csv](seed/products.csv), products marked `is_critical = TRUE`
trigger reason requirement when ordered = 0. v0 critical list (13):

- Pomidor, Tzatzyki, Feta blok, Halloumi, Cebula czerwona, Falafel,
  Frytki Aviko, Gyros 15 KG, Pita opakowania, Souvlaki Kurczak,
  Souvlaki Wieprz, Coca Cola, Coca Cola Zero.

These are the items whose stockout would block the Pita Bros menu from
operating. Captain or Manager can refine this list per location.

---

## What's still missing

Items that **cannot** be derived from the two CSVs and need to be captured
in person with the Wola Captain before pilot launch:

1. `min_stock_qty`, `max_stock_qty`, `target_stock_qty` per product per
   location (in inventory unit).
2. Supplier `email`, `delivery_days`, `cutoff_time`, `minimum_order_value_pln`.
3. Location `delivery_address`.
4. Verification of the inferred `units_per_purchase_unit` for products
   with non-trivial conversions (Halloumi, frytki, several spices).
5. Identifier convention for Captain / Manager users (email? short code?).

These flow into the next slice's data-input session.
