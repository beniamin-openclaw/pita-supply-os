# Min / Max / Target Stock — Analysis

**Source:** `Wolska - Inwentaryzacja - Inwentaryzacja - Wzór (1).csv` (the
Wola inventory template with `Minimalna ilość` and `Maksymalna ilość`
columns populated).

**Seed file produced:** [seed/location_product_settings.csv](seed/location_product_settings.csv).

---

## Coverage

| Group                          | Products | Min/max populated | %    |
|--------------------------------|---------:|------------------:|-----:|
| Chłodnia (fresh + dairy)       |   18     |    18             | 100% |
| Mrożonki (frozen)              |    9     |     9             | 100% |
| Spożywcze (dry goods)          |   21     |    21             | 100% |
| Napoje (beverages — lemoniady) |   15     |     3             |  20% |
| Wino                           |    4     |     0             |   0% |
| Produkcja (internal)           |    9     |     0             |   0% |
| Opakowania                     |   22     |     0             |   0% |
| Chemia                         |   23     |     0             |   0% |
| Biurowe                        |    7     |     0             |   0% |
| Gaz                            |    1     |     0             |   0% |
| **Total**                      | **134**  |   **51**          | **38%** |

**38% of products** have stock thresholds defined at Wola. Coverage is
strong for food (`Chłodnia`, `Mrożonki`, `Spożywcze`) and Filber lemoniady;
zero for `Wino`, `Produkcja`, `Opakowania`, `Chemia`, `Biurowe`, `Gaz`.

For v0 pilot focus (Pago supplier, food items): **all 6 Pago food SKUs have
min/max set.** Good.

---

## Anomalies vs the 17_05 remanent

The Wzór min/max appear to encode "target operating levels" but the actual
17_05 remanent counts at Wola diverge significantly for several core SKUs.
These need Captain conversation before pilot launch.

| Product               | Wzór min | Wzór max | 17_05 actual | Status              |
|-----------------------|---------:|---------:|-------------:|---------------------|
| **Souvlaki Kurczak**  | 4 kg     | 12 kg    | **53.16 kg** | 4.4× over max       |
| **Souvlaki Wieprz**   | 2 kg     | 4 kg     | **24.83 kg** | 6.2× over max       |
| **Pita opak szt 10**  | 1 opak   | 5 opak   | **52 opak**  | 10.4× over max      |
| **Tzatzyki**          | 9 kg     | 30 kg    | 42 kg        | 1.4× over max       |
| Pomidor               | 12 kg    | 42 kg    | 42 kg        | at max ✓            |
| Tirokafteri           | 3 kg     | 6 kg     | 6 kg         | at max ✓            |
| Halloumi              | 24 kg    | 72 kg    | 9.83 kg      | **41% of min — understock** |
| Feta blok             | 1 kg     | 3 kg     | 2 kg         | within range ✓      |
| Falafel               | 5 kg     | 15 kg    | 14.31 kg     | within range ✓      |
| Frytki Aviko          | 20 szt   | 44 szt   | 30 szt       | within range ✓      |
| Gyros 15 KG           | 2 szt    | 10 szt   | 7 szt        | within range ✓      |

### Interpretation

Two hypotheses:

1. **Wzór is from an earlier, smaller-volume version of Wola.** The
   business has grown; current operating levels exceed Wzór assumptions.
   Action: update Wzór to current reality with Captain.
2. **The 17_05 remanent caught an event-driven overstock.** A delivery
   landed shortly before count, or Wola was preparing for an event.
   Action: verify with Captain and reconcile.

Either way, the system catches this divergence on day one — exactly the
audit value v0 was designed to surface.

### Halloumi is the inverse problem

Wzór says min 24 kg / max 72 kg. Actual 17_05: 9.83 kg. **Understock by
60%.** Either:
- The Wzór levels are over-aspirational and Wola operates well below them
  in practice, or
- Wola was in a real stockout state on 17_05.

Captain conversation required.

---

## Packaging-driven overage flag

For products where `1 purchase unit > max_stock_qty_base`, the system has
to allow overage by design — otherwise no order is ever feasible.

| Product           | Max  | 1 purchase unit | Overage    | `allow_over_max_due_to_packaging` |
|-------------------|-----:|----------------:|-----------:|----------------------------------:|
| Souvlaki Wieprz   | 4 kg | 5 kg (1 karton) | +1 kg      | **TRUE**                          |
| Souvlaki Kurczak  | 12 kg| 5 kg (1 karton) | none (2.4 fit) | FALSE                         |
| Falafel           | 15 kg| 5 kg (1 karton) | none (3 fit) | FALSE                          |
| Pita opak szt 10  | 5 opak | 1 opak        | none       | FALSE                             |
| Gyros 15 KG       | 10 szt | 1 szt (=15 kg)| none       | FALSE                             |

Only Souvlaki Wieprz needs the flag.

---

## Target stock policy (v0 simplification)

The Wzór CSV does not have a `target_stock_qty` column. The seed file
defaults **target = max** for every row, which means suggestions replenish
all the way to max on each order.

Alternative policies the system can support later:
- `target = (min + max) / 2` — safer, less aggressive replenishment, leaves
  variance room.
- `target = max - safety_buffer` — leaves headroom for receiving overage.

Recommend: v0 = target=max, monitor for over-ordering, adjust per product
after 4 cycles based on observed behavior.

---

## Categories with no thresholds — what now?

**Opakowania, Chemia, Biurowe, Gaz, Wino, Produkcja, most Napoje** have
no min/max in the Wzór. Possible reasons:

- **Opakowania, Chemia, Biurowe, Gaz, Wino**: ordered reactively (when
  visibly low) rather than against thresholds. Common pattern for slow-
  moving / long-shelf-life supplies.
- **Produkcja**: internally made, no purchase ordering. Tracked for
  inventory presence only.
- **Most Napoje (Coca Cola Hub)**: ordering happens through Coca Cola's
  platform separately, manual workflow.

**v0 implication:** these products are read-only in the system for now
(can appear in remanent counts, no order suggestion). They join the
Captain Submit screen in Phase 2 once their suppliers are integrated.

---

## Open questions for Wola Captain

1. Are the Wzór min/max levels still your target operating levels, or have
   they grown? (Especially Souvlaki Kurczak/Wieprz and Pita opak.)
2. Was the 17_05 overstock on meat a one-time event prep, or routine?
3. For Halloumi: is 9.83 kg a real stockout, or do you operate consistently
   below the Wzór 24 kg minimum?
4. For Souvlaki Wieprz: is 4 kg max accurate? If yes, the system will warn
   on every order because 1 karton = 5 kg.
5. For Oregano: the Wzór `max` column was empty — we defaulted to 1.5 kg
   matching other spices. Correct?
6. For Opakowania / Chemia / Biurowe — would you want min/max thresholds
   added in Phase 2, or keep them reactive?
