---
change_id: master-data-followups
title: Master-data follow-ups carried forward from archived lanes (operator decisions + prod SQL)
status: new
created: 2026-09-13
updated: 2026-09-13
archived_at: null
---

## Notes

Collected on 2026-09-13 while archiving shipped lanes so that no open operator item disappears with
its folder. Every prod change below follows lessons.md "Master-data ops: diff before, audit after".

From `week1-feedback-targets` (archived `context/archive/2026-09-06-week1-feedback-targets/`):
- [ ] C-1 bifteki carton weight → `prod-sql.sql` section PENDING (units per pack + target back in kg)
- [ ] C-3 Coca-Cola KEN (invoices + minimum 500) → possible correction 72/96 → 48/72
- [ ] A′ Tuesday-morning snapshots: halloumi KEN/BRACKA/BROWARY, gyros BROWARY (plan §2.5)
- [ ] D Monday e-mail send (operator)

From `ken-browary-master-data` (archived `context/archive/2026-08-31-ken-browary-master-data/`):
- [ ] BROWARY: `delivery_address` = TBD, `company_name` / `company_nip` empty — fill before the first dispatch from Browary
- [ ] Confirm the 3 held items (Halloumi ×2, Gyros 15 KG) — real pieces/kg
- [ ] KEN: gyros pork vs chicken — split into two SKUs?
- [ ] BROWARY: roll size "57 na 80"
- [ ] Export KEN/BROWARY thresholds to the seed CSVs (seed ↔ prod drift is growing)
- [ ] Token rotation — open since `feedback-r4`

From `feedback-r7-tushar` (archived `context/archive/2026-07-25-feedback-r7-tushar/`):
- [ ] Verify on prod that the Gmail window shows both Intermlecz addresses in "To" and biuro@ in "CC"
- [ ] Intermlecz delivery days/hours in `suppliers`
