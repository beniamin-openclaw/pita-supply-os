# gdansk-rollout — rollout notes (SLONY, Gdańsk Słony Spichlerz)

All times Europe/Warsaw. Prod = Supabase `lpzhphufjwrndfogkfub` via the Claude connector.

## Diff przed (STEP 0, 2026-10-16 ~11:30, read-only)

- `locations.SLONY`: `{"location_name":"Pita Bros Słony Spichlerz","delivery_address":null,"city":"Gdańsk","active":false,"notes":"added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator","company_name":null,"company_address":null,"company_nip":null,"email":null,"sender_email":"slony@pitabros.pl","phone":null,"own_catalog":false}`
- SLONY settings: 115 rows, md5 `11ee78f0bec056bf308d9adbc2feb457` (all 0/0/0; notes: template "threshold TBC (sheet had no min/max)", 3 rows "+ [2026-09-28 kg->pojemnik]", 2 rows "kopia P037 2026-09-06 …").
- Gdańsk suppliers: 0; SLONY-scoped / GDA catalog rows: 0; SLONY orders / counts / receipts: 0 / 0 / 0.
- Fingerprints (must be identical after step 1):
  - shared catalog (`location_id IS NULL`, 260 rows): `37be2f5f93c2fc74de6197460056c3c1`
  - other scoped rows (FORUM + SUPERSAM, 205 rows): `ed90c57b91e1b2a98f186650acef6692`
  - settings of other locations: `dfae9658521d337b3d623987c09ee180`
  - suppliers other than the 5 GDA ids: `12ca3a44e1510d9c436b4b1c6001356c`
  - locations other than SLONY: `f4bf383623dbca9d69e9a08cfba64086`
- The 12 leftover rows (P017, P037, P039, P056, P064, P065, P068, P069, P109, P113, P114, P130): all
  0.0000/0.0000/0.0000, flags false, notes "threshold TBC (sheet had no min/max)", inventory_order NULL
  (literal backup in `prod-sql-2-delete-template.sql` and `rollback.sql`).
