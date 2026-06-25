# Verification notes — email-delivery-address

## Preview

Browser preview is not available in this environment, so the change was verified
by **unit test on the authoritative builder** rather than a rendered preview.
`buildEmailBody` (`frontend/src/pages/manager/lib/emailBody.ts`) is the builder
that produces the draft the manager actually sends; `emailBody.test.ts` pins its
exact output:

- name + street + city → `Adres dostawy: Pita Bros Wola, Wolska 50, 01-001, Warszawa`
- street empty → `Adres dostawy: Pita Bros Wola, Warszawa` (no `", ,"`)
- whitespace-only part skipped
- nothing but a name → `Adres dostawy: Pita Bros Wola`

The backend twin (`gmail_url.py`, used only for the session re-open link) is
pinned by `test_build_url_combines_name_address_city` to the same format.

Suites at review time: backend `402 passed, 16 deselected`; frontend `tsc -b &&
vite build` ✓, `eslint .` clean, `vitest` `82 passed (10 files)`. New frontend
bundle hash: `index-CiMOJeWQ.js`.

## Owner live run (plan 2.2) — GATING master-data step

The address line prints whatever master data holds. **Wola's `delivery_address`
is currently the placeholder `TBD`** (`docs/.../seed/locations.csv`; prod store is
Supabase). Until the real street is set, the email will read:

> `Adres dostawy: Pita Bros Wola, TBD, Warsaw`

Before the live verify:

1. Set Wola's real `delivery_address` (and confirm `city`) in **production**
   master data (Supabase `locations`). This is an owner action — not part of this
   code change, and not done here.
2. Deploy the new frontend bundle + backend (push is intentionally NOT done in
   this run — see below).
3. On `/manager`, claim a Wola order, open the dispatch panel, and confirm the
   `Adres dostawy:` line shows the full street + city.

## Not done in this run (by request)

- **No push, no deploy.** Both phases are committed locally only
  (`1078240` backend, `dbcffca` frontend). `git push origin HEAD:main` is the
  owner's call.
- **No master-data edit.** The `TBD` → real-address fix is owner-owned (above).
