# Prod log: migration 0026 + prod-sql.sql

Applied 2026-10-01 by the agent on explicit operator approval ("wykonaj 1, 2 i 3 masz akcept"),
Supabase project lpzhphufjwrndfogkfub.

## Migration

`0026_location_sender_and_phone` applied via Supabase migrations (additive: `locations.sender_email`,
`locations.phone`, both nullable).

## A. diff-before (the rollback)

- Every location: `sender_email` NULL, `phone` NULL (columns were just added).
- `_meta.order_email_signers`: no row.
- `locations.email` (unchanged by this lane): BRACKA pitabrosbracka@gmail.com, BROWARY
  pitabrosbrowary@gmail.com, ELEKTROWNIA pitabroselektrownia@gmail.com, FORUM pitabrosforum@gmail.com,
  KEN pitabrosken@gmail.com, NORBLIN norblinpitabros@gmail.com, STARY_BROWAR pitabrospoznan@gmail.com,
  WOLA wolskapitabros@gmail.com; KAMIENICA, KULINARNA, SLONY, SUPERSAM, WESTFIELD NULL.

Rollback:

```sql
UPDATE locations SET sender_email = NULL, phone = NULL;
DELETE FROM _meta WHERE key = 'order_email_signers';
```

## B + C

Run as written in `prod-sql.sql` (one transaction, committed).

## D. audit-after

| Check | Expected | Result |
|---|---|---|
| D1 active alias without "@" | 0 | 0 |
| D2 alias outside pitabros.pl | 0 | 0 |
| D3 alias used twice | 0 | 0 |
| D5 signers | 2 | 2 (Marek Złotopolski +48 662 184 258 marek@; Sławomir Glanowski +48 692 840 194 slawek@) |

D4:

| Location | sender_email | phone |
|---|---|---|
| BRACKA | bracka@pitabros.pl | 600 722 252 |
| BROWARY | browary@pitabros.pl | — |
| KEN | ken@pitabros.pl | 530 699 266 |
| NORBLIN | norblin@pitabros.pl | 535 300 514 |
| WOLA | — (biuro@) | 662 015 470 |
| ELEKTROWNIA | elektrownia@pitabros.pl | 608 037 499 |
| WESTFIELD | mokotow@pitabros.pl | 784 984 092 |
| FORUM (inactive) | forum@pitabros.pl | — |
| STARY_BROWAR (inactive) | poznan@pitabros.pl | — |
| SLONY (inactive) | slony@pitabros.pl | — |
| SUPERSAM (inactive) | supersam@pitabros.pl | — |
| KULINARNA (inactive) | kulinarna@pitabros.pl | — |
| KAMIENICA (inactive) | — | — |
