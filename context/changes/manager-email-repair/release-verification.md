# Production release — 6 November 2026

Status: deployed and verified; Ben's attended Gmail acceptance remains. Ben explicitly authorized deployment and activation of the four supplier email channels, with nothing sent. No production order, Gmail draft or message was created by this release or verification.

## Source and hosts

- PR: https://github.com/beniamin-openclaw/pita-supply-os/pull/86
- Candidate: `b15868bcfd4c59c7345b538dcbefce8f68f878ef`; reviewed against unchanged main `e4d4c5490d726fce10c38719c6e0fa2ebdee0ef2`.
- Merge / deployed application source: `085b81765804242ef9444f867459c12a09d28d25`, merged 11:52:25 UTC.
- Candidate CI runs `42213133059` and `42213162572`: all three product jobs passed. Merge CI `42213429402`: all three passed. Hosted AI advisory passed; findings checked against complete owning code. Existing code already provides non-Pago document filtering, manual-input fallback, shared-only catalogue selection, header-only batch union and per-location partial-failure reporting; no speculative mapping generalization added.
- Railway deployment `a169181b-9cd2-4875-ab82-064b665ab0ba`: SUCCESS, exact merge source. Image `sha256:cd91e5ea722087f8b15c937196ca7ce17026d7c0ff22e25e8db26ad7b0c09e6f`.
- Vercel Production GitHub deployment `7599452853`: success, exact merge source. Production alias serves `/assets/index-Bq4ncwke.js`, SHA-256 `e1674c1ceee2f33c95bf1c382a0c89dee8c1f5320937f67caafe8336d8501a73`; new empty-transport copy and controls observed on that alias.
- No database migration, manual restart or branch-protection change.

## Approved configuration change

At 11:53:59 UTC, the guarded `prod-sql.sql` transaction changed only `ordering_method` and appended an activation note on these four supplier rows:

| Supplier | Existing recipient retained | Minimum retained | Cutoff retained |
|---|---|---:|---|
| SUP_KUCHNIE_KRK | krakow@kuchnieswiata.com.pl | 600 PLN | 17:00 |
| SUP_KUCHNIE_KAT | krakow@kuchnieswiata.com.pl | 600 PLN | 17:00 |
| SUP_SELGROS_KRK | HoReCa.Krakow@selgros.pl | 750 PLN | 17:00 |
| SUP_SELGROS_KAT | horeca.bytom@selgros.pl | 750 PLN | 17:00 |

All four changed from `manual` to `email`. All other supplier rows and all other fields were identical in before/after snapshots. Original SQL bytes at execution had SHA-256 `70d0db267b13fd42dd6a47c6bdfc04ca28afe662ff86ae8b038bc72b0ffad7c6` (the later header comment records application). Gdańsk suppliers without confirmed contacts remain manual. Bukat, Dis-Pack and regional internal lists retain their channels.

## Production verification

The API script used only GET requests. The isolated authenticated browser allowed only GET/HEAD on the production app and blocked every other request, including Google. Browser storage was cleared and the session closed afterward.

- Direct Railway public/authenticated health: OK. Direct and Vercel-proxied Manager routes reject missing/invalid/Captain credentials: six checks returned 401.
- All ten active locations have nonempty, deduplicated Manager Pago/Mory catalogues: 4–6 Pago products and 13–15 Mory products. Previously empty Forum/Supersam/Słony catalogues now work. Captain Warsaw/city catalogue scope remains unchanged.
- All four supplier API entries and existing order details report email with the expected contact. Their local supplier catalogues remain populated. An existing claimed Kuchnie Kraków order shows the full email body with greeting, table, delivery/address instructions and company/signature metadata. Draft/send controls were not used.
- Driver configuration: three configured names and four vehicles, with saved/historical options additionally retained. Actual driver and vehicle selects populated on opening the original empty transport.
- Read all 12 non-cancelled transport summaries/details: member counts agree; no cancelled member returned; every aggregate equals the sum of its location quantities.
- “Do połączenia” collapses. Supersam Pago and Mory product pickers populate in the original empty transport. No product was added there.
- Original empty transport blocks both PDFs, both draft actions and mark-sent. A temporary unsaved quantity edit on the positive TEST transport disables both PDFs and draft controls; the edit was restored without saving.
- The positive combined TEST transport downloads an actual driver PDF with both warehouse blocks and the correct per-location quantities, and a supplier pickup PDF with only Pago rows. Both are readable and all text is within page bounds; inspected rendered pages.
- A historical five-location combined transport downloads a two-page landscape driver PDF; all text is within bounds and both pages inspected. Three production PDF downloads in total. Browser console: zero errors/warnings.
- Counts before/after: 591 orders, 4561 lines, 79 order events, 20 transport headers, 284 transport events. The complete header/orders/lines/events snapshot of `TRN-20261106-PAGO-99710a` has identical SHA-256 before and after: `ac5068c31e4a95f8d870f2c84055aa36fafa37b182d8866249d5874e51f40748`. Its zero quantities require deliberate operator input; no automatic backfill.

Local prevention evidence remains in `testing.md`: 24 additional permanent cases in the existing CI suites, old-code failures demonstrated, 18 Warsaw/regional/mixed-city scenarios on copied real master data, 74 mail/list previews, 37 PDF bounds checks and local browser/API/Postgres draft flows with Google intercepted. Local tests cover writes/finalization/failure recovery; production verification deliberately does not create real supplier work.

Private evidence directory: `/Users/ben/Documents/Codex/2026-11-06/manager-email-repair/`. Release records: `release-provider-verification.json`, `release-email-activation.json`, `release-production-api-verification.json`, `release-browser-and-data-verification.json`, `release-production-pdf-verification.json`, private before/after database snapshots and browser evidence. No credentials in committed artifacts.

## Rollback and next step

No schema rollback. If required, review a source revert of PR #86 against current main; baseline before release was `e4d4c549`. Preserve all orders/history and the preceding waste-report release. Previous Railway deployment was `3a1f6f58-55b5-4854-bd12-09604d34cab4`, image `sha256:f8b3d4d3bbe53a38c1bcafa7a0d04725a0ecd363d26a1140138739d1be79bcd9`; recheck provider availability before using it. Use `rollback-sql.sql` only after a fresh configuration audit to restore the four channels to manual. Prefer forward correction if new city warehouse work depends on the patched add-product flow. No rollback was run.

Exact next step: Ben reloads https://pita-supply-os.vercel.app/manager/transport and walks through Warsaw, one regional location and a combined Pago/Mory transport: select products, set quantities, save, compare both PDFs, then inspect actual Gmail drafts/account/alias without sending. The previously empty transport stays empty until those quantities are set. Real Google OAuth consent, alias permission and popup behavior remain unproven by the intercepted local tests. Missing Gdańsk contacts and main-branch CI enforcement remain separate decisions; do not substitute another city's email or claim CI cannot be bypassed.
