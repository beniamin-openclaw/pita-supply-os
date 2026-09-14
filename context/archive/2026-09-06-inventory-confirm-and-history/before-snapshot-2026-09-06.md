# BEFORE snapshot — prod, 2026-09-06 (this IS the rollback reference)

## products
| id | name | category | unit | active | notes |
|---|---|---|---|---|---|
| P012 | Tirokafteri | Chłodnia | kg | true | |
| P036 | Kasza Pęczak | Produkcja | kg | true | Made internally |
| P037 | Gyros (ścięty + nieścięty) | Produkcja | kg | true | Internal — sliced + unsliced gyros mix |
| P046 | CIECIORKA | Spożywcze | szt | true | Chickpeas for falafel |
| P134 | Butla gazowa 10L | Gaz | szt | true | Gas cylinder |
| P135 | Bombilla | Napoje | szt | true | dodane 2026-07 (feedback r4) |
| P157 | Corfu Pilsner | Napoje | szt | true | added 2026-08-22 (multi-location-master-data) |
Max product_id = P184 (P176–P182 free).

## supplier_products
| id | supplier | product | unit | upu | price | active | notes |
|---|---|---|---|---|---|---|---|
| SP_BUKAT_P012 | SUP_BUKAT | P012 | wiadro | 3 | 60.00 | true | 1 wiadro = 3 kg |
| SP_PAGO_P012 | SUP_PAGO | P012 | kg | 3 | 64.00 | false | packaging copied from SP_BUKAT_P012 |
| SP_INTERNAL_P037 | SUP_INTERNAL | P037 | kg | 1 | 0 | true | Internal production |
| SP_KAMINO_P134 | SUP_KAMINO | P134 | szt | 1 | 55.61 | true | |
| SP_FILBER_P157 | SUP_FILBER | P157 | szt | 1 | 7.60 | **false** | packaging TBC |
No SP rows for SUP_SPEC, SUP_ALLEGRO; SUP_SELGROS has 39 rows, all inactive.

## location_product_settings (min/max/target)
P037: WOLA 1/3/3, BRACKA 1/3/3, KEN 1/3/3, NORBLIN 1.3/3.8/3.8, BROWARY 15/25/25,
      ELEKTROWNIA, KAMIENICA, SLONY, STARY_BROWAR, SUPERSAM, FORUM 0/0/0.
P134: WOLA 2/8/8, BRACKA 2/8/8, KEN 2/8/8, NORBLIN 0/0/0.
P157: STARY_BROWAR 0/0/0 only.
Reference rows: P136 Corfu Lager WOLA 6/6/6, KEN 6/6/6, BRACKA 5/12/12; P024 Gyros 15 KG KEN 2/10/10 (critical).

## suppliers
| id | name | email | method | active | notes |
|---|---|---|---|---|---|
| SUP_SPEC | Spec Food | null | manual | false | method TBC by operator |
| SUP_ALLEGRO | Allegro | null | portal | false | NIEAKTYWNY celowo … ustaw active=TRUE razem z pierwszymi supplier_products |
| SUP_SELGROS | Selgros | null | manual | false | method TBC by operator |
| SUP_KAMINO | Kamino | TBD | phone | true | Gas cylinders |

## Spec Food facts (Gmail, beniamin@ mailbox, Nov–Dec 2025)
Contact: Łukasz Raczkowski, l.raczkowski@specfood.pl, tel. 502-725-701. Product ordered by KEN:
"Kebab z Kurczaka 50/50 15KG", 3–4 szt per order, delivery window 11:00–12:00, Al. KEN 21 U13
(wjazd od tyłu, od ul. Karola…). Invoices: klaudia@pitabros.pl. Orders sent from ken@/biuro@ aliases.
