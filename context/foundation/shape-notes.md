---
project: "Pita Supply OS"
context_type: brownfield
created: 2026-06-03
updated: 2026-06-04
product_type: web-app
target_scale:
  users: small                      # pilot = Wola only; end-state (all company) ~ medium — see Open Questions
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 1
  hard_deadline: null
  after_hours_only: false           # mixed — partly day-job, partly after-hours (operator confirmed 2026-06-03)
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: context type
      decision: brownfield — Pita Supply OS supplier ordering (not customer-facing ordering)
    - topic: workspace layout
      decision: shape-notes/PRD in 10xDEVS; code in jarvis-codex branch claude/supply-os-manager-v2 (3 folders only)
    - topic: change category
      decision: baseline PRD for existing v0 (document shipped + what's next)
    - topic: personas
      decision: Captain (submit), Manager (review + dispatch), Beniamin (owner/developer/oversight) — locked 2026-06-03
    - topic: auth
      decision: keep two-token model; no auth change in baseline PRD
    - topic: live system authority
      decision: RESUME_STATE_2026-06-02.md over stale TesterArmy brief for prod state
    - topic: problem statement
      decision: four BRIEF pains confirmed; recommendation engine must be checked and improved ongoing
    - topic: pilot supplier
      decision: Bukat (email dispatch); Pago internal warehouse flow deferred
    - topic: Socrates FR-006
      decision: keep FR-006 week 1; add FR-014 queue filters before multi-supplier/location scale
    - topic: Socrates remainder
      decision: FR-001–005, 007–013, 011–012 stand as written (operator not convinced by counter-arguments)
    - topic: business logic (Phase 5)
      decision: "B" — single path from location stock to supplier dispatch; Captain judgment without WhatsApp; Manager sends from one place
    - topic: NFRs (Phase 5)
      decision: four pilot NFRs confirmed as written (no-data-loss submit, same-day queue, line inspectability, no real prod orders in tests); no extra regression NFR added
    - topic: access control (Phase 2 revised)
      decision: operator reviewed the out-of-band role→capability matrix and chose the short "two-token, unchanged" note for the baseline ("go easy, harden later"); per-manager identity → week-1 Non-Goal, token rotation → Open Questions; earlier token-prefix issues reported hardened
    - topic: product framing (Phase 6)
      decision: web-app (unchanged); after_hours_only=false (mixed — day-job + after-hours, operator confirmed); scale small at pilot, ~medium company-wide end-state (Open Q); hard_deadline=null; non-goals rebuilt with operator (4 functional + 2 non-functional; queue-filters NOT locked as a non-goal)
  frs_drafted: 19   # 14 baseline + 5 for the Location Inventory Count change (see end of file)
  quality_check_status: accepted
---

## Forward: codebase (informational — not PRD)

Authoritative code and specs live outside this 10xDEVS workspace:

- **Worktree:** `/Users/ben/Desktop/Jarvis/JARVIS V2/JARVIS-CODEX/Purchase/.claude/worktrees/pita-supply-os/`
- **Clone:** `https://github.com/beniamin-openclaw/jarvis-codex.git` branch `claude/supply-os-manager-v2`
- **Product folders only:** `supply-os-v1/`, `frontend/`, `docs/pita-supply-os-v1/`
- **Do not copy:** `sa.json`, `.env`, API keys
- **Live-state doc:** `docs/pita-supply-os-v1/RESUME_STATE_2026-06-02.md`
- **HANDOFF.md:** after shaping completes

---

## Current System

**Product:** Pita Supply OS v1 — internal **supplier** ordering (Captain at location → Manager dispatch to suppliers). Not guest/menu ordering.

**Shipped (per RESUME_STATE 2026-06-02):** Captain Submit (`/captain-v2`), Manager Dashboard (`/manager`), FastAPI + Google Sheets, suggestion engine in `supply-os-v1/app/suggestion.py`, channel-aware dispatch (email/Gmail draft, portal, phone, manual), order-line history on each line, prod on Vercel + droplet. TesterArmy 4/4 green on prod.

**Pilot pivot:** Operator moves v0 pilot from **Pago** (docs/tests) to **Bukat** with **email** dispatch. **Pago** is internal-import: master ordering Excel + warehouse email + driver plan — separate Excel today; out of week-1 MVP.

**Recommendation engine:** `max(0, target − current)` → purchase units + visible math. Operator: logic stays; **master data and outcomes must be checked and improved** continuously (Bukat first).

**Order-line history:** `order_lines` store suggested / captain / manager / reason / actor / time — learning asset, not a separate auditor role.

---

## Vision & Problem Statement

**Delta:** Baseline brownfield PRD for shipped v0, pivoted to **Wola × Bukat** (email), with gated rollout (week 2 suppliers → +2 locations → company).

**Problem (operator-confirmed):**

- **Send pain** — ~30–60 min per cycle across portals, Excel, GoStock, email.
- **Decision pain** — Captain judgment trapped in WhatsApp, not orders.
- **Memory pain** — No durable why behind quantities.
- **Unit pain** — kg vs cartons/pieces; silent conversion errors.

**Recommendation engine:** Suggests; never auto-orders. Must remain explainable and be validated/improved as master data is fixed.

**Insight:** Two-role flow + visible math + line history on Sheets builds labeled behavior data without GoStock in v0.

**Scale note:** At 100× locations/suppliers, queue filters (FR-014) and disciplined master-data edits become load-bearing; week 1 stays intentionally small.

---

## User & Persona

**1. Captain** — submits orders at Wola (`/captain-v2`): stock, suggestion math, reasons, submit per supplier.

**2. Manager** — reviews queue, claims, edits/saves, send-back, dispatches Bukat via **email (Gmail draft)** (`/manager`).

**3. Beniamin (owner)** — builds, deploys, tests, fixes master data, reads line history and Sheets. No third prod login for v0.

---

## Access Control

**Unchanged:** In-app token entry; Captain token vs Manager token; no email/password v0.

**Mapping:** Captain token → Captain; Manager token → dispatching staff (or owner during tests). Owner oversight via Sheets/backend/tests.

> Note (operator, 2026-06-03): reviewed the fuller role→capability matrix and chose this short form for the baseline — "go easy, harden later." Earlier token-prefix issues reported hardened. Per-manager identity is a week-1 Non-Goal; token rotation tracked in Open Questions. The matrix + known-gap detail can be re-added later if needed.

---

## Success Criteria

### Primary (Wola × Bukat, week 1)

1. Captain: token → **Bukat** → stock + suggestion math → submit.
2. Manager: token → queue → **Przejmij** → edit/save or send-back → **email dispatch**.
3. Line history complete; owner validates Bukat suggestions and master data.

### Secondary

- Week 2: more suppliers + FR-013 channels; **FR-014 queue filters** before volume breaks the dashboard.

### Guardrails

- Tier 1 preserved; no accidental live orders in prod tests.
- Engine/data improved continuously; Pago warehouse pipeline out of week 1.
- Rollout gates: week 2 → +2 locations → company only after prior stage passes.

### Rollout plan

| Stage | Scope |
|-------|--------|
| Week 1 | Wola × Bukat MVP + test |
| Week 2 | More suppliers |
| Next | +2 locations |
| Then | All company |

---

## Functional Requirements

### Captain — Bukat submit

- FR-001: Captain can log in with access token and open the Captain order screen. Priority: must-have. Change: preserved
  > Socrates: No counter-argument; stands as written.
- FR-002: Captain can select supplier **Bukat** and see Wola product lines for that supplier. Priority: must-have. Change: modified
  > Socrates: No counter-argument; stands as written.
- FR-003: Captain can enter current stock and see **suggestion quantity with visible math** per line. Priority: must-have. Change: preserved
  > Socrates: No counter-argument; stands as written.
- FR-004: Captain can set final purchase quantity and provide a reason when deviation rules apply. Priority: must-have. Change: preserved
  > Socrates: No counter-argument; stands as written.
- FR-005: Captain can submit the order so it appears on the Manager queue the same day. Priority: must-have. Change: preserved
  > Socrates: No counter-argument; stands as written.

### Manager — queue, claim, edit, send-back, dispatch

- FR-006: Manager can log in with access token and view today's submitted orders in a queue. Priority: must-have. Change: preserved
  > Socrates: Counter-argument accepted: queue without filters unusable at scale.
  > Resolution: Keep week 1; **FR-014** before multi-supplier/location.
- FR-007: Manager can **claim** an order ("Przejmij"). Priority: must-have. Change: preserved
  > Socrates: No counter-argument; stands as written.
- FR-008: Manager can **edit line quantities and comments** and **save without dispatching** (after claim). Priority: must-have. Change: preserved
  > Socrates: No counter-argument; stands as written.
- FR-009: Manager can **send the order back to Captain** ("Odrzuć do poprawy") with a reason (after claim). Priority: must-have. Change: preserved
  > Socrates: No counter-argument; stands as written.
- FR-010: Manager can **dispatch a Bukat order via email** (Gmail draft). Priority: must-have. Change: modified
  > Socrates: No counter-argument; stands as written.

### Data, engine, and oversight

- FR-011: System can record suggested, captain-final, manager-final, and reason on each order line for later learning. Priority: must-have. Change: preserved
  > Socrates: Blame-culture risk noted; operator not convinced — stands as written.
- FR-012: Owner can verify and correct **Bukat master data and suggestion outcomes** so the recommendation engine is trustworthy for pilot products. Priority: must-have. Change: modified
  > Socrates: Sheet-edit consistency risk noted; operator not convinced — stands as written.

### Week 2+

- FR-013: Manager can use **channel-aware dispatch** (portal / phone / manual) for additional suppliers. Priority: must-have by week 2. Change: preserved
  > Socrates: No counter-argument; stands as written.
- FR-014: Manager can **filter or narrow the order queue** (supplier, location, status). Priority: must-have by week 2. Change: new
  > Socrates: N/A (added from FR-006 resolution).

---

## User Stories

### US-01: Wola Captain submits Bukat order; Manager dispatches by email

- **Given** a Wola Captain with a valid Captain token and Bukat products configured in master data
- **When** the Captain enters current stock, accepts or adjusts suggested quantities (with reasons if required), and submits the Bukat order
- **Then** the order appears on the Manager queue the same day with suggestion, captain final, and reason captured on each line

#### Acceptance Criteria

- Each line shows suggestion math before the Captain confirms final quantity
- After Manager claims the order, Manager can save edits, send back to Captain, or dispatch
- Dispatch opens a Gmail draft with Bukat line quantities in purchase units
- Owner can review the same line history in Sheets after the flow completes

---

## Business Logic

The system is the **single path from location stock counts to supplier dispatch**, so Captain judgment reaches the order without WhatsApp and the Manager sends from one place.

Supporting detail: Captains enter current stock at the location; the product may suggest purchase quantities (target gap, purchase units, visible math) but the domain commitment is **coordination** — one structured flow from cooler to supplier, not auto-ordering. Managers review, adjust, send back, or dispatch (Bukat v0: email). Line history (suggested / captain / manager / reason) supports learning but the one-sentence rule is the **workflow bridge**, not the formula alone. Wrong suggestions are fixed via master data and engine validation so the path stays trustworthy.

---

## Non-Functional Requirements

<!-- Phase 5 — confirmed by operator 2026-06-03: all four kept as written; no extra regression NFR added -->

- A Captain can complete a typical Bukat submit session on a phone or tablet without losing entered stock when connectivity is normal for the pilot.
- A Manager sees orders submitted the same business day on the queue without needing to refresh through a separate tool.
- Every dispatched order line remains inspectable later with suggested vs captain vs manager values and reason codes for coaching and master-data improvement.
- Prod regression tests must not place real supplier orders (submit flows that back out or use safe test data).

---

## Constraints & Preserved Behavior

### Tier 1 — do not break

- Prod routes `/captain-v2`, `/manager`; Captain → Manager queue → save/dispatch; suggestion math visible
- Sheets schema + secrets off-repo; order-line history columns; status workflow; two-token auth; TesterArmy back-out on submit

### Tier 2 — preserve unless scoped

- Manager V2 (G1–G3); droplet API; Vercel `/api` proxy; tests before deploy; Bukat pilot boundary; branch until merge

### Tier 3 — improve freely

- Engine/master data (Bukat, then Pago SKUs); supplier contacts; docs; PR #8; G4 history backlog

---

## Non-Goals

**Functional non-goals (capabilities week 1 will NOT build):**

- **Pago internal warehouse pipeline** — master ordering Excel aggregation, warehouse email, driver delivery plan (separate Excel today; future module).
- **Auto-ordering without a human final** — the system only suggests; Captain and Manager always commit (Business Logic rule B).
- **Guest / customer-facing restaurant ordering** — Supply OS is internal supplier ordering only.
- **GoStock integration, receiving/WZ, finance/KSeF, predictive AI** — per existing ROADMAP postponements.

**Non-functional non-goals (quality dimensions week 1 will NOT aim for):**

- **Per-manager identity / audit-by-person** — shared Manager token is acceptable for the pilot; history records a generic "manager" actor.
- **Multi-location / company-wide scale hardening** — week 1 is Wola-only; per-manager auth, concurrency, and scale hardening are gated to later rollout stages.

---

## Forward: roadmap (informational — not PRD schema)

- Week 2: more suppliers (FR-013) + **queue filters (FR-014)** before volume grows.
- Gates: +2 locations, then all company.
- Future: Pago warehouse module aligned to operator Excel workflow.

---

## Quality cross-check

Ran 2026-06-03 — **accepted, no gaps.** All brownfield quality elements present:

- **Access Control** — present (two-token model, mapping, owner oversight).
- **Business Logic** — present (one-sentence rule B: single path from location stock to supplier dispatch).
- **Project artifacts** — present (shape-notes.md + valid checkpoint frontmatter).
- **Timeline-cost** — present (`delivery_weeks: 1` ≤ 3; no acknowledgment block required).
- **Non-Goals** — present (4 functional + 2 non-functional).
- **Preserved behavior** — present (Constraints & Preserved Behavior, Tier 1–3).

No gaps to mirror into `/10x-prd` Open Questions. The four entries under `## Open Questions` are genuinely open items (owner/date), not cross-check gaps.

---

## Open Questions

1. **Who holds the Manager token at Wola day-to-day** — staff vs owner during pilot (shared token; no per-manager identity yet).
2. **Bukat master data** — ready for week 1 or needs a prep pass before Captain pilot.
3. **End-state scale** — frontmatter `users: small` (pilot); company-wide rollout likely `medium` — confirm before scale work.
4. **Token rotation** — two exposed tokens; rotate before wider rollout (deferred).

---

## Change: Location Inventory Count (2026-06-04 — additive, extends baseline)

> Additive brownfield change shaped on top of the completed baseline above (facilitated this session, `/10x-shape` extend-in-place). Staged: **Phase 1 = must-have core**, **Phase 2 = should-have, deferred**. Feeds the PRD's `## Scope of Change → New` (FR-015…FR-019) + a new user story (US-02). The baseline sections above are unchanged.

### Change framing

- **Current system delta** — today the Captain enters current stock **per supplier**, inline in the order screen (`/captain-v2`); there is no standalone, reusable record of "what's on site". The stock value lives only in an order line.
- **Vision delta** — add a **location-wide inventory count**: the Captain counts all of a location's products in one pass and approves it, producing a **dated stock snapshot** that can optionally pre-fill the per-supplier order screen. This makes the governing rule's "location stock counts" step **explicit and counted-once** (count all → feed many orders), instead of re-typed per supplier.
- **Primary persona** — Captain (performs the count). Manager (Phase-2 view) and Owner (Phase-2 history) consume it; no new persona.
- **Sequencing** — a **parallel early track**, independent of the Bukat email-dispatch north star; must NOT block or delay it. Ordering still works with manual stock entry exactly as today.

### Access Control delta

No change. The Captain uses the existing two-token model; the inventory screen is location-scoped from the Captain token, like ordering. (Matches baseline `## Access Control`: "No changes planned — current model preserved.")

### Success Criteria (this change)

- **Primary:** Captain opens the location-wide inventory screen → enters current stock for every Wola product in one pass → approves → a dated snapshot is saved. Later, starting a Bukat order, the Captain opts into pre-fill (confirmation names the snapshot's date/time), sees `current_stock` pre-populated (editable), and submits as today.
- **Secondary (Phase 2):** Manager can view submitted inventories; Owner can browse inventory history/trends over time.
- **Guardrails:** ordering still works WITHOUT inventory (no regression to the current per-supplier flow); no entered count is lost mid-inventory; the suggestion engine, dispatch, and `order_lines` schema are untouched.

### Functional Requirements (new)

- FR-015: Captain can open a location-wide inventory screen (all products with a `location_product_setting` at the location) and enter current stock for every product in one pass. Priority: must-have. Change: new.
  > Socrates: Counter-argument considered: "redundant with per-supplier stock entry already in the order screen." Resolution: kept — the win is **count once, reuse across suppliers**, and it matches how the operator physically counts the whole store at once.
- FR-016: Captain can approve/submit an inventory count, persisting it as a dated snapshot (timestamp + actor). Priority: must-have. Change: new.
  > Socrates: Counter-argument considered: "a snapshot store violates baseline 'no schema change in week 1'." Resolution: kept — accepted as a **separate parallel track** (two new entities behind `_choose_backend()`), not week-1 pilot scope; the pilot's data store is untouched.
- FR-017: When starting a per-supplier order, the Captain can opt in (via a confirmation that names the source snapshot's date/time) to pre-fill `current_stock` from the latest snapshot; values are editable and ordering works without it. Priority: must-have. Change: new.
  > Socrates: Counter-argument considered: "silent auto-fill could push a stale count into an order." Resolution: kept WITH a double-safeguard — pre-fill is opt-in and the prompt names which inventory (date/time) it pulls from; nothing fills without confirmation.
- FR-018: Manager can view submitted inventory counts (read-only, like the order queue). Priority: should-have. Change: new.
  > Socrates: Counter-argument considered: "the Manager already receives the order with stock embedded; a separate inventory view duplicates without pilot value." Resolution: **demoted to should-have, Phase 2** — value grows with audit / multiple suppliers; not built in the must-have core.
- FR-019: Captain/Owner can browse inventory history/trends over time. Priority: should-have. Change: new.
  > Socrates: Counter-argument considered: "snapshots are persisted regardless (FR-016); a browsing/trend UI is audit/scale value, not pilot value." Resolution: **demoted to should-have, Phase 2** — data accumulates now; the browsing surface is added when there is history worth showing.

### User Stories

### US-02: Captain counts the whole location once, then orders with stock pre-filled

- **Given** a Wola Captain with a valid token and products configured for the location
- **When** the Captain opens the location inventory screen, enters current stock for every product in one pass, and approves it
- **Then** the count is saved as a dated snapshot, and when the Captain later starts a supplier order they are offered (with the snapshot's date/time shown) to pre-fill current stock — editable, and skippable in favour of manual entry.

#### Acceptance Criteria

- The inventory screen lists every product with a `location_product_setting` at the Captain's location.
- Approving persists a snapshot carrying timestamp + actor; prior snapshots are retained.
- The order screen's pre-fill is opt-in, names its source snapshot, and never overwrites without confirmation; ordering without any inventory behaves exactly as today.

### Business Logic delta

**No new domain rule.** The governing rule — single path from location stock counts to supplier dispatch — is unchanged. This change makes the rule's **"location stock counts" input explicit and reusable** (count once → feed many orders) rather than re-entered per supplier. It is a workflow / input-surface change, not a new decision the application makes; the engine still only suggests, and a human still commits.

### Non-Functional Requirements (new)

- No entered count is lost mid-inventory on a phone or tablet under normal pilot connectivity (mirrors the baseline no-data-loss-on-submit NFR; the inventory screen is a larger single-pass form, so this matters more).

### Constraints & Preserved Behavior delta

- **New data entities:** `inventory_counts` + `inventory_count_lines`, implemented behind the `_choose_backend()` seam (mirroring the `orders` / `order_lines` pattern). This intentionally extends the baseline "no schema change in week 1" constraint — accepted because the inventory track is parallel to, not part of, the week-1 Bukat pilot.
- **Preserved:** the existing per-supplier order flow, the suggestion engine, dispatch, and the `order_lines` schema must continue working unchanged; ordering must remain fully usable with manual stock entry and no inventory.

### Non-Goals (new)

- **Auto-generating draft orders from an inventory count** — explicitly out of scope. Inventory only *pre-fills* the stock field; it never creates orders automatically (consistent with the suggest-only / human-commits governing rule).
- **Phase-2 surfaces in the must-have core** — Manager inventory view (FR-018) and history/trend browsing (FR-019) are should-have, deferred past the pilot.

### Gray areas resolved (this change)

- Doc strategy: **extend-in-place** (append here + amend `prd.md` `## Scope of Change → New`); baseline shape-notes/PRD preserved, not restarted.
- "Approve & send" = persisted snapshot **+ Manager view (Phase 2)**; no auto-order generation.
- Inventory ↔ ordering coupling = **opt-in, confirmed pre-fill naming the source snapshot**; ordering also works standalone.
- History = **full snapshots over time** (browsing UI is Phase 2).
- Sequencing = **parallel early track**, independent of the north star.
