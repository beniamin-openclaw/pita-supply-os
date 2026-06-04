# Wola Captain Briefing — Supply OS v0 Pilot

**Audience:** the Wola Captain (and anyone in management/office co-attending
the session).
**Format:** ~30-minute working session, ideally at the Wola point, with
the cooler/freezer visible.
**Goal:** validate the data we have, fill the gaps, and lock the pilot.
**Recording:** capture in Happy Scribe (transcribes Polish well — replaces Granola which struggled with Polish on prior sessions).

---

## Why we are doing this

Pita Bros is testing a new way to handle supplier orders at one point
(Wola) with one supplier (Pago) and ~18 products. The Captain submits an
order through a simple phone screen; one person in management/office
dispatches all orders from one dashboard — no more logging into each
supplier separately.

The pilot runs for **4 ordering cycles** (~1 month). After that we decide
whether to extend to more suppliers, more locations, both, or stop.

The Captain's commitment for the pilot:
1. Use the Captain Submit screen on every Pago ordering day (~weekly).
2. Enter current stock honestly — even if it disagrees with GoStock.
3. When the system suggests a quantity and you change it by more than 20%,
   pick a reason from the dropdown.
4. Tell us when the system gets it wrong — the audit log is for learning.

What the system **will not** do:
- Send orders to the supplier automatically (Manager always reviews).
- Change anything in GoStock.
- Make the Captain do extra paperwork — the screen should take 5–10 min
  per supplier order, less once master data is dialed in.

---

## Before the session — what to have ready

- A current physical stock count of the ~18 Pago products (kg, szt, opak).
- The most recent Pago invoice / WZ (for unit verification).
- Phone or tablet to test the Captain Submit mockup.
- Any notes on stockouts or near-stockouts in the last 4 weeks.

---

## Section A — Validate the Wzór min/max (highest priority)

The `Wzór` template has min/max for 51 of 134 products. But the 17_05
remanent shows actuals **4–10× higher** than Wzór max for the core meats,
and **41% of min** for Halloumi. We need to know which numbers are real.

### A1. Souvlaki Kurczak (core menu)

- Wzór: min 4 kg, max 12 kg.
- 17_05 actual: **53.16 kg** (4.4× over max).

Question: **Was 53.16 kg event-driven, or is that closer to normal Wola
operating stock?** If normal: what should min/max actually be? Propose
new numbers in kg.

Decision needed:
- `min_stock_qty_base`: ___ kg
- `max_stock_qty_base`: ___ kg
- `target_stock_qty_base`: ___ kg (the level we replenish to; usually = max)

### A2. Souvlaki Wieprz (core menu)

- Wzór: min 2 kg, max 4 kg.
- 17_05 actual: **24.83 kg** (6.2× over max).
- Note: 1 karton = 5 kg. If max really is 4 kg, every order causes
  packaging-driven overage by 1 kg.

Question: **Same as A1 — current operating levels?** Plus: is the packaging
overage acceptable, or do you want a different ordering rhythm (e.g.,
order every two weeks)?

### A3. Pita opakowania szt 10

- Wzór: min 1 opak, max 5 opak.
- 17_05 actual: **52 opak** (10.4× over max).

Likely the Wzór is from an early/small version of Wola. Confirm current
levels.

### A4. Halloumi (core menu cheese)

- Wzór: min 24 kg, max 72 kg.
- 17_05 actual: **9.83 kg** — under min, possibly stockout state.

Question: **Is 9.83 kg a real stockout, or do you operate consistently
below the Wzór min?** If you operate lower, what are realistic numbers?

Also: is Halloumi sold as pieces (~200 g) or as kg blocks? The Intermlecz
invoice ratio (1 piece ≈ 0.2 kg) suggests pieces. Confirm.

### A5. Tzatziki

- Wzór: min 9 kg, max 30 kg.
- 17_05 actual: 42 kg (1.4× over max).

Question: numbers correct or update?

### A6. Spotcheck the rest

Walk through the rest of the Pago + Bukat products with the Captain in
2–3 minutes total. The Captain glances at each Wzór min/max and says
"OK" or "should be X". We capture in the Sheet on the spot.

---

## Section B — Validate units of measure

For products where the Pago invoice price column (`Cena`) differs from the
per-kg price (`Cena za jednostkę miary`), there's a non-1:1 conversion
between purchase unit and inventory unit. We've inferred these from the
17_05 CSV — confirm with Captain.

| Product            | Inventory unit | Purchase unit | Inferred conversion       | Confirm? |
|--------------------|---------------|---------------|---------------------------|----------|
| Souvlaki Kurczak   | kg            | karton        | 1 karton = 5 kg           | □        |
| Souvlaki Wieprz    | kg            | karton        | 1 karton = 5 kg           | □        |
| Gyros 15 KG        | szt           | szt (=15 kg)  | each szt = 15 kg          | □        |
| Gyros 25 KG        | szt           | szt (=25 kg)  | each szt = 25 kg          | □        |
| Pita opak szt 10   | opak          | opak          | 1 opak = 10 (or 12?) szt  | □ ← VERIFY szt count per opak |
| Falafel            | kg            | karton        | 1 karton = 5 kg           | □        |
| Halloumi           | kg            | szt (200 g)   | 1 szt = 0.2 kg            | □ ← unusual, confirm |
| Tzatziki           | kg            | wiadro        | 1 wiadro = 3 kg           | □        |
| Tirokafteri        | kg            | wiadro        | 1 wiadro = 3 kg           | □        |
| Feta blok          | kg            | blok          | 1 blok = 2 kg             | □        |
| Oliwki kalamata    | kg            | opak          | 1 opak = 2 kg             | □        |

For Intermlecz spices (Pieprz, Papryka słodka, Ziele Angielskie, Pieprz
saszetki) — package sizes are not obvious from CSV ratios. **Capture the
real package size** (g per package) for each.

---

## Section C — Validate the supplier (Pago)

### C1. Email and address

- Pago ordering email: ___
- Pago delivery days: ___
- Pago cutoff time (Europe/Warsaw): ___
- Pago minimum order value (PLN), if any: ___
- Pago contact person (name, phone): ___

### C2. How is the order placed today?

- By Manager? By Captain? Both?
- Email format used (free text? table? attached file?)
- Does Pago confirm receipt? How fast?
- Any current pain points with Pago specifically?

### C3. Wola delivery address

For the order email's address line.

- Wola delivery address: ___
- Building / floor / unloading bay notes: ___
- Receiving contact at Wola (name, phone): ___

---

## Section D — Workflow validation

Walk the Captain through the Captain Submit screen (mobile mockup, on
their phone if possible).

### D1. Order moment

- When do you usually decide quantities for Pago? (Time of day, before/
  after shift, etc.)
- Where would you use this — kitchen, office, cooler entrance?

### D2. Stock entry

- Reading: how do you count current stock today? (Visual estimate? Scale?
  Container-based?)
- Does counting 18 items take 5 min? 15 min? 30 min?
- Where would you keep notes during counting?

### D3. Suggestion review

- Show the Captain a suggestion: "current 8 kg, target 12 kg, need 4 kg →
  1 karton = 5 kg."
- Does this math feel right? Does the Captain trust 1 karton at this
  level, or want to adjust?

### D4. Reason capture

- Show the reason picker on the deviation card.
- Are the 7 reason codes the right ones? Missing any?
  - EVENT_HIGH_TRAFFIC
  - WEEKEND_HIGH_TRAFFIC
  - LOW_STORAGE
  - PACKAGING_LIMITATION
  - SUPPLIER_UNDERDELIVERS
  - SYSTEM_SUGGESTION_WRONG
  - OTHER

### D5. Submit flow

- Show the "Submit to Manager" button.
- Does the Captain expect to know what happens next? (We'll show:
  "Submitted — Manager will dispatch by 16:00 today.")
- Should the Captain see when their order was sent and to which email?

---

## Section E — Captain ↔ Manager handoff

- When the Captain submits, who in management/office should see it?
  (Manager Bro? Office Bro? Both? You? Rotating?)
- Should the Captain get a notification when the Manager dispatches?
  (Email? SMS? Slack? WhatsApp?)
- If the Manager changes a quantity before sending, should the Captain
  know? (Recommend: yes, via message.)

---

## Section F — Edge cases

### F1. The Captain is sick / on holiday

- Who submits for them?
- Should the system enforce one Captain per location, or allow backup
  Captains?

### F2. Wrong stock count entered

- After submitting, can the Captain edit before the Manager dispatches?
  (Recommend: yes.)
- After Manager dispatches, what's the policy?

### F3. Pago doesn't deliver

- Today, what's the escalation path?
- Should the system track partial / missed deliveries (Phase 2 — receiving
  module)?

### F4. Pago substitutes a product (e.g., out of Souvlaki Kurczak, sends Souvlaki Wieprz)

- Phase 2 — receiving module. Note Captain's current practice.

---

## Section G — What the Captain wants from us

Open-ended:
1. What would make this system **stop being useful** for you?
2. What would make it **worth using on every ordering day**?
3. Anything you've been wanting from Pita Bros tools that this could
   solve?

---

## Section H — Decisions to lock in the session

| Item | Owner | Status |
|---|---|---|
| Confirmed v0 supplier: **Pago** | Captain + Ben | □ |
| Confirmed v0 location: **Wola** | Captain + Ben | □ |
| 18-product master list final | Captain + Ben | □ |
| All `units_per_purchase_unit` verified | Captain | □ |
| All min/max refreshed to current operating reality | Captain | □ |
| Pago email, delivery days, cutoff captured | Captain + Office | □ |
| Wola delivery address captured | Captain | □ |
| Captain identifier (email or short code) | Captain + Ben | □ |
| Manager identifier (who dispatches) | Ben | □ |
| Pilot start date | Captain + Ben | □ |
| Pilot review date (4 cycles out) | Captain + Ben | □ |

---

## After the session — what we do with the data

1. Update [seed/products.csv](seed/products.csv),
   [seed/supplier_products.csv](seed/supplier_products.csv),
   [seed/location_product_settings.csv](seed/location_product_settings.csv),
   [seed/suppliers.csv](seed/suppliers.csv),
   [seed/locations.csv](seed/locations.csv) with the validated values.
2. Provision the live Google Sheet from the updated seeds.
3. Build the Captain Submit + Manager Dashboard apps (see [BUILD_PLAN.md](BUILD_PLAN.md)).
4. Schedule the first real Pago ordering cycle through the system.

---

## A note on language

The Captain will read this in Polish if needed — we can translate before
the session. The system itself stays English (field names, status codes)
**except** product names and units, which are Polish.
