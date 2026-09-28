# Why there is no local preview screenshot

The Phase 2 change lives on the Manager order-detail screen, behind a supplier whose
`ordering_method` is `transport`. A local preview cannot reach that state:

1. **The screen needs a persistent backend.** `manager_order_detail`
   (`supply-os-v1/app/main.py`) refuses a non-persistent backend with 503:
   `"Order details require a persistent backend (SUPPLY_OS_DATA_BACKEND=sheet or
   supabase)"`. Local dev runs the `seed` backend, so the detail pane never renders
   an order at all — there is nothing to screenshot.
2. **Even with a persistent backend, the seed data would not trigger the branch.**
   The seed CSV deliberately keeps `SUP_PAGO` on `email`; the flip to `transport` is
   a prod data pass (Phase 3), applied by the operator after the code is live. Editing
   the seed CSV to force the branch would be staging a screenshot of a state the seed
   backend is not supposed to hold.
3. **Pointing a local build at prod is not an option.** It would put a Manager screen
   with live supplier e-mail addresses one mis-click from a real order — the hard rule
   this whole change exists to enforce.

What covers the branch instead:

- `frontend/src/pages/manager/DispatchPanel.test.tsx` renders the real component with a
  `transport` detail and asserts the notice, the `/manager/transport` link, and the
  absence of every dispatch affordance (Gmail link, "Oznacz jako zamówione", copy-body).
  It also renders an `email` detail and asserts the Gmail composer is still there, so the
  new branch cannot have swallowed the old one.
- The visual confirmation is Progress 3.6 / 3.7 on prod, after the deploy — which is
  where it has to happen anyway, since the branch only exists once the data pass has run.

This mirrors `context/foundation/lessons.md`, "Preview with auth DISABLED cannot verify a
screen's auth/role wiring": a preview that cannot reach the real state proves nothing, and
saying so is better than a screenshot of a staged one.
