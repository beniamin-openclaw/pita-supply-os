---
change_id: captain-small-fixes-1017
title: Captain small fixes — receipt "who received" message, inventory draft per location, Coca-Cola KAT crates prompt
status: implemented
created: 2026-10-17
updated: 2026-10-17
---

## Trigger

Operator feedback backlog items N4, N19, N13. N4: on 2026-10-03 a Captain photographed a delivery and could not confirm the receipt; the confirm button was disabled with no explanation because the "received by" name was empty. N19: the inventory draft was stored under one fixed localStorage key, shared by all locations on a device. N13: the empty-crates prompt covered only `SUP_COCACOLA`, not Katowice's `SUP_COCACOLA_KAT`.
