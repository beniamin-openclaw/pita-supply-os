# supplier-email-v21 — operator steps (after merge)

Nothing here needs a DB migration. Gmail stays draft-only: the app never sends; the manager
sends each draft from Gmail.

## 1. Confirm the deploy, then turn the delivery date on (D2)

1. After the merge to `main`, confirm both deploys finished:
   - Vercel: the new frontend bundle hash is live (hard-reload the Manager page).
   - Railway: the backend deploy for the merge commit is green (`/health`).
2. On Railway (backend service), set `SUPPLY_OS_ORDER_EMAIL_DELIVERY_DATE_ENABLED=true` and let
   it redeploy. The default in code stays `false`, so turning it back off (or deleting the
   variable) is the rollback. Until it is set, e-mails print the blank
   `Dostawa: ____________, od godziny 11:00` line exactly as today.

## 2. Live check on one real order (Westfield or Wola), draft only

Use an order that is going to the supplier anyway. Do not send anything you would not send
today.

1. Open the claimed order → the panel shows ONE primary button **Wyślij** and a closed
   **Inne opcje** (inside: Otwórz w Gmail, Kopiuj treść, Kopiuj adres).
2. First send after a page reload: click **Wyślij**, sign in to biuro@ if asked.
   - Expected: the order is marked sent, and either a Gmail tab opens on THAT draft, or the
     browser blocks the tab and the order shows the amber line
     "Szkic w biuro@… NIE jest jeszcze wysłany — otwórz go i kliknij Wyślij w Gmailu" with
     **Otwórz szkic**. Click **Otwórz szkic**: it must open that draft.
   - Note which of the two happened (blocked on the first send is expected).
3. In the opened draft, check:
   - subject carries the delivery date (after step 1.2);
   - body: `Dostawa: <dzień> <dd.mm.rrrr>, od godziny 11:00`;
   - off-catalogue items are numbered table rows ending with `(spoza katalogu)`, after the
     catalogue rows, no separate "Pozycje spoza katalogu" section;
   - the company block (name / address / NIP) comes BEFORE "Pozdrawiam," + the signer.
4. A second order in the same session (token already cached): **Wyślij** should open the
   draft tab directly. Note whether it did.
5. Edit a draft in Gmail (any small change, keep it as a draft), then click **Otwórz szkic**
   on that order again. Note what opens (the draft, or just the Drafts list — both are safe).
   If the link ever opens an empty compose window or the wrong draft, set
   `OPEN_SINGLE_DRAFT = false` in `frontend/src/pages/manager/lib/orderEmailDraft.ts`
   (all links fall back to the Drafts folder) and tell the dev session.
6. One dosyłka (resend): the "Dosyłka do dostawcy" panel's draft result ("Szkic dosyłki utworzony w …") now links **Otwórz szkic** to that
   draft; the resend still never marks anything as sent.
7. Question for the Transport flow (not changed here): has Transport's own late tab-open
   after a send ever opened a tab for you, or is it always blocked?

## 3. WP2 note (not in this change)

The delivery window "od godziny 11:00" is still hardcoded in both twin builders:
`supply-os-v1/app/gmail_url.py` (`_build_body`, the `Dostawa:` line) and
`frontend/src/pages/manager/lib/emailBody.ts` (`buildEmailBody`, the `Dostawa:` line).
Westfield needs 10:00; per-location hours wait for Marek (WP2). Both builders and the shared
goldens in `supply-os-v1/tests/fixtures/order_email/` must change together.
