# Plan — supplier-email-v21 (Lane E)

## Goal

The per-order supplier e-mail (single-order dispatch path, not Transport) gets the layout Ben asked
for on 12.10, the delivery date is ready to switch on, and the manager has one "Wyślij" button that
creates the verified Gmail draft and opens that draft.

## Current state (grounded)

- Two builders, byte-identical by contract: `supply-os-v1/app/gmail_url.py::_build_body` (server
  re-open URL) and `frontend/src/pages/manager/lib/emailBody.ts::buildEmailBody` (the text that is
  actually drafted). Shared golden fixtures `supply-os-v1/tests/fixtures/order_email/*.json|txt`,
  rendered by `tests/test_order_email_golden.py` and `emailBody.golden.test.ts`.
- Footer order today: delivery block → `Pozdrawiam,` + signer → company name/address/NIP →
  `(zamówienie #id)` (`gmail_url.py:365-388`, `emailBody.ts:209-229`). Ben (W62): "najpierw dane
  firmy, a potem stopka".
- Off-catalogue items (`order.extra_items`, one item per line, serialised by the Captain UI as
  `{name} - {qty} {unit}`, `captain-mp/lib/extraItems.ts`) print as a separate
  `Pozycje spoza katalogu:` section (`gmail_url.py:340-343`, `emailBody.ts:183-188`). Ben (W66):
  rows in the product table.
- Delivery date: behind `settings.order_email_delivery_date_enabled` (`config.py:104`, default off),
  surfaced to the client as `ManagerOrderDetail.delivery_date_in_email` (`main.py:1644`) and passed
  to the server builder (`main.py:2664`). Already covered by golden `bracka_bukat`.
- Draft flow: `DispatchPanel.EmailDispatch.handleDraft` → `createVerifiedOrderDraft` → `onDispatch`
  with `{draftMailbox}` → `ManagerPage.handleDispatch` stores `draftedOrders[orderId] = mailbox` →
  `OrderDetailPane.DraftedLine` links to `gmailDraftsUrl(mailbox)` = the Drafts folder
  (`orderEmailDraft.ts:206-208`). The email panel shows up to four buttons: "Zrób draft w Gmailu",
  "Otwórz w Gmail", "Kopiuj treść", "Kopiuj adres".
- `createGmailDraft` (`gmailDraft.ts:500`) returns only the draft id; the Gmail API response also
  carries `message.id`.

## Phase 1 — WP1 layout in both builders (+ D2 check)

New body layout (blank lines exactly as shown; blocks with no data are skipped with their blank line):

```
Dzień dobry,

proszę o przygotowanie zamówienia:

Lp. | Produkt | Ilość
1.  | Pomidor | 18 kg
...
7.  | Serwetki (spoza katalogu) | 5 opak
8.  | Mięta 2 pęczki (spoza katalogu)

Komentarz:
<captain note>

Dostawa: wtorek 29.09.2026, od godziny 11:00
ADRES DOSTAWY: ...
Telefon lokalu: ...

<company_name>
<company_address>
NIP: <company_nip>

Pozdrawiam,
<signer name | Pita Bros>
<tel. … · email>
(zamówienie #<order_id>)
```

Rules:
1. Off-catalogue rows continue the `Lp.` numbering after the catalogue lines, in the order they were
   typed. Each non-blank line of `extra_items.strip()` is one row. The line is split at the FIRST
   `" - "` (same rule as `parseExtraItems`): left = product cell, right = quantity cell, both
   verbatim (trimmed). The product cell gets the marker suffix ` (spoza katalogu)`. A line without
   `" - "` (or with an empty right side) is a row with no quantity cell:
   `N.  | <text> (spoza katalogu)` (no trailing ` |`). Plaintext has no colour, so the marker is the
   highlight; the draft MIME stays text/plain.
2. The `Pozycje spoza katalogu:` section is removed.
3. The company block (name, then address, then `NIP:`) moves BEFORE `Pozdrawiam,`, separated by a
   blank line from the delivery block and from the sign-off. Same gate as today: printed only when
   `company_name` is set; address/NIP lines only when set.
4. `(zamówienie #id)` stays the last line.
5. Builders stay pure; the Python and TS helpers that split an extra-items line are twins
   (`_extra_item_rows` / `extraItemRows`), each with a "twin of" comment.

D2: no code change to the date logic. Update the stale `config.py` comment (delivery-calendar is
live; D2 decided 17.10 to switch it on) — the default stays `False`, the operator flips Railway.

Fixtures / tests:
- Re-generate the four existing `.txt` goldens for the new footer order; `ken_edge_cases` also shows
  a no-separator extra row ("Mięta 2 pęczki").
- New golden `bracka_extras_date` (date switch ON, signer, company, phone, two extras with
  `" - "`, one without, captain note) — the D2 + WP1 combination Ben will see on prod.
- Update the unit tests that pin the old order/section: `test_gmail_url.py` (≈470-504, 640-710),
  `emailBody.test.ts` (≈104-122, 170-225), plus `test_manager_dispatch.py:850` if affected.
- Add unit tests for the line splitter edge cases on both sides (first-separator rule, `"a - "`
  empty tail, blank lines skipped, whitespace trimmed).

## Phase 2 — WP3 one "Wyślij" that opens that draft

1. `gmailDraft.ts::createGmailDraft` returns `{ id, messageId }` (`messageId = data.message?.id ?? ""`).
   Transport callers ignore the new field (additive; transport-v2 untouched).
2. `orderEmailDraft.ts`:
   - `createVerifiedDraftWithToken` returns `{ id, messageId }`; `createVerifiedOrderDraft` returns
     `{ draftId, messageId }`.
   - New `gmailDraftUrl(mailbox, messageId)` →
     `https://mail.google.com/mail/?authuser=<mailbox>#drafts?compose=<messageId>`; empty messageId
     → `gmailDraftsUrl(mailbox)` (folder, today's behaviour).
     Evidence: the `#drafts?compose=<message.id>` form is the documented-by-community way to open an
     API-created draft (Stack Overflow 24548210, 64022899, 65250194); one 2020 report says it opened
     an empty compose for an account without conversation view. So it must be checked live on
     biuro@ (operator step), and the drafts-folder link stays available as a backup.
3. `DispatchPanel.EmailDispatch` (when `draftAvailable`):
   - One primary button "Wyślij" (new i18n `manager.draft.send`) = the existing `handleDraft`
     (popup first, verified draft, then dispatch). Busy label unchanged ("Tworzę szkic…").
   - A one-line hint under it: "Tworzy szkic w {mailbox} i otwiera go — wyślesz go z Gmaila."
     (the app never sends; the button wording is Ben's, the hint keeps it honest).
   - "Otwórz w Gmail", "Kopiuj treść", "Kopiuj adres" and the fallback hint move into a collapsed
     `<details>` "Inne opcje" (new i18n). Same behaviour inside (the link still dispatches on click
     and stays inert while drafting/busy).
   - Without `draftAvailable` (no OAuth client / no mailbox+sender) the panel stays exactly as today.
   - `onDispatch("email", signerEmail, { draftMailbox, draftUrl })` — `DispatchOpts` gains `draftUrl`.
4. `ManagerPage.handleDispatch`: after a successful dispatch with `opts.draftUrl`, store
   `{ mailbox, url }` in `draftedOrders` and try `window.open(url, "_blank", "noopener")` (try/catch,
   like `TransportSendPanel.tsx:641`). Open only AFTER the dispatch succeeded, so the manager never
   holds an open draft for an order the app did not mark as sent. A popup blocker may stop it (the
   Google sign-in popup consumes the click); then the success line is the way in.
5. `OrderDetailPane.DraftedLine`: link "Otwórz szkic" → that draft's URL; keep a smaller
   "Otwórz szkice" folder link next to it as backup.
6. `ResendPanel` (dosyłka draft): success line links to that draft too (same helper); it never
   dispatches — unchanged.
7. Not touched: Transport send panel / undo-send ("Cofnij wysłanie"), the server compose URL
   (`gmail_compose_url`) and its "Otwórz email" link, portal/phone/manual/transport branches.

Tests:
- `orderEmailDraft.test.ts`: `gmailDraftUrl` (encoding, empty-id fallback); verified draft returns
  `messageId`.
- `gmailDraft.test.ts` (if it covers createGmailDraft) / mocks updated for the new return shape.
- `DispatchPanel.draft.test.tsx`: one primary "Wyślij"; secondary actions inside "Inne opcje";
  dispatch receives `draftUrl`; failure → no dispatch; no-client-id path unchanged; transport branch
  unchanged. Update `DispatchPanel.test.tsx` selectors if needed.
- A `ManagerPage`/`OrderDetailPane` test only if one already covers `DraftedLine`; else
  covered by the DispatchPanel opts test + manual check.

## Phase 3 — operator list + docs

`context/changes/supplier-email-v21/operator-steps.md`:
1. After the PR is merged and the new Vercel bundle + Railway deploy are confirmed:
   set `SUPPLY_OS_ORDER_EMAIL_DELIVERY_DATE_ENABLED=true` on Railway (backend restarts).
2. Live check on one Westfield or Wola order (draft only, do not send unless it is a real order):
   subject carries "– dostawa <dzień> <dd.MM>"; body shows the date, company block before
   "Pozdrawiam,", any off-catalogue item as a numbered row with "(spoza katalogu)"; "Wyślij" opens
   that draft in biuro@ (else note what opened: drafts list / empty compose); "Otwórz szkic" works.
3. WP2 note: "od godziny 11:00" is hardcoded at `gmail_url.py` (delivery line in `_build_body`) and
   `emailBody.ts` (delivery line in `buildEmailBody`); Westfield needs 10:00 — waits for Marek.

Also update the S-02 notes / docstrings that describe the old layout.

## Verification

- `python -m pytest` (seed), `ruff check .`, `npm run build`, `npm run lint`, `npm run test`
  (Homebrew node), i.e. `/verify`.
- Opus impl-review (review-opus-xhigh) on the diff; fix every finding.
- PR with green CI. Ben checks on prod only.

## Risks

- Builder drift: mitigated by the shared goldens (one new scenario covers every new rule).
- Draft deep link may open the drafts list / an empty compose on some Gmail settings: backup folder
  link stays; operator live check.
- Supplier parsing: suppliers read the table by eye; the marker makes extras visible. No supplier
  system parses these e-mails (no evidence of any).
- Lane M overlap: `ManagerPage.tsx`, `OrderDetailPane.tsx`, `ResendPanel.tsx` are Lane M files;
  edits are small and local (draft-link plumbing only). Rebase on `main` before the PR.

## Plan-review resolutions (reviews/plan-review.md, all accepted)

1. **Blocker — detect a blocked auto-open.** `ManagerPage` opens with `window.open(url, "_blank")`
   (no `noopener`, then `w.opener = null`) so a block is visible (`null`). `draftedOrders` becomes
   `Record<string, { mailbox: string; url: string; opened: boolean }>`; `OrderDetailPane` prop
   `draftedMailbox` → `drafted`. When `opened === false`, `DraftedLine` is amber and persistent:
   "Szkic NIE jest jeszcze wysłany — Otwórz szkic i kliknij Wyślij w Gmailu". The success toast says
   the e-mail still has to be sent from Gmail. The hint under "Wyślij" says "jeśli przeglądarka
   pozwoli". Operator check covers first-send-after-reload (amber + second click) and a second order
   with a cached token (tab opens). Pre-opening `about:blank` is NOT done in this lane.
2. **Extras splitter — one algorithm, copied by both twins:**
   ```
   for raw in extra_items.split("\n"):          # never splitlines()
       line = raw.strip()                       # JS: raw.trim(); removes "\r"
       if not line: continue
       i = line.find(" - ")                     # on the trimmed line
       if i < 0: product, qty = line, ""
       else: product, qty = line[:i].strip(), line[i+3:].strip()
       if not product: product, qty = line, ""
       row = f"{n}.  | {product} (spoza katalogu)" + (f" | {qty}" if qty else "")
   ```
   `"Mięta - "` trims to `"Mięta -"` (no separator) → `Mięta - (spoza katalogu)`; a name with two
   separators splits at the first (`Sos - ostry - 2 l` → `Sos` | `ostry - 2 l`), pinned deliberately.
3. **Shared edge golden** `extras_edge_cases` (CRLF, blank and whitespace-only lines, padded lines,
   trailing `" -"`, two separators, no separator, zero visible catalogue lines → numbering from 1).
   Both new scenario names added to the presence checks on both sides.
4. **Tests:** `ManagerPage.draftLock.test.tsx` selector renamed + `window.open` spy (URL asserted;
   `null` → amber line); `orderEmailDraft.test.ts` mock returns `messageId`, asserted with
   `toStrictEqual`; `DispatchPanel.draft.test.tsx` asserts `draftUrl` value and closed `<details>`
   (`not.toBeVisible()`).
5. **Deep link:** helper named `gmailDraftOpenUrl`; empty/undefined id → folder URL; module switch
   `OPEN_SINGLE_DRAFT = true` for a one-line revert; operator check includes edit-then-reopen.
6. **Nits:** `manager.draft.create` keeps "Zrób draft w Gmailu" (dosyłka); new keys
   `manager.draft.send`, `.sendHint`, `.moreOptions`, `.openDraft`, `.notSentYet`; the
   `(spoza katalogu)` marker is a literal in both builders; the too-long banner shows only when the
   draft path is unavailable; stale comments fixed in `extraItems.ts`, `.env.example`, `config.py`,
   both builder docstrings; `npm ci` in the worktree before `/verify`.
7. Dosyłka e-mails get the new layout too (same builder) — one dosyłka check in operator steps.

## Progress

- [x] Phase 1 — WP1 layout in both builders, 6 shared goldens (2 new), D2 checked with the date ON.
- [x] Phase 2 — WP3 one "Wyślij" → that draft (`#drafts?compose=<message.id>`), amber line on a
  blocked tab, secondary actions behind "Inne opcje", ResendPanel links the one draft.
- [x] Phase 3 — `operator-steps.md`, comments, WP2 note.
- [x] Impl-review (`reviews/impl-review.md`, APPROVE WITH FIXES) — resolutions below.
- [ ] Operator: Railway flag + live check (`operator-steps.md`), then `/10x-archive`.

## Impl-review resolutions (reviews/impl-review.md)

- S1 fixed: `ManagerPage.draftLock.test.tsx` holds the dispatch pending (no `window.open` yet)
  and rejects it (409 → no tab, no draft line, `dispatchFailed` toast).
- S2 fixed: the "no extras" tests assert no `(spoza katalogu)` and the exact table end; the
  whitespace-only field case is in both splitter tables and has a backend body test.
- S3 fixed: drafted orders are mirrored to sessionStorage (`loadDraftedOrders` /
  `saveDraftedOrders`, per tab), the queue card shows an amber "Szkic niewysłany" chip while the
  draft tab has not opened, and clicking "Otwórz szkic" clears the line + chip.
- N2 fixed (a folder link says "Otwórz szkice"), N5 (raw docstring), N8 (flag comments say
  "to be set"), N9 (operator steps: 10 underscores, `OPEN_SINGLE_DRAFT` is a code change +
  deploy, dosyłka layout/date check, reload/chip check), N10 (status + this section).
- Not changed: N1 (exotic Unicode whitespace, not typed), N3 (the toast already says to send
  from Gmail; the amber line carries the warning), N4 (the over-long note on the draft path —
  follow-up), N6 (defensive branch kept for twin symmetry), N7 (test-name precision).
