# Prod diff before — delivery-calendar (2026-09-28)

Supabase project `lpzhphufjwrndfogkfub` (Postgres 17.6). Last applied migration:
`0024_order_line_manager_final_set`.

## New columns / table

None present: `orders.suggested_delivery_date`, `orders.coverage_days`,
`suppliers.coverage_prompt_enabled` and `supplier_delivery_rules` did not exist.

## Suppliers (id, active, delivery_days, cutoff_time)

| supplier_id | active | delivery_days | cutoff |
|---|---|---|---|
| SUP_ALLEGRO | false | | |
| SUP_BLUESERV | true | TBD | TBD |
| SUP_BUKAT | true | Mon, Tue, Wed, Thu, Fri, Sat | 16:00 |
| SUP_COCACOLA | true | TBD | TBD |
| SUP_EUROFOOD | true | TBD | TBD |
| SUP_FILBER | true | TBD | TBD |
| SUP_INTERMLECZ | true | TBD | TBD |
| SUP_INTERNAL | true | daily | N/A |
| SUP_KAMINO | true | TBD | TBD |
| SUP_KUCHNIE | true | TBD | TBD |
| SUP_MORY | true | | |
| SUP_PAGO | true | Tue | 14:00 |
| SUP_SELGROS | false | | |
| SUP_SPEC | true | | |

## Locations (id, active)

Active: BRACKA, BROWARY, KEN, NORBLIN, WOLA.
Inactive: ELEKTROWNIA, FORUM, KAMIENICA, KULINARNA, SLONY, STARY_BROWAR,
SUPERSAM, WESTFIELD.

Rollback = the rollback block in `prod-sql.sql` plus the migration header.
