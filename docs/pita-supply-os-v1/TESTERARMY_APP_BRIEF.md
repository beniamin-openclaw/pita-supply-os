# TesterArmy — App brief + first test specs (Pita Supply OS)

Hand this to the TesterArmy AI so it understands the app and builds correct tests.

## How to use this doc
- **Part A** → paste into TesterArmy → Project → **Memory** (persistent app knowledge the AI reuses across every test).
- **Part B** → use each block as a separate **Create Test** prompt (one test each).
- **Auth / secrets:** store the test token in **Project → Test Accounts** (encrypted). Reference it in login steps. **Never** paste a token into test text, the AI chat, or "custom instructions" — those appear in run traces/logs (the docs say so explicitly).

> ⚠️ Targets the **currently deployed** app (Captain F5 + Manager minimal). Manager v2 (richer dashboard) is NOT live yet — when it deploys, the Manager tests below get rewritten.

---

## Part A — App context (for the Memory tab)

**App:** Pita Supply OS — a procurement tool for Pita Bros (Greek restaurant chain). One React single-page web app on Vercel: **https://pita-supply-os.vercel.app**. UI is Polish by default (English toggle exists). Two roles: **Captain** (orders from a restaurant) and **Manager** (reviews + dispatches to suppliers).

**Auth model — IMPORTANT:**
- The site is **publicly loadable** — it is NOT behind HTTP Basic Auth. **Ignore the Site Protection / HTTP Basic Auth screen** in settings; it does not apply here.
- Login is an **in-app field**: on first load you see a code-entry screen (placeholder **"Wpisz kod miejsca"**). You type an **access token** into that field and submit; then the app loads.
- Captain and Manager use **different tokens**. Store each as a **Test Account** and type the credential into the code field during a login step. Do not hard-code tokens in step text.

**Routes:**
- `/captain-v2` — Captain order screen (enter stock + quantities, submit an order).
- `/captain-v2/orders` — Captain "Moje zamówienia" (review/edit own orders).
- `/manager` — Manager dashboard (review queue, claim, dispatch).
- `/` redirects to captain; `/debug` is a debug page — ignore.

**Captain happy path:**
1. Open `/captain-v2`, type the captain token into the code field, submit → Captain screen loads.
2. Pick a supplier (e.g. **Pago**) from the supplier picker.
3. Product cards load (current stock, a suggestion, a final-quantity field). Critical products show a red marker.
4. Enter/adjust quantities.
5. Click **"Wyślij"** → a confirmation dialog **"Czy na pewno chcesz wysłać?"** appears with a summary. If a critical product has nothing ordered, an amber warning lists it.
6. Confirm (**"Tak, wyślij"** / **"Wyślij mimo to"**) → success toast; order status becomes **"U menedżera"**.

**Manager flow (currently live = minimal):**
1. Open `/manager`, type the manager token into the code field, submit → dashboard loads.
2. Queue shows submitted orders (location → supplier, line count, value, deviation/reason badges).
3. Actions: **"Przejmij"** (claim) a submitted order; then **"Odrzuć do poprawy"** (send back) or **"Zamów"** (dispatch → opens a Gmail compose tab).

**Data notes:**
- Orders write to a live backend (Google Sheets). A test that fully submits/dispatches **creates real data** — prefer smoke/read-only assertions, or back out before the final irreversible click, unless you intend to use disposable test data.
- Don't assert on exact PLN amounts (they vary). Assert on Polish UI text / element presence instead.

---

## Part B — First test specs (one "Create Test" each)

### Test 1 — Public AuthGate smoke (no token, safe)
```
Navigate to https://pita-supply-os.vercel.app/captain-v2.
Assert the page loads and a code-entry text field (placeholder "Wpisz kod miejsca") is visible.
Type an obviously-invalid code "XXXXX" into it and submit.
Assert the app shows a validation/error response and does NOT log in (the code field is still visible).
Take a screenshot of the result.
```

### Test 2 — Captain login + order screen loads (needs token)
```
Precondition: a Test Account named "Captain test" holding the captain test token.
Navigate to /captain-v2. Type the "Captain test" account credential into the code-entry field and submit.
Assert the Captain order screen loads: a supplier picker and/or product cards appear and a "Wyślij" button exists.
Take a screenshot.
```

### Test 3 — Captain submit happy path, confirm dialog (safe — backs out)
```
Log in as Captain (type the "Captain test" credential into the code field, submit).
Select the supplier "Pago". Wait for product cards to load.
Enter 1 in the first product's quantity field.
Click "Wyślij".
Assert a confirmation dialog with the title "Czy na pewno chcesz wysłać?" appears.
Click "Wróć i popraw" (so NO real order is created).
Assert the dialog closes and you are back on the order screen.
Take a screenshot.
```
(To test a full submit instead, replace the last steps with clicking "Tak, wyślij" — but that creates a real order.)

### Test 4 — Manager dashboard loads (needs token)
```
Precondition: a Test Account named "Manager test" holding the manager test token.
Navigate to /manager. Type the "Manager test" credential into the code-entry field and submit.
Assert the Manager dashboard loads and a queue/list area is visible (order cards, or sections like "Do przejęcia" / "W realizacji").
Take a screenshot.
```

---

## Triggers (configure later, once tests are green)
- **On Vercel deploy:** TesterArmy → Integrations → connect the GitHub App + Vercel integration → runs on `deployment_status`.
- **Scheduled "Production Monitoring":** Daily smoke of Test 1 + Test 4.
- **Manual / CLI:** `ta tests run <testId>` (CLI: `npm i -g testerarmy`, `ta auth`).

## Programmatic option (Phase 2, not now)
No MCP / Claude Code plugin exists. But TesterArmy has a CLI (`ta`) + REST API (`https://tester.army/v1`, API-key Bearer). If we later want Claude to author/trigger runs autonomously, it can shell out to `ta` or call the API — driven from this repo, not via MCP.
