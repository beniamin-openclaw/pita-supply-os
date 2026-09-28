# Reconciled design decision (adversary pair, 2026-09-21)

Two subagents were run in parallel on the same bundle: a devil's advocate attacking the
proposed `suppliers.requires_transport` boolean, and a constructive critic arguing the
strongest alternative. Both reports changed the design.

## Decision

**Add a fifth `OrderingMethod` value, `transport`, instead of a new boolean column.**
`SUP_PAGO.ordering_method` becomes `transport`; `manager_dispatch` refuses any order whose
supplier carries that channel.

### Why the enum beats the boolean

1. **Pattern fit.** `ordering_method` is already the supplier-level channel switch, and
   `manager_dispatch` already treats it as the source of truth (`app/main.py:1927-1928`).
   `sent_method="transport"` is already written by `manager_transport_finalize`
   (`app/main.py:4743`) and already read by the Captain detail page
   (`pages/captain-mp/OrderDetailPage.tsx:51`). The vocabulary exists everywhere except on
   the supplier row. A boolean would add a second, orthogonal axis (channel x must-be-batched)
   to express one fact.
2. **Blast radius.** No new column, so no `_SUPPLIER_COLUMNS` edit, no `sheets.py`, no
   `seed_loader`, no seed CSV, and none of the `NOT NULL` / `Optional` binding footgun the
   `warehouse_pickup` comment warns about (`app/models.py:131-134`). The migration is an
   additive CHECK widening with an exact precedent in `0016_reason_code_*`.
3. **It dissolves an open question.** With a boolean, `ordering_method` for Pago has no true
   value: `email` sends the wrong artifact and `manual` is a lie. With the enum there is
   exactly one true value, and the question of reverting to `email` disappears.
4. **Decisive: a stale frontend fails closed.** Verified in this session: `t()` returns
   `String(key)` for an unknown key rather than throwing (`i18n/index.ts:107-113`), and
   `DispatchPanel`'s four channel branches (`DispatchPanel.tsx:138-177`) are equality checks,
   so an old bundle served an unknown channel renders **no dispatch control at all**. Under
   the boolean design a stale bundle would still see `ordering_method="email"` and render the
   live Gmail link. That link is a real `<a href>` whose click navigates to a prefilled
   compose window **before** the POST is sent (`DispatchPanel.tsx:300-315`), so the server 409
   would arrive too late to stop the mail. The enum removes that surface structurally.

### Adopted from the devil's advocate

- **The guard is unconditional**, with no `TRN-` exception. A batch member never legitimately
  reaches `manager_dispatch` (finalize is a separate route, `app/main.py:4742`), while the
  marker has at least four states that pass a naive check: a sent batch whose member was
  skipped at finalize, a cancelled batch that kept the marker, a legacy marker with no header
  row, and a `WorksheetNotFound` degrade. The marker is necessary evidence that an order
  touched a batch, never sufficient evidence that it is leaving through one.
- **The server guard protects the status row and the batch aggregate, not the mailbox.** The
  mailbox is protected only by the channel branch never rendering an e-mail composer. Both
  halves are required; neither alone is enough.
- **The frontend block stays scoped to the dispatch branch** (`OrderDetailPane.tsx:324-352`),
  never the whole pane, so post-send recovery on the three already-sent Pago orders keeps
  working.

### Accepted risk, to confirm in verification

**Data ahead of code is fatal.** A `transport` value read by a build without the enum raises a
Pydantic `ValidationError` inside `load_suppliers`, which 500s every supplier-reading screen.
This repo has already had this exact failure once, when `rounding_rule = tenth_kg` in the live
sheet crashed `main`'s enum (roadmap, S-02 Done entry). The prod sequence is therefore
migration, then deploy, then confirm the live build, then the data pass. The `.sql` file must
carry that ordering in its header and the data pass must live in its own clearly gated
section.

### Open questions, now settled

| Question | Answer |
|---|---|
| Flag on `ManagerQueueItem` plus a queue chip? | No. A `manager_claimed` order can still be folded into a batch, so the panel notice is reached before any irreversible step. Scope growth. |
| Revert `SUP_PAGO.ordering_method` to `email`? | Never again. It goes `manual` today, then `transport` once the guarded build is verified live. |
| Mark SUP_PAGO transport-only in the seed CSV? | No. Seed is the shared dev/test fixture and `CaptainPage` defaults to Pago; a dedicated `_transport_supplier()` test fixture mirrors how portal and phone are tested. |
