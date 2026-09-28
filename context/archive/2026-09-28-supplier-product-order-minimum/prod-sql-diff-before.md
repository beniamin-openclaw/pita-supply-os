# prod-sql.sql — diff before (rollback source)

Captured 2026-09-28 on Supabase `lpzhphufjwrndfogkfub`, after migration 0023 and with
PR #37 live (Railway serves `minimum_basis_value_pln`; Vercel production = c5812a1).

Whole table: 0 rows with `display_order`, 0 rows with `counts_toward_minimum = false`.

| supplier_product_id | product_id | supplier_product_name | active | display_order | counts_toward_minimum |
|---|---|---|---|---|---|
| SP_BUKAT_P002 | P002 | Cytryna | true | NULL | true |
| SP_BUKAT_P003 | P003 | Papryka zielona | true | NULL | true |
| SP_BUKAT_P004 | P004 | Awokado | true | NULL | true |
| SP_BUKAT_P005 | P005 | Ogórek | true | NULL | true |
| SP_BUKAT_P006 | P006 | Pomidor | true | NULL | true |
| SP_BUKAT_P007 | P007 | Rucola 125 gr | true | NULL | true |
| SP_BUKAT_P008 | P008 | Sałata bolero mix 150gr | true | NULL | true |
| SP_BUKAT_P009 | P009 | Natka Pietruszki | true | NULL | true |
| SP_BUKAT_P010 | P010 | Czosnek | true | NULL | true |
| SP_BUKAT_P011 | P011 | Tzatzyki | true | NULL | true |
| SP_BUKAT_P012 | P012 | Tirokafteri | true | NULL | true |
| SP_BUKAT_P014 | P014 | Feta blok | true | NULL | true |
| SP_BUKAT_P016 | P016 | Cebula czerwona | true | NULL | true |
| SP_BUKAT_P018 | P018 | Cebula Biała | true | NULL | true |
| SP_BUKAT_P135 | P135 | Bombilla | false | NULL | true |

Rollback: `UPDATE supplier_products SET display_order = NULL, counts_toward_minimum = true
WHERE supplier_id = 'SUP_BUKAT';` — restores exactly this state.
