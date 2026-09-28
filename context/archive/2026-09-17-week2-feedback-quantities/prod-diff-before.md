# Prod diff BEFORE — Phase 0 master-data package (week2-feedback-quantities)

Read-only SELECTs on Supabase project `lpzhphufjwrndfogkfub`, 2026-09-19 (before any write). This file is the
rollback for every statement in `prod-sql.sql`. Counts before: products 185, orders by status:
cancelled 54, closed 53, manager_claimed 11, manager_sent 50.

## A — Bifteki (P145)

supplier_products `SP_PAGO_P145`: purchase_unit karton, units_per_purchase_unit 1, rounding_rule full_only,
price NULL, order_note NULL, unit_weight_kg 4, supplier_sku PAGO-006, warehouse_pickup true,
notes "do potwierdzenia: ile kg w kartonie + cena".

location_product_settings (min/max/target, crit, over, notes):
- BRACKA__P145 0.5/1.5/1.5 false false "norblin-rollout 2026-08-18: arkusz Bracki min/max"
- BROWARY__P145 0/1/1 false false "browary-arkusz-2026-08-31; week1-feedback-targets 2026-09-06 — OBEJŚCIE: 1 karton przy upp=1, cofnąć po wadze kartonu od Pago"
- NORBLIN__P145 0.5/1.5/1.5 false false "norblin-rollout 2026-08-18: arkusz min/max"
- WOLA__P145: no row

## B — Coca-Cola (P068, P069; new P186, P187)

products: P068 "Coca Cola" (Napoje, szt, critical, active, notes "High-volume — flag for stockout"),
P069 "Coca Cola Zero" (same). P186/P187 do not exist. max(product_id) = P185.

supplier_products: SP_COCACOLA_P068 "Coca Cola" zgrzewka upp 24 up_for_critical price 64.8 order_note "1 zgrzewka = 24 szt";
SP_COCACOLA_P069 "Coca Cola Zero" zgrzewka upp 24 up_for_critical price 62.4 order_note "1 zgrzewka = 24 szt".

location_product_settings P068 (min/max/target, crit, over, notes):
- BRACKA__P068 24/72/72 true true "baza: kopia WOLA 2026-07-16"
- BROWARY__P068 24/72/72 false false "browary-arkusz-2026-08-31"
- KEN__P068 24/72/72 true true "ken-arkusz-2026-08-31; week1-feedback-targets 2026-09-06"
- NORBLIN__P068 50/120/120 false false "norblin-rollout 2026-08-18: arkusz min/max"
- WOLA__P068 24/96/96 true true "ESTIM - verify after first order cycle"
- ELEKTROWNIA, KAMIENICA, SLONY, STARY_BROWAR, SUPERSAM, WESTFIELD: 0/0/0 false false "threshold TBC (sheet had no min/max)" (untouched)

location_product_settings P069:
- BRACKA__P069 24/96/96 true true "baza: kopia WOLA 2026-07-16"
- BROWARY__P069 48/96/96 false false "browary-arkusz-2026-08-31"
- KEN__P069 24/96/96 true true "ken-arkusz-2026-08-31; week1-feedback-targets 2026-09-06"
- NORBLIN__P069 70/144/144 false false "norblin-rollout 2026-08-18: arkusz min/max"
- WOLA__P069 24/120/120 true true "ESTIM - verify after first order cycle"
- inactive locations: 0/0/0 (untouched)

Rows DELETED by section B (full rollback values above): WOLA__P068, WOLA__P069, BRACKA__P068, BRACKA__P069,
KEN__P068, KEN__P069.

## C — Filber Korfu + lemonades

supplier_products (all purchase_unit zgrzewka, upp 6, active):
- SP_FILBER_P075 Lemoniada Lemon up_for_critical 35.7 order_note "1 zgrzewka = 6 szt"
- SP_FILBER_P076 Lemoniada Orange up_for_critical 35.7 order_note "1 zgrzewka = 6 szt"
- SP_FILBER_P077 Lemoniada Grapefruit up_for_critical 35.7 order_note "1 zgrzewka = 6 szt"
- SP_FILBER_P136 Corfu Lager up_for_critical NULL order_note "1 zgrzewka = 6 szt"
- SP_FILBER_P137 Corfu Weiss up_for_critical NULL order_note "1 zgrzewka = 6 szt"
- SP_FILBER_P138 Corfu Free up_for_critical NULL order_note "1 zgrzewka = 6 szt"
- SP_FILBER_P157 Corfu Pilsner full_only 7.6 order_note NULL notes "zgrzewka 6 szt (inventory-confirm-and-history 2026-09-06)"

## D — Sponges (P121), scrubbers (P122), grill brush (new P188)

products: P121 "Gąbka do naczyń" Chemia inventory_unit opak; P122 "Druciak do mycia" Chemia szt. P188 does not exist.
supplier_products: SP_BLUESERV_P121 opak upp 1 full_only 0.6 active order_note NULL;
SP_BLUESERV_P122 szt upp 1 full_only 1.88 active order_note NULL. SP_MORY_P122 / SP_MORY_P188 do not exist.
location_product_settings P121: WOLA__P121 1/3/3 false false "ESTIM - verify after first order cycle; week1-feedback-targets 2026-09-06";
BRACKA 5/10/10; BROWARY 6/12/12; KEN 6/24/24; NORBLIN 5/20/20 (untouched). P122 untouched (WOLA 4/15/15, BRACKA 5/10/10,
BROWARY 12/24/24, KEN 5/18/18, NORBLIN 5/20/20). No P188 settings exist.

## E — Gas bottles (P181, P182)

supplier_products SP_KAMINO_P181 "Butla gazowa 10L" szt upp 1 full_only 55.61 order_note NULL notes "cena z SP_KAMINO_P134".
location_product_settings P181: WOLA__P181 2/8/8 false false "kopia P134 2026-09-06"; BRACKA__P181 2/8/8 (same);
KEN__P181 2/8/8 (same); NORBLIN__P181 0/0/0 false false "kopia P134 2026-09-06".
P182: NORBLIN__P182 0/0/0 false false "stan w użyciu — bez progów (2026-09-06)" (WOLA/BRACKA/KEN P182 identical, untouched).
Rows DELETED by section E: NORBLIN__P181, NORBLIN__P182 (values above).

## F — Bombilla (P135)

supplier_products SP_BUKAT_P135 szt upp 1 full_only 8 active true. (SP_EUROFOOD_P135 already inactive, untouched.)
location_product_settings P135 (DELETED by section F): BRACKA__P135 0/0/0 false false "baza: kopia WOLA 2026-07-16";
BROWARY__P135 0/0/0 false false "browary-arkusz-2026-08-31"; KEN__P135 2/10/10 false false "baza: kopia WOLA 2026-07-16";
NORBLIN__P135 0/0/0 false false "norblin-rollout 2026-08-18: brak na liscie CSV Norblin"; WOLA__P135 2/10/10 false false "".

## G — Names and notes

- products P017 product_name_pl "Florinis"; supplier_products SP_INTERMLECZ_P017 supplier_product_name "Florinis"
  (SP_KUCHNIE_P017 / SP_SELGROS_P017 inactive, name "Florinis", untouched).
- SP_BUKAT_P011 purchase_unit wiadro, order_note "1 karton = 6 szt (18 kg)", notes "1 wiadro = 3 kg (cena=40 zł/wiadro".
- SP_INTERMLECZ_P015 order_note NULL.
- SP_BUKAT_P016 order_note NULL; SP_BUKAT_P018 order_note NULL.
- suppliers SUP_MORY notes "Magazyn własny (Mory) — odbiór własnym kierowcą, nie zewnętrzny dostawca. Opakowania firmowe PB + przyprawa do souvlakow. Odrębny od SUP_INTERNAL (produkcja na miejscu) i od Pago/Lineage (mrożonki)."

## H — Supplier days

Skipped this round (operator 2026-09-19: still TBD). suppliers.delivery_days / cutoff_time unchanged.

## I — Location e-mail (after migration 0019)

`locations.email` column does not exist before 0019. Addresses (source: Marek's "Raport z punktów" e-mail
2025-07-28, plus Beniamin's 2026-09-17 mail to pitabrosbrowary@): WOLA wolskapitabros@gmail.com,
BRACKA pitabrosbracka@gmail.com, NORBLIN norblinpitabros@gmail.com, KEN pitabrosken@gmail.com,
BROWARY pitabrosbrowary@gmail.com; inactive: ELEKTROWNIA pitabroselektrownia@gmail.com, FORUM pitabrosforum@gmail.com,
STARY_BROWAR pitabrospoznan@gmail.com.

## J — Order cleanup (operator permission 2026-09-19)

manager_sent WITH receipts → closed (17): ORD-20260616-WOL-BUKA-911e57, ORD-20260615-WOL-BUKA-c091f5,
ORD-20260622-WOL-BUKA-8d47ce, ORD-20260622-WOL-BUKA-6da9a4, ORD-20260622-WOL-BUKA-f1e2d3, ORD-20260623-WOL-BUKA-2dd089,
ORD-20260623-WOL-BUKA-a5c54d, ORD-20260624-WOL-BUKA-f9826d, ORD-20260627-WOL-BUKA-f66919, ORD-20260628-WOL-BUKA-0f9139,
ORD-20260629-WOL-BLUE-b05222, ORD-20260629-WOL-INTE-579480, ORD-20260702-WOL-BUKA-b541a3, ORD-20260713-WOL-INTE-c76735,
ORD-20260713-WOL-BLUE-78ca5e, ORD-20260713-WOL-BUKA-0f1721, ORD-20260714-WOL-BUKA-2fd2f1.

manager_sent WITHOUT receipts, sent before 2026-09-01 → closed (18): ORD-20260620-WOL-BUKA-304eba,
ORD-20260620-WOL-BUKA-7bffbc, ORD-20260622-WOL-BUKA-8ac755, ORD-20260623-WOL-INTE-d9570e, ORD-20260703-WOL-INTE-542992,
ORD-20260706-WOL-BUKA-f9730a, ORD-20260709-WOL-BUKA-b4d788, ORD-20260709-WOL-INTE-7ac047, ORD-20260616-WOL-BUKA-499c65,
ORD-20260714-WOL-KUCH-a27c33, ORD-20260714-WOL-BLUE-78d932, ORD-20260723-WOL-INTE-16a1f7, ORD-20260724-WOL-BUKA-f08c58,
ORD-20260724-WOL-INTE-6320a7, ORD-20260731-WOL-INTE-ab35b3, ORD-20260813-WOL-BUKA-a514fe, ORD-20260813-WOL-INTE-9cf7e6,
ORD-20260730-WOL-PAGO-163f86.

manager_claimed submitted before 2026-09-12 → cancelled (7; all cancelled_at/by/reason were NULL/""):
ORD-20260902-BRA-PAGO-3a9bea, ORD-20260902-BRO-PAGO-a1fbe8, ORD-20260902-ELE-PAGO-c11e06 (members of draft
TRN-20260902-PAGO-aa283f), ORD-20260902-BRA-COCA-c673c7, ORD-20260904-KEN-PAGO-626d49, ORD-20260907-KEN-PAGO-63620f,
ORD-20260907-BRA-PAGO-ffdb4f. transport_batches TRN-20260902-PAGO-aa283f status draft → cancelled.
Left for Marek (manager_claimed, 14–15.09): ORD-20260914-WOL-PAGO-61280b, ORD-20260914-KEN-PAGO-9ec6c9,
ORD-20260914-BRA-PAGO-dbb70d, ORD-20260915-BRO-FILB-b10d70. September manager_sent (15) untouched.
