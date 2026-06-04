---
project: "Pita Supply OS"
version: 1
status: draft
created: 2026-06-04
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

---

## Problem Statement & Motivation

The shipped v0 works, but the day-to-day ordering workflow still carries four operator-confirmed pains:

- **Send pain** — a single ordering cycle takes ~30–60 min spread across portals, Excel, GoStock, and email.
- **Decision pain** — the Captain's judgment about *why* a quantity was chosen lives in WhatsApp, not in the order.
- **Memory pain** — there is no durable record of the reasoning behind quantities.
- **Unit pain** — kg vs cartons/pieces across tools causes silent conversion errors.

**Why now:** v0 is shipped, and the operator is moving the live pilot from **Pago** (used for docs/tests) to **Bukat** with **email** dispatch — to prove the two-role flow end-to-end on one real supplier before a gated rollout (week 2 suppliers → +2 locations → company-wide).

**Current workaround and its cost:** ordering is done manually across multiple tools (portals / Excel / GoStock / email) with WhatsApp carrying the decision context — ~30–60 min per cycle and no durable "why."

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

---

## Scope of Change

The 14 functional requirements from shaping, categorized by change type. FR-NNN identifiers and Socratic resolutions are preserved as load-bearing for downstream review. No requirements are removed.

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

### Modified

- **[modified] FR-002** — Captain can select supplier **Bukat** and see Wola product lines for that supplier (pilot pivots the active supplier to Bukat). Priority: must-have.
  > Socrates: No counter-argument; stands as written.
- **[modified] FR-010** — Manager can dispatch a Bukat order **via email** (email draft; pilot dispatch channel). Priority: must-have.
  > Socrates: No counter-argument; stands as written.
- **[modified] FR-012** — Owner can verify and correct **Bukat** master data and suggestion outcomes so the recommendation engine is trustworthy for pilot products. Priority: must-have.
  > Socrates: Sheet-edit consistency risk noted; operator not convinced — stands as written.

### New

- **[new] FR-014** — Manager can filter or narrow the order queue (supplier, location, status). Priority: must-have by week 2.
  > Socrates: N/A (added from the FR-006 resolution).

---

## Constraints & Compatibility

**Backward compatibility (must keep working):**
- Existing production routes `/captain-v2` and `/manager`, and the Captain → Manager queue → save/dispatch flow.
- Two-token authentication and the existing order status workflow.
- The suggestion math remains visible to the user.

**Data:**
- No schema change planned for the baseline. The existing data-store schema, the order-line history columns, and secrets-kept-off-repo all stay as-is. No data migration or backfill in week 1.

**Existing integrations / behavior that must not regress:**
- Email dispatch continues to work.
- The production regression suite continues to **back out on submit** (no real supplier orders placed during tests).

**Tiered preservation (from shaping):**

- **Tier 1 — do not break:** prod routes `/captain-v2`, `/manager`; Captain → queue → save/dispatch; visible suggestion math; data-store schema + off-repo secrets; order-line history columns; status workflow; two-token auth; regression-suite back-out on submit.
- **Tier 2 — preserve unless scoped:** the Manager V2 capabilities (G1–G3); the existing deployment topology (API service + web/proxy at `/api`); tests run before deploy; the Bukat pilot boundary; work stays on a branch until merge.
- **Tier 3 — improve freely:** engine and master data (Bukat first, then Pago SKUs); supplier contacts; docs; PR #8; the G4 history backlog.

---

## Business Logic Changes

**No new domain rule — the governing rule is reaffirmed for the baseline.** The change is pilot-scope (Pago → Bukat, email dispatch), not a change to domain logic; the engine stays suggest-only.

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
- **Guest / customer-facing restaurant ordering** — Supply OS is internal supplier ordering only.
- **GoStock integration, receiving/WZ, finance/KSeF, predictive AI** — per existing roadmap postponements.

**Non-functional non-goals (quality dimensions week 1 will NOT aim for):**

- **Per-manager identity / audit-by-person** — a shared Manager token is acceptable for the pilot; history records a generic "manager" actor.
- **Multi-location / company-wide scale hardening** — week 1 is Wola-only; per-manager auth, concurrency, and scale hardening are gated to later rollout stages.

---

## Open Questions

1. **Who holds the Manager token at Wola day-to-day** — staff vs owner during the pilot (shared token; no per-manager identity yet). *Blocking for pilot start.*
2. **Bukat master-data readiness** — ready for week 1, or does it need a prep pass before the Captain pilot? *Blocking for pilot start.*
3. **End-state scale** — frontmatter `users: small` (pilot); company-wide rollout is likely `medium` — confirm before scale work.
4. **Token rotation** — two tokens were exposed earlier; rotate before wider rollout (deferred).
