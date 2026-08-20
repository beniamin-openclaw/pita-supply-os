---
project: "Pita Supply OS"
version: 3
status: draft
created: 2026-06-04
updated: 2026-08-20   # v3: +Supplier dimension per location (FR-025…FR-030, US-03)
context_type: brownfield
product_type: web-app
target_scale:
  users: small          # pilot = Wola only; company-wide end-state ~ medium (see Open Questions)
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 1
  hard_deadline: null
  after_hours_only: false   # mixed — partly day-job, partly after-hours
---

## Current System Overview

**System purpose:** Pita Supply OS v1 is an internal **supplier-ordering** web app where a location Captain submits stock-based orders and a Manager reviews and dispatches them to suppliers. It is not guest- or menu-facing ordering.

**Architecture & tech stack** *(existing reality — named here, not chosen):* a FastAPI (Python) backend with **Google Sheets as the data store**, a suggestion engine (`supply-os-v1/app/suggestion.py`), and channel-aware dispatch. Deployed as an API service on a droplet with a web/proxy front on Vercel. Dispatch produces an email draft (Gmail), with portal / phone / manual channels also available.

**Core functionality today:**
- **Captain Submit** (`/captain-v2`) — enter current stock, see suggestion quantity with visible math, set final quantity with a reason, submit per supplier.
- **Manager Dashboard** (`/manager`) — view today's submitted orders in a queue, claim ("Przejmij"), edit line quantities/comments and save without dispatching, send back to the Captain ("Odrzuć do poprawy"), or dispatch.
- **Suggestion engine** — `max(0, target − current)` → purchase units, with the math shown. Suggests only; never auto-orders.
- **Per-line order history** — each `order_lines` row stores suggested / captain / manager / reason / actor / time as a learning asset.

**User base (rough scale):** small. Captains at the Wola location, one Manager (dispatching staff, or the owner during tests), and the owner/developer (Beniamin). Pilot scale, low throughput, small data volume.

**Current quality baseline:** production runs on Vercel + droplet; the TesterArmy regression suite is 4/4 green on prod (per `RESUME_STATE_2026-06-02`).

**Currency note (2026-08-20).** Two facts above have moved on since v1 and are restated here so the v3 delta reads against reality: the data store in production is now Postgres (the Sheets adapter remains behind the same seam), and the API is hosted on a managed platform rather than the original droplet. Neither move changed the product behavior this PRD describes.

**Supplier model as it stands (2026-08-20).** A product's orderability on the Captain screen is the intersection of a **global** supplier catalog and a **per-location** threshold record. Because the catalog is global, a product effectively has one supplier for the whole company. In production this is not merely permitted but literal: 154 products against 154 catalog entries — every product sits at exactly one supplier, and no location can differ from another.

---

## Problem Statement & Motivation

The shipped v0 works, but the day-to-day ordering workflow still carries four operator-confirmed pains:

- **Send pain** — a single ordering cycle takes ~30–60 min spread across portals, Excel, GoStock, and email.
- **Decision pain** — the Captain's judgment about *why* a quantity was chosen lives in WhatsApp, not in the order.
- **Memory pain** — there is no durable record of the reasoning behind quantities.
- **Unit pain** — kg vs cartons/pieces across tools causes silent conversion errors.

**Why now:** v0 is shipped, and the operator is moving the live pilot from **Pago** (used for docs/tests) to **Bukat** with **email** dispatch — to prove the two-role flow end-to-end on one real supplier before a gated rollout (week 2 suppliers → +2 locations → company-wide).

**Current workaround and its cost:** ordering is done manually across multiple tools (portals / Excel / GoStock / email) with WhatsApp carrying the decision context — ~30–60 min per cycle and no durable "why."

**Second motivation, added 2026-08-20 — the supplier dimension is missing.** The one-supplier-per-product assumption has now failed against three live situations at once, all with the same root cause (there is nowhere to record *from whom a given location buys a given product*):

1. **Office items split by location** — staples, markers and pens should come from Blue Service at Wolska, while Bracka and Norblin hold real thresholds for the same products at Pago. Re-pointing the global catalog would fix one location and break two.
2. **Substitutes** — fries are bought interchangeably from three sources depending on availability and price. The model cannot express more than one source, so two of the three are invisible. (One of those sources is not in the supplier list at all yet.)
3. **Geographic expansion** — every new city multiplies the problem, because suppliers are regional while the catalog is company-wide.

The operator's decision (2026-08-20) is that this dimension hangs on the **location**, not the city: two locations in the same city may legitimately buy the same product from different suppliers.

**Insight that makes this worth doing:** a two-role flow + visible math + per-line history produces labeled behavior data *without* integrating GoStock in v0. The recommendation engine suggests but never auto-orders; it must stay explainable and be validated/improved as master data is fixed (Bukat first).

---

## User & Persona

All three personas already exist; this change alters the Captain's and Manager's day-to-day flow for the Bukat pilot.

- **Captain** *(existing; experience changes)* — submits orders at Wola via `/captain-v2`. Reaches for it to enter current stock, review the suggestion math and reasons, and submit per supplier.
- **Manager** *(existing; experience changes)* — works the queue via `/manager`: reviews, claims, edits/saves, sends back, and dispatches the Bukat order by email. Reaches for it when submitted orders land in the queue and need review/dispatch.
- **Beniamin / owner** *(existing)* — builds, deploys, tests, fixes master data, and reads the per-line history. No third production login in v0; oversight happens outside the app.

---

## Success Criteria

### Primary (Wola × Bukat, week 1)

1. **Captain path:** token → Bukat → current stock + suggestion math → submit.
2. **Manager path:** token → queue → claim ("Przejmij") → edit/save or send-back → email dispatch.
3. **Learning loop:** line history is complete, and the owner validates Bukat suggestions and master data.

### Secondary

- Week 2: more suppliers + channel-aware dispatch (FR-013); add queue filters (FR-014) before order volume outgrows the unfiltered queue.

### Guardrails

- Protected existing behavior (the Tier-1 set in *Constraints & Compatibility*) is preserved; **no accidental live orders during production tests — regression flows back out or use safe test data** (confirmed NFR).
- The engine and master data are improved continuously; the Pago warehouse pipeline stays out of week 1.
- Rollout gates hold: week 2 → +2 locations → company-wide only after the prior stage passes.
- **Quality floors that must hold (confirmed NFRs):**
  - No entered stock is lost during a typical Bukat submit on a phone or tablet under normal pilot connectivity.
  - Orders submitted the same business day appear on the Manager queue without needing a separate tool.
  - Every dispatched order line stays inspectable later — suggested vs captain vs manager values plus reason codes — for coaching and master-data improvement.

### Rollout plan

| Stage | Scope |
|-------|--------|
| Week 1 | Wola × Bukat MVP + test |
| Week 2 | More suppliers |
| Next | +2 locations |
| Then | All company |

---

## User Stories

### US-01: Wola Captain submits a Bukat order; Manager dispatches by email

*Previously: the live pilot targeted Pago, and the Captain's judgment lived in WhatsApp rather than in the order.*

- **Given** a Wola Captain with a valid Captain token and Bukat products configured in master data
- **When** the Captain enters current stock, accepts or adjusts suggested quantities (with reasons if required), and submits the Bukat order
- **Then** the order appears on the Manager queue the same day, with suggestion, captain-final, and reason captured on each line

#### Acceptance Criteria

- Each line shows the suggestion math before the Captain confirms the final quantity.
- After the Manager claims the order, the Manager can save edits, send it back to the Captain, or dispatch.
- Dispatch produces a ready-to-send email draft containing the Bukat line quantities in purchase units.
- The owner can review the same per-line history after the flow completes.

### US-02: Wola Captain counts the whole location once, then orders with stock pre-filled

*New (Location Inventory Count change): decouples "count everything once" from "order per supplier", making the governing rule's stock-count step explicit and reusable. A parallel early track — does not block or delay the Bukat pilot (US-01).*

- **Given** a Wola Captain with a valid Captain token and products configured for the location
- **When** the Captain opens the location inventory screen, enters current stock for every product in one pass, and approves it
- **Then** the count is saved as a dated snapshot, and when the Captain later starts a supplier order they are offered — with the snapshot's date/time shown — to pre-fill current stock (editable, and skippable for manual entry as today)

#### Acceptance Criteria

- The inventory screen lists every product configured for the Captain's location.
- Approving persists a snapshot carrying timestamp + actor; prior snapshots are retained.
- The order screen's pre-fill is opt-in, names its source snapshot, and never overwrites without confirmation; ordering without any inventory behaves exactly as today.
- Phase-2 (should-have, deferred): a Manager view of submitted inventories and history/trend browsing.

### US-03: Two locations buy the same product from different suppliers

*New (Supplier dimension per location, 2026-08-20): the first change that lets one product belong to different suppliers at different locations. Master-data only from the operator's side; no new screen.*

- **Given** staples, markers and pens have thresholds at Wolska, Bracka and Norblin, and are carried by both Blue Service and Pago in the supplier catalog
- **When** the Owner records that Wolska buys them from Blue Service, and leaves Bracka and Norblin unset
- **Then** the Wolska Captain sees them only under Blue Service, the Bracka and Norblin Captains keep seeing them under Pago with their existing thresholds, and no other product at any location changes visibility

#### Acceptance Criteria

- Wolska × Pago drops exactly the three pinned products; every other Wolska × Pago line is unchanged.
- Bracka and Norblin order screens are identical before and after.
- Each location keeps a single threshold record per product; no threshold value is edited by this change.
- A product carried by several suppliers, with no per-location choice recorded, appears under each of those suppliers at that location — with the same target and each supplier's own purchase unit and rounding.
- Marking a catalog entry inactive removes that line from the order screen.

---

## Scope of Change

The functional requirements from shaping, categorized by change type — 14 baseline, 5 added for the **Location Inventory Count** change (FR-015…FR-019, a parallel early track), and 6 added for the **Supplier dimension per location** change (FR-025…FR-030). FR-NNN identifiers and Socratic resolutions are preserved as load-bearing for downstream review. No requirements are removed.

### Preserved (must not break)

- **[preserved] FR-001** — Captain can log in with an access token and open the Captain order screen. Priority: must-have.
  > Socrates: No counter-argument; stands as written.
- **[preserved] FR-003** — Captain can enter current stock and see the suggestion quantity with visible math per line. Priority: must-have.
  > Socrates: No counter-argument; stands as written.
- **[preserved] FR-004** — Captain can set the final purchase quantity and provide a reason when deviation rules apply. Priority: must-have.
  > Socrates: No counter-argument; stands as written.
- **[preserved] FR-005** — Captain can submit the order so it appears on the Manager queue the same day. Priority: must-have.
  > Socrates: No counter-argument; stands as written.
- **[preserved] FR-006** — Manager can log in with an access token and view today's submitted orders in a queue. Priority: must-have.
  > Socrates: Counter-argument accepted: queue without filters unusable at scale.
  > Resolution: Keep week 1; **FR-014** before multi-supplier/location.
- **[preserved] FR-007** — Manager can claim an order ("Przejmij"). Priority: must-have.
  > Socrates: No counter-argument; stands as written.
- **[preserved] FR-008** — Manager can edit line quantities and comments and save without dispatching (after claim). Priority: must-have.
  > Socrates: No counter-argument; stands as written.
- **[preserved] FR-009** — Manager can send the order back to the Captain ("Odrzuć do poprawy") with a reason (after claim). Priority: must-have.
  > Socrates: No counter-argument; stands as written.
- **[preserved] FR-011** — System can record suggested, captain-final, manager-final, and reason on each order line for later learning. Priority: must-have.
  > Socrates: Blame-culture risk noted; operator not convinced — stands as written.
- **[preserved] FR-013** — Manager can use channel-aware dispatch (portal / phone / manual) for additional suppliers. Priority: must-have by week 2.
  > Socrates: No counter-argument; stands as written.
- **[preserved] FR-030** — A location and product with no recorded supplier choice behaves exactly as it does today. Priority: must-have. *(Added 2026-08-20 with the supplier-dimension change.)*
  > Socrates: Counter-argument considered: "making the default permissive means the change is invisible and nobody adopts it." Resolution: kept — invisibility is the point. This is a live ordering system for four locations; the change must be a no-op until master data opts in, one product at a time.

### Modified

- **[modified] FR-002** — Captain can select supplier **Bukat** and see Wola product lines for that supplier (pilot pivots the active supplier to Bukat). Priority: must-have.
  > Socrates: No counter-argument; stands as written.
- **[modified] FR-010** — Manager can dispatch a Bukat order **via email** (email draft; pilot dispatch channel). Priority: must-have.
  > Socrates: No counter-argument; stands as written.
- **[modified] FR-012** — Owner can verify and correct **Bukat** master data and suggestion outcomes so the recommendation engine is trustworthy for pilot products. Priority: must-have.
  > Socrates: Sheet-edit consistency risk noted; operator not convinced — stands as written.

**Supplier dimension per location (2026-08-20):**

- **[modified] FR-026** — Captain sees a product on the order screen only under the supplier(s) allowed by that location's recorded choice (narrows the FR-002/FR-003 visibility rule). Priority: must-have.
  > Socrates: Counter-argument considered: "narrowing visibility can silently hide a product a Captain needs, and the Captain cannot tell that it was hidden." Resolution: accepted as a real risk and mitigated, not dismissed — narrowing happens only where the Owner explicitly records a choice, unset stays open, and every master-data batch that narrows runs diff-before → apply → audit-after with per-location item counts recorded.
- **[modified] FR-029** — A supplier-catalog entry marked inactive is not orderable. Priority: must-have.
  > Socrates: Counter-argument considered: "this is an unrelated defect and belongs in its own lane." Resolution: rejected — without it there are two ways to stop buying a product from a supplier (record a different choice for the location, or deactivate the catalog entry) and only one of them works, which is worse than either alone.

### New

- **[new] FR-014** — Manager can filter or narrow the order queue (supplier, location, status). Priority: must-have by week 2.
  > Socrates: N/A (added from the FR-006 resolution).

**Location Inventory Count change (FR-015…FR-019 — parallel early track, independent of the Bukat pilot):**

- **[new] FR-015** — Captain can open a location-wide inventory screen (all products configured for the location) and enter current stock for every product in one pass. Priority: must-have.
  > Socrates: Counter-argument considered: "redundant with per-supplier stock entry already in the order screen." Resolution: kept — the win is count-once, reuse across suppliers; matches the operator counting the whole store at once.
- **[new] FR-016** — Captain can approve an inventory count, persisted as a dated snapshot (timestamp + actor); snapshots are retained over time. Priority: must-have.
  > Socrates: Counter-argument considered: "a snapshot store breaks 'no schema change in week 1'." Resolution: kept — accepted as a separate parallel track (new entities behind `_choose_backend()`), not week-1 pilot scope.
- **[new] FR-017** — When starting a per-supplier order, the Captain can opt in (a confirmation that names the snapshot's date/time) to pre-fill current stock from the latest snapshot; values are editable and ordering works without it. Priority: must-have.
  > Socrates: Counter-argument considered: "stale auto-fill could push a wrong count into an order." Resolution: kept with a double-safeguard — opt-in, and the prompt names which inventory (date/time) it pulls from; nothing fills without confirmation.
- **[new] FR-018** — Manager can view submitted inventory counts (read-only). Priority: should-have (Phase 2; deferred past the pilot).
  > Socrates: Counter-argument accepted: the Manager already receives the order with stock embedded — a separate inventory view duplicates without pilot value. Resolution: demoted to should-have, Phase 2.
- **[new] FR-019** — Captain/Owner can browse inventory history/trends over time. Priority: should-have (Phase 2; deferred past the pilot).
  > Socrates: Counter-argument accepted: snapshots are persisted regardless (FR-016); a trend/browse UI is audit/scale value, not pilot value. Resolution: demoted to should-have, Phase 2.

**Supplier dimension per location (FR-025, FR-027, FR-028 — independent lane; nothing in the dispatch path changes):**

- **[new] FR-025** — Owner can record, per location and product, which supplier that location buys the product from; leaving it unrecorded means every supplier that carries the product. Priority: must-have.
  > Socrates: Counter-argument considered: "a separate location-to-supplier membership record is the cleaner model — it expresses arbitrary subsets, not just one-or-all." Resolution: rejected for v1 on three grounds. (1) A new entity must be implemented in all three interchangeable data backends plus its model and its loader, versus one optional field on a record that already exists per location and product. (2) Preserving today's behavior with a membership record means either backfilling roughly 580 rows as a hard cutover (Wolska 151, Bracka 144, Norblin 145, KEN 138), or adopting "no record = all suppliers", which is the optional-field semantics with an extra entity on top. (3) Thresholds are deliberately supplier-agnostic — a location wants N units on site regardless of who delivers them — and the existing one-record-per-location-and-product rule enforces that. Subsets (exactly two of three suppliers) have zero instances in the data today; if they ever appear, each recorded choice migrates into a membership record one row each.
- **[new] FR-027** — A product carried by several suppliers appears under each allowed supplier with the same location target and each supplier's own purchase unit, rounding rule and price. Priority: must-have.
  > Socrates: Counter-argument considered: "the same suggestion shown at three suppliers invites ordering it three times — a failure mode that cannot happen today." Resolution: real and new. The operator confirmed (2026-08-20) that a Captain picks one source per day and never splits one need across suppliers, so a duplicate is an error rather than an operation. Mitigated by FR-028 rather than by a hard block, because a block would also stop legitimate same-day re-orders and would contradict the suggest-only / human-commits governing rule.
- **[new] FR-028** — On a line available from more than one supplier at this location, the Captain can see which other suppliers carry it. Priority: should-have.
  > Socrates: Counter-argument considered: "a badge is not a guard — it does not prevent the double order it exists to address." Resolution: kept as should-have and deliberately informational. It serves the operator's actual behavior (choosing today's source), and the alternative — a same-day uniqueness gate across orders — constrains a flow the operator has not asked to constrain. Revisit if a duplicate ever reaches a supplier.

---

## Constraints & Compatibility

**Backward compatibility (must keep working):**
- Existing production routes `/captain-v2` and `/manager`, and the Captain → Manager queue → save/dispatch flow.
- Two-token authentication and the existing order status workflow.
- The suggestion math remains visible to the user.

**Data:**
- No schema change planned for the **baseline pilot**. The existing data-store schema, the order-line history columns, and secrets-kept-off-repo all stay as-is. No data migration or backfill in week 1.
- **Location Inventory Count change (parallel track) — the one intentional exception:** introduces two new data entities, `inventory_counts` + `inventory_count_lines`, behind the existing `_choose_backend()` seam (mirroring `orders` / `order_lines`). This is parallel to, not part of, the week-1 Bukat pilot, and leaves the pilot's data store, the `order_lines` schema, and the order/dispatch flow untouched.
- **Supplier dimension per location (2026-08-20) — one optional field, no new entity:** the per-location supplier choice is recorded as an optional supplier reference on the existing per-location threshold record. Unrecorded means "every supplier that carries the product", which is why the change is a no-op until master data opts in (FR-030). It adds no entity, no loader function, and no new tab or seed file, and it rides the existing `_choose_backend()` seam in all three backends. It never widens visibility: the global supplier catalog remains the universe and the per-location choice can only narrow it.
- **Prod master data is gated per batch.** No production row is written without explicit operator consent, and every batch that narrows visibility follows diff-before (the rollback record) → apply → audit-after. Adding a supplier that does not exist yet is prod master data and is gated the same way.

**Existing integrations / behavior that must not regress:**
- Email dispatch continues to work.
- The production regression suite continues to **back out on submit** (no real supplier orders placed during tests).
- The location-wide inventory screen is unaffected by a product being carried by several suppliers — it lists products per location, not per supplier, and each product is listed once.
- The automated test that pins Wolska × Pago to a fixed item count and names three specific office products is updated as part of the change, not worked around; the count drops by exactly those three.

**Tiered preservation (from shaping):**

- **Tier 1 — do not break:** prod routes `/captain-v2`, `/manager`; Captain → queue → save/dispatch; visible suggestion math; data-store schema + off-repo secrets; order-line history columns; status workflow; two-token auth; regression-suite back-out on submit.
- **Tier 2 — preserve unless scoped:** the Manager V2 capabilities (G1–G3); the existing deployment topology (API service + web/proxy at `/api`); tests run before deploy; the Bukat pilot boundary; work stays on a branch until merge.
- **Tier 3 — improve freely:** engine and master data (Bukat first, then Pago SKUs); supplier contacts; docs; PR #8; the G4 history backlog.

---

## Business Logic Changes

**No new domain rule — the governing rule is reaffirmed for the baseline.** The change is pilot-scope (Pago → Bukat, email dispatch), not a change to domain logic; the engine stays suggest-only.

**Supplier dimension per location (2026-08-20) — one existing rule narrows, no rule is added.** Order-screen membership stops being "global supplier catalog ∩ local thresholds" and becomes "global supplier catalog ∩ local thresholds ∩ local supplier choice". Thresholds stay supplier-agnostic, and the suggestion math is untouched — it simply runs once per allowed supplier using that supplier's packaging. The engine still only suggests, and a human still commits.

**Governing rule:** the system is the **single path from location stock counts to supplier dispatch**, so the Captain's judgment reaches the order without WhatsApp and the Manager sends from one place.

Supporting detail: Captains enter current stock at the location; the product may suggest purchase quantities (target gap, purchase units, visible math), but the domain commitment is **coordination** — one structured flow from cooler to supplier, not auto-ordering. Managers review, adjust, send back, or dispatch (Bukat v0: email). Per-line history (suggested / captain / manager / reason) supports learning, but the rule is the **workflow bridge**, not the formula alone. Wrong suggestions are corrected via master data and engine validation so the path stays trustworthy.

---

## Access Control Changes

**No access control changes — the current two-token model is preserved.**

Current model: in-app token entry, no email/password in v0. A Captain token maps to the Captain role; the Manager token maps to dispatching staff (or the owner during tests). The owner has no in-app login and oversees out-of-band (data backend + tests).

Notes carried from shaping: the operator reviewed a fuller role→capability matrix and chose the short, unchanged form for this baseline ("go easy, harden later"); earlier token-prefix issues are reported hardened. Per-manager identity is a week-1 Non-Goal; token rotation is tracked in Open Questions.

---

## Non-Goals

**Functional non-goals (capabilities week 1 will NOT build):**

- **Pago internal warehouse pipeline** — master-ordering Excel aggregation, warehouse email, driver delivery plan (a separate Excel process today; future module).
- **Auto-ordering without a human final** — the system only suggests; the Captain and Manager always commit (governing rule).
- **Auto-generating draft orders from an inventory count** — the Location Inventory Count change only *pre-fills* the stock field; it never creates orders automatically (consistent with the suggest-only governing rule).
- **Guest / customer-facing restaurant ordering** — Supply OS is internal supplier ordering only.
- **GoStock integration, receiving/WZ, finance/KSeF, predictive AI** — per existing roadmap postponements.

**Supplier dimension per location — explicitly out of scope (2026-08-20):**

- **Per-supplier thresholds** — a location keeps one target/min/max per product regardless of who supplies it. Splitting thresholds per supplier is out.
- **Arbitrary supplier subsets per location** — v1 is one-or-all. The migration path if this is ever needed is recorded in the FR-025 Socratic resolution.
- **A master-data admin screen** — the per-location supplier choice is recorded the same way as every other master-data value today. Building an editing surface is a separate lane.
- **Making the supplier list on the Captain screen location-aware** — the screen lists every active supplier company-wide, so a supplier with no lines at a location shows an empty screen. This predates the change and is not made worse by it; recorded as a follow-up, not fixed here.
- **A hard block on ordering one product from two suppliers the same day** — informational only in v1 (FR-028).

**Non-functional non-goals (quality dimensions week 1 will NOT aim for):**

- **Per-manager identity / audit-by-person** — a shared Manager token is acceptable for the pilot; history records a generic "manager" actor.
- **Multi-location / company-wide scale hardening** — week 1 is Wola-only; per-manager auth, concurrency, and scale hardening are gated to later rollout stages.

---

## Open Questions

1. **Who holds the Manager token at Wola day-to-day** — staff vs owner during the pilot (shared token; no per-manager identity yet). *Blocking for pilot start.*
2. **Bukat master-data readiness** — ready for week 1, or does it need a prep pass before the Captain pilot? *Blocking for pilot start.*
3. **End-state scale** — frontmatter `users: small` (pilot); company-wide rollout is likely `medium` — confirm before scale work.
4. **Token rotation** — two tokens were exposed earlier; rotate before wider rollout (deferred).
5. **The third fries source is not in the supplier list** — the substitutes scenario (FR-027) cannot be exercised end-to-end until that supplier exists as master data. Adding it is a gated prod master-data batch. *Blocking for the substitutes half of the change; the office-items half (FR-025/FR-026) is unaffected.*
6. **Which locations, if any, should pin fries** — leaving every location unrecorded makes the product visible at all three sources everywhere, including locations that only ever buy from one. Needs an operator pass per location before the substitute catalog entries are added. *Blocking for the substitutes half.*
