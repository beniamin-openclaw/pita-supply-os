---
change_id: deploy-pipeline-repair
title: Repair the broken droplet backend deploy pipeline
status: archived
created: 2026-06-10
updated: 2026-06-15
archived_at: 2026-06-15T20:54:14Z
---

## Notes

establish a real, repeatable deploy process for the droplet backend — production runs a flat rsync copy of app/ disconnected from the git checkout, so git push / git reset does not deploy (D-01 marked done but effectively incomplete); GR-01 backend was never live until a manual rsync+restart. Decide and wire the right mechanism (real git checkout + deploy script / container / documented runbook).
