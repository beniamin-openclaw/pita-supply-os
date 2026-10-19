# Plan review — supplier-email-v21 (Lane E)

Reviewed: `context/changes/supplier-email-v21/plan.md`, `change.md`, against the code on
`claude/magical-moser-8c09a0` (base `7b03cf9`). Read-only review, 2026-10-17.
Owner decisions (company data before sign-off, extras as table rows, date printed, one "Wyślij"
that creates and opens the draft, undo-send + transport-v2 intact, WP2 out of scope) are taken as
final and not re-argued; the findings only concern how the plan delivers them.

**Verdict: approve with changes.** 1 blocker, 4 should-fix, 5 nits, 6 observations.
The layout spec and transport-v2 isolation are sound. The weak spot is WP3: the auto-open will
usually be blocked, and the plan gives the app no way to notice it.

Severity mapping: blocker = CRITICAL, should-fix = WARNING, nit/observation = OBSERVATION.

---

## Blocker

### 1. WP3 auto-open will be blocked on the first send after every page load, and the plan cannot detect it

**Evidence**
- Plan: `plan.md:118-122` calls `window.open(url, "_blank", "noopener")` in `ManagerPage.handleDispatch`, after the dispatch succeeds. It says a blocker "may" stop it.
- The chain before that call:
  - The Google sign-in popup opens with `window.open` (`frontend/src/pages/manager/lib/gmailDraft.ts:432`). Opening a popup consumes the click's transient activation (HTML user-activation model / Chrome User Activation v2).
  - Then four awaits run: getProfile, drafts.create, drafts.get, then the Railway dispatch.
  - Transient activation expires after a few seconds even when nothing consumed it. The duration is left to the browser; sources give roughly 1-5 s.
- The token cache is in memory only: "a page reload forgets the token" (`gmailDraft.ts:377-378`). So the first "Wyślij" after every reload goes through the popup, and the second `window.open` is then blocked deterministically.
- The repo already knows this:
  - `TransportSendPanel.tsx:640`: "Likely popup-blocked this late in the chain".
  - `DispatchPanel.tsx:461-465`: "window.open is deliberately avoided (popup blockers)".
- With `"noopener"`, `window.open` always returns `null` (HTML spec). The app cannot tell an opened tab from a blocked one.
- After dispatch the DispatchPanel unmounts (`ManagerPage.tsx:80-82`), so the planned hint "wyślesz go z Gmaila" (`plan.md:111`) is gone. Everything left is green:
  - the toast "Szkic utworzony w {mailbox} — zamówienie oznaczone jako wysłane." (`frontend/src/i18n/strings.ts:681-684`), which disappears after 4 s (`ManagerPage.tsx:89-92`);
  - the green `DraftedLine` "Szkic w Gmailu ({mailbox})" (`strings.ts:693-696`, `OrderDetailPane.tsx:443`).

**Failure scenario**
1. In the morning Ben opens the app and clicks "Wyślij" on a Bukat order.
2. The Google popup signs him in, the verified draft lands in biuro@, and the order turns `manager_sent`.
3. No tab opens. He sees a green toast after pressing a button called "Wyślij", and moves on.
4. The draft sits unsent in biuro@. The supplier never gets the order, the app shows it as sent, and the delivery is missing the next day.

**Fix** (keeps the owner's single button and the auto-open):
1. Make the block detectable:
   ```ts
   let opened = false;
   try {
     const w = window.open(url, "_blank");
     if (w) { w.opener = null; opened = true; }
   } catch { /* blocked */ }
   setDraftedOrders((p) => ({ ...p, [orderId]: { mailbox, url, opened } }));
   ```
   Google pages sever the opener anyway (COOP, `gmailDraft.ts:349-353`), so dropping `noopener` costs nothing.
2. When `opened === false`, `DraftedLine` shows an amber, persistent call to action: "Szkic NIE jest jeszcze wysłany — [Otwórz szkic] i kliknij Wyślij w Gmailu". That click is a fresh gesture, so it always opens. When `opened === true`, keep today's green line plus the link.
3. Reword `manager.draft.done` so the toast says the e-mail still has to be sent from Gmail. Make the hint at `plan.md:111` conditional ("i otwiera go, jeśli przeglądarka pozwoli").
4. In `operator-steps.md` (plan step 2, `plan.md:146-148`), test both cases:
   - (a) the first send after a reload: expect the amber line and a second click;
   - (b) a second order in the same session, with a cached token: expect the tab to open.
   Also ask Ben whether Transport's late `window.open` (`TransportSendPanel.tsx:641`) has ever opened a tab. That is free live evidence.
5. Optional, not for this lane unless (b) is also blocked in the live check: pre-open `about:blank` synchronously when `hasCachedGmailToken(mailbox)` (`gmailDraft.ts:407`, today documented as a "test seam") and navigate it after dispatch. Every failure path would then have to close that tab.

---

## Should-fix

### 2. The extras line splitter is under-specified. Two faithful twins could differ.

**Evidence**
- `plan.md:66-72` says: "Each non-blank line of `extra_items.strip()` … split at the FIRST `" - "` (same rule as `parseExtraItems`) … both verbatim (trimmed) … A line without `" - "` (or with an empty right side)…". It leaves four things open:
  - **(a) Line separator.** Python `str.splitlines()` also splits on `\x0b \x0c \x1c-\x1e \x85    `; JS `split("\n")` does not. The API stores `extra_items` verbatim from any client (`main.py:1100`, `main.py:2030`).
  - **(b) Trim before or after the separator search.** `parseExtraItems` trims the line first (`frontend/src/pages/captain-mp/lib/extraItems.ts:64-65`). Then `"Mięta - "` becomes `"Mięta -"`, has no separator, and renders as `N.  | Mięta - (spoza katalogu)`. Searching the untrimmed line instead gives `Mięta` with an empty tail. Under trim-first, the plan's "(or with an empty right side)" clause can never fire. Its presence suggests the author pictured split-first.
  - **(c) Blank lines.** `parseExtraItems` keeps blank lines as `name: ""` rows (`extraItems.ts:63-66`), so "same rule as `parseExtraItems`" holds only for the separator. The skip-blank rule matches `collectExtraItemsByLocation` (`frontend/src/pages/manager/lib/transport.ts:182-185`).
  - **(d) First-separator side effect.** A name that contains `" - "` (for example `Sos - ostry - 2 l`) renders as product `Sos`, quantity `ostry - 2 l`. Nothing is lost, but it should be a pinned, deliberate choice.

**Fix.** Write the algorithm into the plan as pseudo-code that both twins copy:
```
for raw in extra_items.split("\n"):        # never splitlines(); "\r" is removed by the trim below
    line = raw.strip()                     # JS: rawLine.trim()
    if not line: continue
    i = line.find(" - ")                   # on the TRIMMED line
    if i < 0: product, qty = line, ""
    else: product, qty = line[:i].strip(), line[i+3:].strip()
    if not product: product, qty = line, ""   # line that starts with "- " after trim: keep it whole
    row = f"{n}.  | {product} (spoza katalogu)" + (f" | {qty}" if qty else "")
```
Delete the dead "(or with an empty right side)" clause, or keep it but state that it applies only after trimming. Add an input → expected-row table (the five cases in finding 3) to `plan.md`. Point to `transport.ts:184-185` as the line-split precedent.

### 3. Edge cases need a shared golden, not only per-side unit tests

**Evidence**
- `plan.md:91-92` puts the splitter edge cases into per-side unit tests. Each side's test encodes its own author's expectation, so both can pass while the twins drift. Only the goldens compare the two builders: they are discovered by glob on both sides (`supply-os-v1/tests/test_order_email_golden.py:90-94`, `frontend/src/pages/manager/lib/emailBody.golden.test.ts:95-113`).
- The planned `bracka_extras_date` golden (`plan.md:87-88`) covers only the happy cases.

**Fix**
- Add a second golden, `extras_edge_cases.json/.txt`. JSON can carry `\r\n` exactly. Cover:
  - `"\r\n"` endings;
  - an empty and a whitespace-only middle line;
  - leading and trailing spaces;
  - a trailing `" -"`;
  - a name with two `" - "`;
  - a line with no separator.
- Also add zero visible catalogue lines with extras, so numbering starts at `1.`. That case is reachable via `ResendPanel` (see finding 14).
- Add both new names to `test_scenarios_present` (`test_order_email_golden.py:97-98`) and to "finds the scenarios" (`emailBody.golden.test.ts:103-105`), so a deleted fixture fails CI.

### 4. The test plan misses one test that will go red, and assertions that pass for the wrong reason

**Evidence**
- `frontend/src/pages/ManagerPage.draftLock.test.tsx:156,187`: `findByRole("button", { name: "Zrób draft w Gmailu" })`. The rename to "Wyślij" times this out, so the test goes **red**. It is not in the list at `plan.md:131-138`, and the condition at `plan.md:137` ("only if one already covers DraftedLine") would skip it.
- `DispatchPanel.draft.test.tsx:126-128`: exact `toHaveBeenCalledWith(..., { draftMailbox })`. It goes red once `draftUrl` is added. That is planned ("dispatch receives draftUrl"); just make sure it asserts the URL value.
- `frontend/src/pages/manager/lib/orderEmailDraft.test.ts:12`: the `createGmailDraft` mock returns `{ id: "r-1" }` only.
  - Assertions `:54`, `:81` and `:165` use `toEqual`, which ignores `undefined` properties. If `messageId` is passed through as `undefined`, they still pass and hide a missing field.
  - If it is normalised to `""` in `orderEmailDraft.ts`, they go red.
- No test asserts that `window.open` receives the draft URL. In jsdom `window.open` is not implemented: it only logs, it does not fail. Plan step 4 (`plan.md:118-122`) and the `draftedOrders` shape change are untested; `plan.md:137-138` defers them to "DispatchPanel opts test + manual check", but a DispatchPanel test cannot see `ManagerPage`.
- jsdom 29 (`frontend/package.json:35`) omits the shadow-tree styles of `<details>`: its default stylesheet only sets `details, summary { display: block }`. Content in a closed "Inne opcje" is still found by `getByRole`, so "secondary actions are inside Inne opcje" cannot be proven by presence.

**Fix**
- Add `ManagerPage.draftLock.test.tsx` to the test list: rename the selector and extend it. It already resolves `managerDispatch` (`:122`).
  - `vi.spyOn(window, "open").mockReturnValue({} as Window)`, then assert it was called with the `#drafts?compose=` URL.
  - Add a `mockReturnValue(null)` case that asserts the amber "not sent yet" line from finding 1.
- In `orderEmailDraft.test.ts`, make the mock return `{ id: "r-1", messageId: "m-1" }` and assert with `toStrictEqual`.
- For `<details>`: assert `expect(link.closest("details")).not.toHaveAttribute("open")` and/or jest-dom `expect(link).not.toBeVisible()`, which checks closed `<details>` ancestors.

### 5. Deep-link robustness: empty or undefined id, stale id, name collision

**Evidence**
- `plan.md:96`: `messageId = data.message?.id ?? ""`. Every existing mock returns no `message` field:
  - `DispatchPanel.draft.test.tsx:15,103`: `{ draftId }`;
  - `ManagerPage.draftLock.test.tsx:147,168`: `{ draftId }`.
  So `gmailDraftUrl` receives `undefined` in tests and possibly in other callers.
- `plan.md:104-106` cites a report that the link opened an empty compose. Typing into that compose silently creates a second, stray draft in biuro@.
- Gmail likely replaces a draft's underlying message when it is saved again (`drafts.update` returns a new `message.id`). After Ben opens and edits the draft once, `DraftedLine`'s "Otwórz szkic" (`plan.md:123-124`) can point at a message id that no longer exists.
- `gmailDraftUrl` and the existing `gmailDraftsUrl` (`orderEmailDraft.ts:206-208`) differ by one letter. A wrong import silently changes the behaviour.

**Fix**
- Guard the input with `if (!messageId?.trim()) return gmailDraftsUrl(mailbox)`.
- Add a one-line module constant (`const OPEN_SINGLE_DRAFT = true`) so a failed live check is a one-line revert to the folder link.
- Rename the helper to `gmailDraftOpenUrl` (or `gmailComposeDraftUrl`).
- Operator check: add "open the draft, edit it, close it, click 'Otwórz szkic' again" and record what opens.

---

## Nits

6. **Name the prop/state change.**
   - Current shape: `draftedOrders: Record<string, string>` (`ManagerPage.tsx:83`), set at `:371`, read at `:644`. `OrderDetailPane` prop `draftedMailbox` (`OrderDetailPane.tsx:56`) is used at `:352`, `:354`, `:355`, `:410-411`. `DraftedLine({ mailbox })` is at `:440`.
   - Fix: add a `draftedUrl?: string | null` prop (plus `opened` from finding 1), or switch to `drafted?: { mailbox; url; opened } | null`. Spell this out in plan step 5.
   - `tsc -b` checks production call sites; tests are excluded (`frontend/tsconfig.app.json:25`), and no test renders `DraftedLine` today. Finding 4's `draftLock` extension is the cheap cover.

7. **i18n keys.**
   - `manager.draft.create` is shared with the dosyłka button (`ResendPanel.tsx:184`). Say explicitly that its value stays "Zrób draft w Gmailu", and that only the new `manager.draft.send` is "Wyślij".
   - Name all new keys: send, hint, "Inne opcje", "Otwórz szkic", and the amber not-sent line.
   - The ` (spoza katalogu)` marker stays a literal in both builders, not i18n. Supplier copy is always Polish and must stay byte-identical with Python; precedent is the literal at `emailBody.ts:185`.

8. **The too-long banner sits outside "Inne opcje".**
   - `DispatchPanel.tsx:432-436` renders `manager.urlTooLong` ("Treść za długa dla Gmaila — skopiuj treść i wklej…", `strings.ts:749-752`) above the buttons. The draft path has no URL limit (`main.py:2667-2669`), and "Kopiuj treść" will now be collapsed.
   - With extras as rows, the URL grows (finding 11), so the banner shows more often.
   - Fix: render it only when `!draftAvailable`, or move it inside `<details>`.

9. **Stale comments to list explicitly** (`plan.md:80-81` and `:153` name only `config.py` and the "S-02 notes"):
   - `extraItems.ts:4-9`: the "Pozycje spoza katalogu:" heading, and "The backend never parses this string". Both become false.
   - `supply-os-v1/.env.example:75-78`: "false until the delivery-calendar lane…".
   - `config.py:98-104`.
   - The "approved 2026-09-28" docstrings at `gmail_url.py:281` and `emailBody.ts:146`.
   - `models.py:1374-1376` and `docs/pita-supply-os-v1/NEW_LOCATION_CHECKLIST.md:19` are still accurate. Leave them.

10. **Worktree setup.** This worktree has no `frontend/node_modules` (only the main checkout does). Add `npm ci` (Homebrew node) in the worktree to the Verification step (`plan.md:157-158`) before `/verify`.

---

## Observations (no change required)

11. **URL length.** Each extras row adds about 48 encoded characters on the server and about 44 on the client.
    - Python `urlencode(quote_via=quote)` encodes `()` (`gmail_url.py:463`); JS `encodeURIComponent` does not (`emailBody.ts:288-302`).
    - The removed heading saves about 70 once.
    - Server overflow is non-fatal (`main.py:2666-2671`), and the server and client limits already differ for names with parentheses.

12. **Dosyłka layout.** `ResendPanel.tsx:74-77` uses `buildEmailBody`, so top-up e-mails get the new layout too. That is intended, but the plan only mentions ResendPanel for the link (`plan.md:125-126`). Add one dosyłka check to operator-steps.

13. **Dispatch-failed and order-changed paths** (`ManagerPage.tsx:343-354`, `:383-391`).
    - The verified draft is orphaned. The only message is a 4 s toast, and DispatchPanel stays mounted, so a second "Wyślij" creates a second draft.
    - This already happens today, so it is not a regression of this plan. A follow-up could keep the draft URL in that toast or in page state.

14. **Extras-only orders.**
    - An order whose catalogue lines are all zero cannot be dispatched by e-mail: the client checks `isOrderEmpty` (`DispatchPanel.tsx:115`), and the server raises `ValueError` (`gmail_url.py:445-447`, which becomes 400 at `main.py:2672-2673`).
    - So extras-only numbering is reachable only through ResendPanel. Pinning it in the edge golden is still cheap.

15. **Transport-v2 stays intact.**
    - `messageId` is additive. `TransportSendPanel.tsx:556` reads `created.id` only.
    - Transport tests mock `orderEmailDraft` with an `importOriginal` spread (`TransportSendPanel.test.tsx:22-30`), so they get the new export.
    - Transport's own extras block and Pago/driver builders do not use `buildEmailBody`; their "Pozycje spoza katalogu" assertions (`transport.test.ts:158`, `gmailDraft.test.ts:362,464,492`) are unaffected.
    - Undo-send and the late folder open (`TransportSendPanel.tsx:640-641`) are untouched.

16. **Checked, no change needed.**
    - `test_manager_dispatch.py:850`: the `"Pozdrawiam,\n<signer>"` substring stays adjacent.
    - `test_manager_dispatch.py:858` and `test_gmail_url.py:600-605`: the too-long cases still raise.
    - `test_transport.py:2216-2254`: API surfacing only.
    - `DispatchPanel.test.tsx`: no client id, so the panel is unchanged.
    - The company-block spacing ("blocks with no data are skipped with their blank line", `plan.md:35`) and the signer variants (`gmail_url.py:369-379`, `emailBody.ts:211-221`) are unambiguous.
    - The Python `strip()` vs JS `trim()` whitespace-set difference (U+FEFF, `\x1c-\x1f`) already exists for the whole-block strip, so it is not new.
    - No consumer of the body layout beyond the two builders, DispatchPanel and ResendPanel was found. `OrderDetailPane.tsx:215-218` shows `extra_items` verbatim and is unaffected.
