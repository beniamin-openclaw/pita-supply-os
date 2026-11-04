# Merge proposal: waste reporting list and histories

Status: committed, locally verified and independently approved. Review the associated PR’s current productCI checks before Ben’s merge decision. Ben requested a reviewable merge handoff, not an application release.

## Exact candidate and prerequisite

Application commit: `d955721c8a486cdd4ca81b463f2b58391c6a4fa6` on `codex/supply-v2-waste-report`, based on main `02a0930e09e09648a0e75dfb22f1cb1d96006144`. The PR includes the original waste API/schema/UI and this list/history follow-up; main has neither feature yet. Subsequent commits on this lane contain documentation only. Verify the final PR head and green productCI before merge; remote main must still be the reviewed base or the updated branch must be reverified.

Migration0032 is already applied on production with Ben's separate explicit approval. Actual readback verified2tables,21constraints,5indexes,RLS2/0publicpolicies,0rows; fingerprint `cbdb193e040ca37d031afe6cd74b3c0da1bd9e72859b7ab8cf5450fdd58a9f67`. Do not reapply/drop it. See `migration-preflight.md`. No new migration, secret, dependency, environment change or manual application deployment is required for this candidate.

## What merge releases

- Captain's fourth tile opens the complete scrollable17product list, manual amounts and repeated/mixed additions, fresh Warsaw today, automatically retained scoped draft and sticky finalSave.
- Captain History has Orders/Inventory/Waste reports segments; Manager switches Inventory/Waste reports and finds the link beside Inventory in dispatch.
- Both roles select Today/Last7days/Thismonth or custom inclusive dates, inspect correct per-product/unit totals and original/void audit, and download the complete scoped CSV. Captain cannot select another location through query parameters.
- Parent atomic transaction/idempotency/exactdecimal/void contracts and existing supplier/inventory behavior are retained.

## Evidence

`verification.md`: backendRuffPASS,1250unit+45integrationPASS; frontendbuild/lintPASS,1330tests/89filesPASS. Authenticated local browser/realPostgres covered17cards, focus typing150, repeated amounts, selected-only3line save, retained draft, integrated histories, native custom-date keyboard input, CSV7/9/2rows and offline404/identical retry saving exactlyonce. Mobile320/375 anddesktop1280 had no document overflow. `reviews/impl-review.md`: both independent final reviewsAPPROVED; no unresolved findings. These are local/synthetic observations, not production usage.

## Operator action and verification after Ben merges

Merge the reviewed PR through the repository's normal flow without force-pushing. Main automatically deploys Railwaybackend andVercelfrontend. Confirm both deployment source commits/healthy artifact and the existing API rewrite; authenticated catalog17/history/CSV read-only checks must succeed under the intended role. Do not create test supplier orders or synthetic production waste. Only then ask operators to use a real loss/period, confirm persisted amounts/reasons/additions/voids/CSV and assess the provisional tiles.

No merge/deploy/restart has been performed by this task. A healthy oldapplication plus prepared schema is not live-feature evidence.

## Rollback and risks

Restore both applications to the verified pre-release main artifact `02a0930` if needed, preserving unrelated later main changes. Keep both waste tables and every recorded audit/row; no automatic DROP/DELETE or reverse migration. No historical paper report import is included. A real period, physical phones and every handwritten source cell remain unverified; six tile sets are provisional and precision beyond3decimals requires an operator decision.

Exact next step: inspect the associated PR’s productCI results and actual screenshots, then Ben decides merge. After an approved merge, verify running artifacts, record runtime results and complete operator acceptance before10xarchive.
