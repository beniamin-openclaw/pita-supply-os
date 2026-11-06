---
change_id: manager-email-repair
title: Manager email lists and city transport editing
status: verified_locally_awaiting_release_approval
created: 2026-11-06
updated: 2026-11-06
---

Ben requested repair of Marek's manager-email report, checks for other cities, and transport fixes from four browser annotations. No production release, configuration write, message sending or supplier order has been approved in this chat.

Confirmed on production, read-only:

- Marek's 5 November screenshot shows the copy list, not the complete email. The old list prints the internal name and repeats the supplier name under `Kod`; this is not an actual supplier code. Both dispatch and post-send copy duplicated the formatter and omitted off-catalogue extras.
- Kuchnie Świata and Selgros in Kraków/Katowice have confirmed email addresses but `ordering_method=manual`, selecting copy-list UI without email greeting, signature or Gmail. Marek supplied the contacts in his 15 October reply (thread `1a135645196a2f71`). Current minima are 600/750 PLN and cutoff 17:00; notes preserve the older hold pending terms. `prod-sql.sql` proposes exactly four guarded channel changes using those existing addresses; it has NOT run on production.
- Bukat Kraków and Dis-Pack Kraków/Katowice already use email. Dis-Pack's later description of website ordering remains a workflow question; no change proposed for it. Gdańsk Blue Service/Kuchnie/Selgros have no email contact. Coca-Cola was described as WhatsApp ordering. No other city's contact was substituted. Regional combined orders from Warsaw remain manual internal lists.
- API previews checked 74 real order snapshots (73 across active locations plus one inactive Poznań sample): no duplicated product IDs. Active-location samples carry company/address/phone/signers/mailbox metadata. Active catalogue groups have names/units. This does not validate every historical order, invoice pack, delivery calendar or Gmail alias.
- Transport `TRN-20261106-PAGO-99710a` had six member orders, zero positive aggregate lines and all saved quantities zero. Supersam's Pago/Mory orders and Gdańsk's Pago order had no lines. The backend correctly refused finalization; the UI still offered empty PDFs and a doomed draft attempt.
- Own-city catalogues hid shared Pago/Mory rows from Manager orderable/add-line/prefill, leaving city columns empty with no product picker. Grid creation with both suppliers selected added only the lead Pago order. Driver/vehicle configuration is populated, but a form mounted before its arrival could stay in manual-input mode.

Changes:

- Shared copy-list formatter: one supplier product name with internal-name fallback, existing sort/quantity/case and explicit-zero handling, plus parsed off-catalogue rows. Header is `Produkt | Ilość`. Both dispatch and post-send copy use it; full email formatting remains unchanged.
- Manager-only Pago/Mory shared-catalogue fallback when the location has no scoped rows for that warehouse. Same helper covers listing, add-line validation and prefill. Captain catalogue isolation and other suppliers retain their existing rules.
- New grids create both Pago and Mory orders when both are selected. Products prefill from the location's configured items, at zero; quantities still require deliberate entry and save. No automatic production backfill or import of regional combined Captain orders.
- Driver/vehicle selects recover when their dictionaries arrive after mount, retaining the manual escape hatch.
- “Do połączenia” collapses with an accessible toggle and preserves selection. Existing all-location availability is intentional prior operator policy and remains unchanged.
- Empty documents cannot be downloaded or drafted. Unsaved quantities/logistics block PDFs. Empty draft transports cannot be marked sent. Supplier-document checks respect Pago warehouse filtering and explicitly approved extras; driver lists retain meaningful extras-only content.

Verification (candidate on `codex/manager-email-repair`, based on main `e4d4c549`):

- Backend Ruff PASS; 1266 default tests PASS; 54 integration tests PASS on a disposable local PostgreSQL 16 database.
- Frontend build/lint PASS; all 1355 tests across 90 files PASS. Existing bundle-size warning remains.
- Real-data message/list previews for 74 snapshots PASS (including email greetings/footer/rules; no oversized fallback URL among email-channel samples). Eight real PDF files generated from four positive captured transports; Warsaw reference visually checked.
- Local read-only-source clone: 196 products, 30 suppliers, 13 locations, 632 supplier products, 1577 settings, 28 delivery rules, 88 orders and five captured batches. Actual FastAPI/PostgreSQL plus browser: created a six-order Pago/Mory grid for Forum/Supersam/Słony Spichlerz; edited/saved quantities; added unconfigured Gyros 25 KG to Supersam; selected/saved configured driver/vehicle/date/time. Asserted saved sums 6 Gyros 15 KG, 2 Gyros 25 KG and 15 Boxy PB, correct location/supplier attribution, all orders still claimed, no draft-created events. Both browser PDF downloads succeeded and their rendered pages were visually checked: supplier PDF contains only Pago totals; driver PDF contains both warehouses with correct location quantities. Synthetic tokens and local database only.
- Four-row SQL dry run PASS; second application and changed-contact drift abort atomically. Forward channel change and rollback also passed on the real-schema local clone; repeated rollback is rejected. No production write, Gmail draft, message send, real supplier order or runtime change.

Private evidence: `/Users/ben/Documents/Codex/2026-11-06/manager-email-repair/`. No credentials stored in this change folder. Browser PDFs for review are local test documents.

Release proposal: after Ben's explicit approval, publish this reviewed backend/frontend change and optionally apply `prod-sql.sql` for the four named suppliers. No schema migration. Recheck current main, CI, contacts/terms and deployed artifacts before claiming live; preserve existing transports/orders. Verify public UI/API read-only, then Ben tests actual Gmail popup/mailbox/alias and quantities step by step. Sending any email remains separately approved per exact content/recipients.

Rollback: revert this code change through a reviewed release; preserve all orders/history (new city warehouse lines may need the patched version to add further products). If the four channel changes need reversal, run `rollback-sql.sql` only after a fresh state check; it restores manual channels and records the reversal without touching orders/drafts. Prefer forward correction if new work relies on these flows.

Blockers/exact next step: Ben's production decision, then live artifact verification and attended Gmail/manual acceptance. Gdańsk email contacts remain missing; do not enable guessed recipients. This is a locally verified candidate, not a completed production fix.


## Expanded regression audit — 2026-11-06

Ben requested a prevention plan and independent full checks before deciding on production. Executed plan/results: `testing.md`. Added 24 permanent cases to existing CI suites; 1269 backend, 69 real-Postgres integration and 1361 frontend tests plus lint/build pass. Before/after evidence includes failing old-code tests and 18 scenarios on copied production master data (all 10 active locations, both single warehouses and combined transports), 74 message/list previews, 36 transport PDFs plus a 13-column layout case, and a real local browser/API/database flow with Google requests intercepted.

This audit found two additional defects and fixed them: cancelled transport members still appeared as cargo/blocked adding a location again, and wide driver PDFs overflowed portrait A4. New route/integration/layout tests cover those failures. All 37 new PDFs have text inside page margins; representative rendered pages checked visually. Correct-account order/driver test MIME payloads have PDFs and exact recipients, and record two events only in local Postgres; wrong-account attempt leaves the batch draft. No actual Google account consent or alias acceptance is proven.

Current read-only production check still shows the old catalogue/channel defects; nothing deployed or changed there. GitHub reports main unprotected: the CI runs on push/PR but is not enforced. Requiring the three existing CI jobs is proposed policy, not applied. Exact next step: Ben's scoped production decision; then release artifact verification and real Google acceptance. No messages or real supplier orders sent.
