# Pago catalogue cleanup — ops log

**Applied to prod 2026-09-03.** Operator: "Pago nie sprzedaje tych rzeczy —
popraw dane."

## What was wrong

Master data mapped 24 products to `SUP_PAGO`. The operator's actual Pago
catalogue is eight positions. The other sixteen were office supplies, PB-branded
packaging and chilled dips that Pago does not sell — and because the Pago
self-pickup document is the only Pago-facing order document, that mis-mapping is
what made the document look wrong in the first place.

## A code bug sat underneath the data bug

`_build_orderable_items` filtered on supplier + location setting but ignored
BOTH `supplier_products.active` and `products.active`. So retiring a catalogue
row had no effect on what a Captain could order.

Not theoretical: someone had already deactivated Feta blok, Tirokafteri and
Tzatzyki on `SUP_PAGO` (they are Bukat's goods) and all three were still being
ordered from Pago — 7 order lines each inside 60 days.

Checked before changing anything: across every `active = false` row under an
active supplier, exactly those three had ever appeared on an order. The other
~30 had zero lines, so honouring the flag hides them with no loss. Fixed in
`99018b7` with four regression tests.

**The code fix and this data change must ship together.** Without the code fix,
deactivating a row changes nothing on screen.

## The third source: Mory

The decisive fact came from the operator, not the data. There are **two**
self-pickup sources, not one:

| source | what | how |
|---|---|---|
| Pago / Lineage | frozen meat, pita, bifteki | driver collects |
| **Magazyn własny Mory** | PB-branded packaging, souvlaki spice | own driver collects |

Mory did not exist in the system. `SUP_INTERNAL` is a different thing — on-site
preps (sauces, cooked barley), everything in category `Produkcja`.

## Applied

Created `SUP_MORY` "Magazyn własny Mory", `ordering_method = manual`, active —
an internal source, not a vendor.

Re-pointed seven products from Pago to Mory (new `SP_MORY_*` rows carrying the
same units and prices; the Pago rows set `active = false`):

Boxy PB · Papier do Pita (PB) · Serwetki PB · Tacki bez logo · Papier termiczny
aluminiowy · Skepasti box PB · Przyprawa do souvlakow

`Skepasti box PB` comes back ACTIVE — it had only been retired because it sat
under the wrong supplier.

**Nothing was deleted.** `order_lines` has an FK to `supplier_products` and 107
historical lines point at the retired rows; history stays readable and a row
returns the moment it is re-activated.

## Result

`SUP_PAGO` active rows: 24 → 14. Of those, six are the real catalogue
(PAGO-001…006, all `warehouse_pickup = true`) and eight are office supplies still
awaiting their supplier.

Every re-pointed product verified still orderable, now via Mory.

## Open

- **Eight `Biurowe` items** — rolki do kasy ×4, koperty, markery, długopisy,
  zszywki — still sit under Pago. The operator will name their supplier. No
  supplier in the system carries category `Biurowe` at all today, so they cannot
  simply be re-pointed.
- **PAGO-007 (CIASTO FILLO KANAKI 20X450G) and PAGO-008 (ARMENONVILLE)** do not
  exist as products. The pickup document is two lines short until they are created.
- `warehouse_pickup` is deliberately left `false` on the Mory rows: the column is
  consumed only by the Pago pickup document, and the audit assertion "nothing
  flagged outside SUP_PAGO" stays meaningful. If Mory ever gets its own pickup
  document, revisit.
