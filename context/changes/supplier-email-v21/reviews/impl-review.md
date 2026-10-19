<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: supplier-email-v21 (Lane E)

- **Plan**: `context/changes/supplier-email-v21/plan.md` (including "Plan-review resolutions")
- **Scope**: WP1 + D2 + WP3. Uncommitted working tree on `claude/magical-moser-8c09a0`, base `7b03cf9`: 24 modified files plus the untracked fixtures `bracka_extras_date.*` and `extras_edge_cases.*`.
- **Date**: 2026-10-17
- **Verdict**: **APPROVE WITH FIXES**
- **Findings**: 0 blocker, 3 should-fix, 10 nits

Severity mapping: blocker = CRITICAL, should-fix = WARNING, nit = OBSERVATION.

The code does what the plan and all seven plan-review resolutions ask, and I found no defect in the shipped behaviour:
- the twin builders are byte-identical on every input a Captain can type;
- the draft tab opens only after a successful dispatch;
- the popup-first gesture and transport-v2 are untouched.

The should-fix items are two test gaps on the key WP3 and WP1 properties, plus one residual risk carried over from the plan-review blocker.

## Verification run (this review)

| Check | Result |
|---|---|
| `cd supply-os-v1 && python3 -m ruff check .` | All checks passed |
| `python3 -m pytest -q` | 1119 passed, 37 deselected |
| `npx tsc -p tsconfig.app.json --noEmit` (Homebrew node) | clean |
| `npx eslint` on the 15 changed frontend files | clean |
| `npx vitest run` on the 8 touched/adjacent files (`emailBody*.test.ts`, `gmailDraft.test.ts`, `orderEmailDraft.test.ts`, `DispatchPanel*.test.tsx`, `ManagerPage.draftLock.test.tsx`) | 8 files, 161 tests passed |
| `npx vitest run` (full suite) | 62 files, 967 tests passed |
| Differential fuzz, scratchpad only: `emailBody.ts` bundled with esbuild vs `gmail_url._build_body`, on random fixtures (random extras text with `\r`, `\n`, CRLF, tab, NBSP, U+3000, `" - "`, `\|`, parentheses; random zero-qty catalogue lines; company/signer/date/note on or off) | 3000 cases, **0 diffs** |
| Same fuzz adding U+2028, U+2029, VT, FF, U+180E, U+1680, U+200B | 3000 cases, **0 diffs** |
| Same fuzz adding U+0085, U+001C-U+001F, U+FEFF | diverges (see N1) |

No real e-mail, Gmail, Railway or Supabase call was made.

---

## Blocker

None.

## Should-fix

### S1. Nothing pins "open only after a successful dispatch"

**Where**
- The behaviour lives in `frontend/src/pages/ManagerPage.tsx:363-395`: `openDraftTab` runs inside the `try`, after `await api.managerDispatch`; the `catch` and the order-changed guard (`:350-361`) never open. Today's code is correct.
- The tests do not hold it. `frontend/src/pages/ManagerPage.draftLock.test.tsx:196-198` says "opens only after the dispatch, never before it", but only asserts that `open` was called once, after `managerDispatch` was called.
- No test makes `managerDispatch` reject.

**Failure scenario**
1. A later refactor moves `openDraftTab(url)` above the `await`, or into `DispatchPanel.handleDraft` before `onDispatch` (the "obvious" place for keeping the gesture).
2. The server then rejects the dispatch:
   - a 409 `OrderAlreadyDispatchedError` from a second tab;
   - a 400;
   - a network error.
3. The manager is already looking at an open draft and sends it from Gmail.
4. The app still shows the order as claimed, with "Wyślij" enabled. A retry creates a second draft and a second supplier e-mail, which means a double order.
5. Every current test stays green.

**Fix**
- Add a test in `ManagerPage.draftLock.test.tsx`: `vi.mocked(api.managerDispatch).mockRejectedValue(new ApiError(409, "already dispatched"))`, then assert:
  - `openSpy` was not called;
  - `queryByText(/NIE jest jeszcze wysłany/)` is null;
  - the `manager.draft.dispatchFailed` toast is shown.
- In the first test, hold `managerDispatch` on a deferred promise. Assert `open` was not called while it is pending, then resolve it and assert the call.

### S2. Three e-mail-body tests now pass vacuously

**Where**
- `frontend/src/pages/manager/lib/emailBody.test.ts:196-209` has three tests:
  - "omits the off-catalogue items block entirely when extra_items is empty";
  - "… when extra_items is absent";
  - "trims whitespace-only extra_items to nothing".
- They still assert `not.toContain("Pozycje spoza katalogu:")`. The new builder can never emit that header, so the tests check nothing.
- The whitespace-only case (`"   \n  "`) is also missing from both splitter tables:
  - `emailBody.test.ts:184-193`;
  - `supply-os-v1/tests/test_gmail_url.py:722-731`.

  `extras_edge_cases` covers blank lines inside the text, not a field that is only whitespace.

**Failure scenario.** A change in `extraItemRows` keeps a whitespace-only line, for example by checking `raw` instead of the trimmed `line`. A whitespace-only `extra_items` then renders `1.  |  (spoza katalogu)` in the supplier e-mail. All three tests stay green, and so does the Python side.

**Fix**
- In those three tests, assert `not.toContain("(spoza katalogu)")` and the exact table end, `"Lp. | Produkt | Ilość\n\nDostawa:"`. The Python twin already asserts `"(spoza katalogu)" not in body` (`test_gmail_url.py:674`); the exact table-end check is new on both sides.
- Add `["   \n  ", []]` to both splitter tables.

### S3. The "not sent yet" warning shows only on the selected order and is lost on reload (risk carried from plan-review blocker 1)

**Where**
- `draftedOrders` is React state in `frontend/src/pages/ManagerPage.tsx:89`.
- It reaches the screen only through the selected order's `OrderDetailPane`: `ManagerPage.tsx:655`, rendered at `OrderDetailPane.tsx:355` and `:412`.
- The queue row has no marker, and a reload clears the state.
- The plan accepted a session-only amber line, and it is implemented as specified. This finding is the gap that is still open, not drift from the plan.

**Failure scenario**
1. First "Wyślij" after a reload. The Google sign-in popup uses up the click, so the draft tab is blocked; `operator-steps.md` §2.2 expects this.
2. The amber line appears. The manager, working through the claimed lane, clicks the next order right away, and the line is gone from the screen.
3. Order 1 sits in the "sent" lane looking like every other sent order.
4. After a reload, or the next morning, nothing points at the unsent draft in biuro@. The supplier never gets the order; this is the exact outcome plan-review blocker 1 described.

**Fix** (cheap, all in files this change already touches):
- Pass `Object.entries(draftedOrders).filter(([, d]) => !d.opened)` ids to `ManagerQueue` and show an amber "szkic niewysłany" chip on those rows (new i18n key).
- Optionally mirror `draftedOrders` into `sessionStorage` (try/catch) so a reload keeps it.
- If this is out of scope for Lane E, record it with Ben as an explicit follow-up, and make it part of the operator's §2.2 observation.

## Nits

**N1. Python `str.strip()` and JS `trim()` disagree on a few characters, and the gap now applies per line.**
- Where: `supply-os-v1/app/gmail_url.py:270` and `frontend/src/pages/manager/lib/emailBody.ts:165`.
- Python strips U+0085 and U+001C-U+001F; JS does not. JS strips U+FEFF; Python does not.
- Example: `"A\n\u0085\nB - 1 kg"`. Python renders rows `1 A`, `2 B`. TS renders `1 A`, `2 \u0085`, `3 B`, so the numbering is off by one.
- Impact is small:
  - only the server re-open URL (`gmail_compose_url`) differs, and it is shown only when no draft exists;
  - the drafted e-mail is always the TS text;
  - these characters do not come from typing.
- The whole-field strip had the same gap before (plan-review obs 16); now it is per line and can shift numbering.
- Fix (optional): strip one explicit shared set in both twins (for example `" \t\r\n\v\f "`), or leave it and add a line to the `extras_edge_cases` comment that documents the accepted difference.

**N2. "Otwórz szkic" can label a link to the Drafts folder.**
- Where: `frontend/src/pages/manager/OrderDetailPane.tsx:463-468` and `ResendPanel.tsx:235-243`.
- With an empty `messageId`, or with the documented kill switch `OPEN_SINGLE_DRAFT = false`, the only link still reads "Otwórz szkic" (open the draft) but opens the Drafts list.
- Fix: use `url === gmailDraftsUrl(mailbox) ? "manager.draft.openDrafts" : "manager.draft.openDraft"`.

**N3. When the tab is blocked, the toast is still the green success toast.**
- Where: `ManagerPage.tsx:375-381`. The toast is shown before `openDraftTab`, so when `opened === false` the toast is green ("Szkic utworzony…") while the pane turns amber.
- Fix (optional): call `openDraftTab` first. When it returns false, show `manager.draft.notSentYet` as a non-ok toast.

**N4. An over-long body makes "Otwórz w Gmail" disappear from "Inne opcje" without explanation.**
- Where: `DispatchPanel.tsx:527-538` (link `null`, fallback hint hidden) and `:546-551` (the `manager.urlTooLong` banner exists only in the no-draft branch).
- On the draft path a too-long body leaves only the copy buttons inside "Inne opcje".
- Fix: when `tooLong`, render the `urlTooLong` note inside the `<details>`. This was plan-review nit 8's second option.

**N5. The new docstring contains real control characters.**
- Where: `gmail_url.py:263` and `:266`. The docstring is not raw, so ``` ``\r`` ``` and `"\n"` become a real CR and LF. `help(_extra_item_rows)` prints a broken line.
- Fix: use `r"""…"""`, or escape as `\\r` / `\\n`.

**N6. The `if not product` fallback can never run.**
- Where: `gmail_url.py:279-280` and `emailBody.ts:170-173`.
- The line is trimmed first, so its first character is never whitespace. Any `" - "` match is therefore at index ≥ 1, and `line[:i].strip()` is never empty.
- The docstrings' "(or with nothing before it)" describes a case that cannot happen.
- It is harmless and matches resolution 2's pseudo-code, so keep it for symmetry or drop the docstring clause.

**N7. Test assertions are narrower than the test names claim.**
- `DispatchPanel.draft.test.tsx:148-158` checks only that "Otwórz w Gmail" is inside the closed `<details>`. It does not check:
  - that "Kopiuj treść" and "Kopiuj adres" are inside it too;
  - that "Wyślij" is outside it and visible.
- `:215` (no client id) does not assert that "Inne opcje" is absent.
- `ResendPanel` has no test at all. Its new `draftResult.url` link (`ResendPanel.tsx:235`) is untested.
- `ManagerPage.draftLock.test.tsx:248` does not assert the green `sentLine` text.

**N8. The env comments describe production state that does not exist yet.**
- Where: `supply-os-v1/.env.example:76-77` ("production sets true") and `config.py:101-103`.
- Until the operator flips the flag, production prints the blank date line. Per lessons.md ("merged ≠ live"), word it as intent: "production is to be set true by the operator after the deploy (D2)".

**N9. Small inaccuracies in `operator-steps.md`.**
- `:14` shows `____________` (12 underscores). `BLANK_DELIVERY_DATE` is 10 underscores (`gmail_url.py:131`, `emailBody.ts:77`), so "exactly as today" does not match character for character.
- `:39-41`: the `OPEN_SINGLE_DRAFT` revert is a code change plus a Vercel deploy, not a runtime switch. Say so.
- `:42` (dosyłka) checks only the link. Resolution 7 also implies checking the dosyłka body:
  - it gets the new layout;
  - with D2 on, the subject and body carry the original order's delivery date.

  Have the operator confirm that date is right for a top-up.

**N10. Change bookkeeping is not updated.**
- `change.md:4` still says `status: plan_reviewed`.
- `plan.md` has no `## Progress` section; 51 of the 70 archived plans have one.
- Update both before `/10x-archive`. Per lessons.md, also add the roadmap row in the archiving commit.

### Observations (no change needed)

- **Dosyłka button next to the amber line.** After a dispatch, the sent order shows the amber line together with ResendPanel's green "Zrób draft w Gmailu" (dosyłka) button (`OrderDetailPane.tsx:352-368`).
  - A manager who misreads the amber line could create a "Dosyłka:" draft that carries the whole order.
  - The layout existed before this change, so it is not a regression.
  - Worth one look during the operator's §2.2 check.
- **The amber line's `role="status"` is mounted with its text already in it** (`OrderDetailPane.tsx:452`), so screen readers may not announce it. The toast uses the same pattern (`ManagerPage.tsx:540-549`) and carries the message anyway. The warning is text, not just colour, and its contrast is fine (amber-900 on amber-50 or white).

---

## Verified as correct

**WP1 layout, both builders**
- `_build_body` (`gmail_url.py:306-433`) and `buildEmailBody` (`emailBody.ts:194-270`) render the plan's layout exactly:
  - extras rows `N.  | product (spoza katalogu)[ | qty]` continue the numbering from the *visible* catalogue lines (`len(visible) + 1` / `visible.length + i + 1`);
  - the `Pozycje spoza katalogu:` section is removed;
  - the company block (name, then address, then `NIP:`) comes before `Pozdrawiam,`, gated on `company_name`, with its own trailing blank line;
  - `(zamówienie #id)` stays the last line;
  - the marker is a literal on both sides.
- The splitters (`_extra_item_rows`, `extraItemRows`) implement resolution 2's pseudo-code line for line: split on `"\n"` only, trim, skip blanks, split at the first `" - "` of the *trimmed* line.

**Goldens**
- The four old `.txt` files change only in footer order, plus the Mięta row in `ken_edge_cases`.
- `ken_edge_cases` keeps a zero-qty line, so the extras number from 7, not 8.
- `bracka_extras_date` (date on, signer, company, phone, two `" - "` extras and one without, captain note) matches the plan's layout block byte for byte. Its subject is `– dostawa śr 21.10`; 2026-10-21 is a Wednesday.
- `extras_edge_cases` covers resolution 3's full list: CRLF, blank and whitespace-only lines, padding, a trailing `" -"`, two separators, no separator, a leading `" - "`, and every catalogue line at 0 (numbering from 1).
- Both harnesses read the same JSON with `rstrip("\n")` / `replace(/\n+$/, "")`, and both presence checks list the two new scenarios (`test_order_email_golden.py:97-105`, `emailBody.golden.test.ts:102-113`).

**D2**
- No logic change. `bracka_bukat` and `bracka_extras_date` render the date line and subject with the new layout.
- With the flag on and no date, `ken_edge_cases` keeps the blank line.
- The default stays `False` (`config.py:104`).

**WP3**
- `createGmailDraft` returns `{ id, messageId: data.message?.id ?? "" }` (`gmailDraft.ts:513-516`), pinned by two new `toStrictEqual` tests.
- `createVerifiedDraftWithToken` and `createVerifiedOrderDraft` pass `messageId` through. Mocks return it, and the assertions use `toStrictEqual` (resolution 4).
- `gmailDraftOpenUrl` (`orderEmailDraft.ts:226-230`):
  - trims the id and falls back to the folder for an empty, `null` or `undefined` id;
  - `encodeURIComponent` encodes the id;
  - `OPEN_SINGLE_DRAFT` is the kill switch;
  - the JSDoc names the stale-id-after-edit caveat.
- `openDraftTab` (`orderEmailDraft.ts:249-262`):
  - calls `window.open(url, "_blank")` without `noopener`;
  - `null` or a throw means blocked;
  - `opener` is cut synchronously while the tab is still the same-origin `about:blank`, with a try/catch.
- Popup gesture is unchanged. `handleDraft` makes only synchronous state calls before `createVerifiedOrderDraft`, whose first call is `requestGmailAccessToken` (`DispatchPanel.tsx:325-353`, `orderEmailDraft.ts:102-116`).
- The draft URL reaches the page only through `onDispatch` opts (`DispatchPanel.tsx:343-346`). The tab opens only after `managerDispatch` resolves (`ManagerPage.tsx:363-395`), never on the `catch` path or the order-changed path.
- `draftedOrders` is keyed by order id. `handleSelect` clears `detail`, so one order's draft line cannot show on another (`ManagerPage.tsx:200-210`). The optional `drafted` prop leaves `ManagerArchivePage` unaffected.
- `DispatchPanel` with the draft path:
  - one primary "Wyślij", with the busy label unchanged;
  - the "jeśli przeglądarka pozwoli" hint;
  - the error note;
  - link, copy buttons and fallback hint inside a closed `<details>` "Inne opcje". The link still dispatches on click and is inert while drafting or busy.
- Without the draft path, the markup equals the old one (too-long banner plus the same three controls), and the existing `DispatchPanel.test.tsx` is unchanged and green.
- `DraftedLine`:
  - amber with `manager.draft.notSentYet` when `opened === false`, green otherwise;
  - "Otwórz szkic" points to that draft;
  - the folder backup link shows only when it differs.
- `ResendPanel` links its draft and never dispatches. `manager.draft.create` keeps "Zrób draft w Gmailu".
- All new copy goes through `strings.ts` with `pl` and `en`; there are no hardcoded strings and no direct `fetch` in components. The new boundaries are explicitly typed.

**Transport-v2 and undo-send**
- No file under `pages/manager/transport/` changed.
- `TransportSendPanel.tsx:546-556` reads only `created.id` and keeps its own folder `window.open` (`:641`).
- Undo-send lives only in Transport.

**Plan-review resolutions 1-7**: all implemented. The only gaps are the N9 wording in the operator steps and S3, which is the residual risk of resolution 1, not a missed resolution.
