---
change_id: transport-location-columns
title: Transport draft matrix — one column per location when a batch holds two orders from one location
status: implementing
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

Lane M item 4 of `porzadek-2026-10` (`context/changes/porzadek-2026-10/contracts.md`, D10 A):
"a test that reproduces two Transport columns with the same header; if confirmed, merge the
columns per location". Source: crosscheck S25 (inferred from code, not reproduced).

Confirmed on 17.10 by a Vitest reproduction: `manager_transport_create` has no per-location
dedupe (pytest locks that both same-location orders join and stay separate in the batch
detail), and the draft matrix keys columns by member order, so two KEN orders render two
identical "Ken" headers, two identical add-one options and two identical remove buttons. The
sent view, the driver PDF and the aggregate already merge per location.
