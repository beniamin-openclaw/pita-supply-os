---
change_id: pack-units-display-mobile-wrap
title: Pack-unit equivalents on the order screens, mobile text wrapping, P179 rename
status: implemented
created: 2026-09-06
updated: 2026-09-06
archived_at: null
---

## Notes

Operator request 2026-09-06 (three parts, one lane):

1. **Rename** prod product P179 "Kebab z Kurczaka 50/50 15 KG" → "Gyros z Kurczaka (Kebab)".
   Supplier catalogue name (`supplier_products.supplier_product_name`, what the Spec Food
   e-mail prints — `gmail_url.py:96` prefers it) stays "Kebab z Kurczaka 50/50 15KG".
2. **Pack-based display.** Captains read `target 120` next to `sugestia 3 zgrzewki` as
   "120 cases" and override the (correct) suggestion. Week-1 data: 6 of 7 KEN deviation lines
   and 1 of 9 Wola lines are Coca-Cola products where the math was right and the display misled.
   Pure display change + one optional input convenience (type stock in packs). Engine, stored
   units, `order_lines` columns and master-data targets are untouched. Backend untouched.
3. **Mobile truncation.** Words are cut off (`truncate` / `line-clamp-1`) on the Captain phone
   screens so the operator cannot tell what a line says. Wrap instead of clip.

Post-implementation review + fixes, commit, push, deploy verification are part of this lane.

## Post-implementation review — 2026-09-06

Reviewer: Claude (Sonnet subagents implemented Tracks A and B; the fixes below are the
reviewer's own edits). Verified on a 375 px viewport against a local seed backend with captain
auth enabled (scratchpad copy of the seed CSVs with Coca-Cola set to `zgrzewka × 24`, Zero
target/max 120), plus the full suites.

Acceptance re-check: Coca-Cola Zero, target 120 / stock 40 → "Cel: 120 szt (5 zgrzewek) ·
Max: 120 szt (5 zgrzewek) · 1 zgrzewka = 24 szt", under the field "40 szt = 1,7 zgrzewki",
tile "brakuje 80 szt = 3,3 zgrzewki → 4 zgrzewki" (the seed SKU is `full_only`, so the engine
ceils to 4 — the brief's "3" assumed rounding; engine untouched). Toggle on, typing 2 → state
48, hint "2 zgrzewki = 48 szt", tile recomputed "brakuje 72 szt = 3 zgrzewki". ×1 SKU: same
target-line wording as before, no toggle, no "=" hint.

Findings and what was done:

- **R1 (fixed) — target line broke inside "(5 zgrzewek)".** One long template wrapped
  mid-parenthesis on 375 px. Replaced `card.targetLinePacks` with three keys
  (`card.targetPart` / `card.maxPart` / `card.ratioPart`) rendered as `whitespace-nowrap`
  segments joined by " · ", so a phone breaks only between them.
- **R2 (fixed) — suggestion tile ran to four lines.** Same treatment: `card.suggestionNeed`
  ("brakuje 80 szt") + two symbol segments ("= 3,3 zgrzewki", "→ 4 zgrzewki"), each no-wrap;
  the "→" segment is omitted when the exact quotient already equals the rounded suggestion.
- **R3 (fixed, pre-existing bug) — unit suffix drawn over the number.** The absolutely
  positioned unit inside both `DecimalInput`s (`pr-9`) collided with the value for any unit
  longer than "szt": "zgrzewka" sat on top of the "0" in ZAMAWIASZ on the baseline screenshot
  of `main`, and the pack toggle would have put the same word into OBECNY STAN. Both units are
  now a small right-aligned caption under the field (same element ids, so
  `aria-describedby` is unchanged). This also touches ×1 cards — a deliberate exception to
  "nothing changes visually", because it is the operator's "ucinane wyrazy" complaint.
- **R4 (fixed) — toggle placement.** The "wpisz w zgrzewkach" pill rendered before the state
  pill and pushed it right. It now sits right-aligned on the same row (`ml-auto`), state pill
  first; gets a focus ring.
- **R5 (fixed) — sticky-bar summary broke inside "0 powodów".** `StickyActionBar` renders the
  three counts as no-wrap segments. The inventory sticky bars (count + edit) were restacked:
  hint line full-width on top, status + buttons in a column on phones and a row from `sm:`;
  before this the two buttons squeezed the hint into a four-line sliver.
- **R6 (accepted) — pack-mode input precision.** With the toggle on the field shows
  `roundQty(stock / upp)` (2 dp, e.g. 40 szt → 1.67) while the hint shows 1 dp ("1,7
  zgrzewki"); typing 1,7 stores 40.8 szt. Base units stay the source of truth; nothing is
  persisted in packs.
- **R7 (accepted) — `tPlural` not used for unit nouns.** A purchase unit is master-data
  text, and `pluralKeys.test.ts` rejects a non-literal noun, so the declension lives in
  `i18n/packUnits.ts` (the `categoryLabels.ts` precedent) with a table-integrity test. The
  guard test is green; there is no live inverted-key call site to fix.
- **R8 (noted) — Transport matrix** has no target/stock column, so no hint was added there;
  `OrderLineTable` (Manager order detail) carries the "(5 zgrzewek)" hints, verified by test
  only (no orders exist in seed mode).
- **R9 (noted) — `OrderDetailPage` "stan: … · sugestia: …"** history line still shows bare
  inventory units; out of scope, one-line follow-up if wanted.

Mobile wrapping is class-only (Track B) plus the two layout restacks above; every
`whitespace-nowrap` inside a horizontally scrolling table and the supplier-pill scroller were
left as they are on purpose.
