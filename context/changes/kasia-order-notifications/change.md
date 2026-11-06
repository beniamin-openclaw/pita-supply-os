---
change_id: kasia-order-notifications
title: Immutable Captain submission source for Kasia ingestion
status: implemented
created: 2026-11-06
updated: 2026-11-06
archived_at: null
---

## Scope and ownership

Task 1 only, owned by the Supply implementation agent in worktree
`/Users/ben/.codex/worktrees/kasia-supply-notifications/10xDEVS`, branch
`codex/kasia-supply-notifications`, based on `e4d4c549`. The main agent owns the
Kasia consumer, integration review, operational state and all production decisions.
No frontend, production, external send, deploy, push or merge is included here.

## Result

Capture defaults off. With capture enabled, a dedicated nonempty token, an aware
start instant and a backend declaring submission support are required; invalid
configuration or unsupported persistence returns 503 before writing the order.
Captain submissions before a configured future start keep the legacy persistence
path. From that instant, the Supabase backend commits the order, lines and one
notification snapshot in one transaction. A failed write cannot return the legacy
read-only success response. Manager transport skeleton creation and later order
edits/status transitions do not create or rewrite snapshots.

The immutable snapshot has exactly `order_id`, `location_id`, `location_name`,
`supplier_id`, `supplier_name`, aware ISO `submitted_at`, ISO day or null
`requested_delivery_date`, and integer `line_count`. It contains no staff names,
notes, line details, Telegram credentials or delivery claims.

Migration 0034 adds `order_submission_events`, an order FK, pending/time indexes,
RLS without public policies and an update trigger protecting the snapshot,
submission instant and order identity. It updates no historical orders and
backfills nothing. The migration is rerunnable without changing existing events.

## Integration contract

- `GET /api/integrations/order-submissions` requires the dedicated Bearer token.
  Pending mode returns the oldest 100 un-ingested snapshots, ordered by
  `submitted_at`, then `order_id`, with `items`, `truncated`, `capture_started_at`.
- Paired aware `since` and `until` select all snapshots, including ingested ones,
  in `[since, until)`, for a positive window of at most 48 hours. The first 1000
  are returned, with `truncated=true` if more exist. A truncated window cannot
  support a complete-report claim. Validation failures return 422.
- `POST /api/integrations/order-submissions/ack` accepts 1..100 unique nonempty
  string `order_ids`. Unknown IDs return 400 before any partial update. ACK is
  idempotent, preserves the first `ingested_at`, returns `acknowledged`, and
  changes neither the snapshot nor the order. It records ingestion only.
- Missing/disabled configuration returns 503 and invalid auth returns 401. The
  integration token is explicitly rejected on Captain, Manager and master-data
  routes, including local configurations where business auth is disabled.

Pending truncation is drained by durably ingesting and acknowledging each oldest
100 before fetching the next batch. No cursor or delivery-status field is added.

## Verification

- Meaningful unit RED before implementation: 31 failed, 2 passed, proving missing
  configuration/routes, non-atomic capture and the integration-token role gap.
- Focused final unit tests: 34 passed.
- Full final backend suite: 1299 passed, 60 integration tests deselected.
- Full real-Postgres integration suite: 60 passed. Covers line/event failure
  rollback, immutable fields, actual RLS role denial, migration rerun, API auth,
  capture, idempotent ACK, atomic unknown-ID rejection, ingestion/window reads,
  pending ordering/drain and 100/1000 overflow flags.
- Ruff and `git diff --check`: passed. No dependency files changed.

All DB checks used a newly initialized disposable local Postgres 16 cluster at
`127.0.0.1:55437`, database `kasia_supply_test`. No production data was read or
mutated. The temporary environment emitted one dependency deprecation warning
from Starlette's HTTPX TestClient; it did not affect assertions.

## Blockers, rollback and exact next step

This is a local implementation, not an activated integration. Production schema,
settings, credentials, real Captain capture and the separate Kasia consumer have
not been verified. Main-agent review and separate production approval remain.

Safe stop: leave `SUPPLY_OS_ORDER_NOTIFICATIONS_ENABLED=false`. After any approved
activation, disable capture/consumer scheduling to stop processing while retaining
events and ingestion receipts; do not reset the start instant or receipts when
resuming. Roll back code with capture disabled, preserving the additive table.

Exact next step: the main agent reviews this commit against the consumer, then
prepares the separately approved rollout: migration 0034 first, code with capture
off, dedicated secret token plus one explicit aware start instant, source/consumer
activation and a production-safe end-to-end verification. No rollout ran here.
