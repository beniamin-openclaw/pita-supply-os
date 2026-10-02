# Naming pass — proposed names (read-only proposal, 2026-10-01)

Rule (operator 2026-10-01): the names on Marek's Norblin min/max sheet are correct; a product name should be the
name on the supplier's invoice or close to it. Both names change (operator answer to Q2):

- `products.product_name_pl` — what Captains and the Manager see → the Norblin sheet name.
- `supplier_products.supplier_product_name` — what the supplier e-mail and Transport documents print → the invoice
  name, verbatim, where we have one; otherwise the new screen name.

Sources: `Norblin - Inwentaryzacja - min_max (1).csv` (operator, 2026-10-01); invoice lines in the eBiuro mirror
(`finance_document_lines`, KEN company only, 27 documents 03.08–07.09.2026). Products whose sheet name equals the
prod name and that have no invoice are left as they are.

## Batch N1 — Intermlecz (sheet + invoice)

| ID | Now (screen = supplier) | New screen name (sheet) | New supplier name (invoice) | Note |
|---|---|---|---|---|
| P001 | Masło MR 500g | Masło MR 500g (no change) | KRUSZWICA MASŁO ROŚLINNE 500g/12 kubek | KEN invoice 6.58 zł vs prod price 6.27 — confirm same product |
| P013 | Oliwki kalamata | Oliwki kalamata 2kg Bidon | GREEK OLIWKI KALAMATA Z PESTKĄ 2kg/6 BIDON | |
| P015 | Halloumi | Halloumi Reha 200gr | EURIAL REHA HALLOUMI SER DO GRILLOWANIA 200g/12 | |
| P017 | Papryka grillowana grecka Florina (Florinis) | Helcom Papryka Grillowana Czerwona 4,2kg/2,5kg | (no invoice) = screen name | **Q:** product changed from Florinis to Helcom? prod pack = 3.6 kg |
| P021 | Frytki Aviko (opakowania) | Frytki Aviko Super Crunch 9,5mm 2,5kg | AVIKO FRYTKI SUPER CRUNCH 9,5mm 2,5kg/4 | + carton entry (plan Phase 2) |
| P022 | Frytki z batatów (opakowania) | Frytki z batatów Aviko 2,27kg | AVIKO FRYTKI Z BATATÓW 9,5mm 2,27kg/5 | |
| P023 | Fasolka Szparagowa (op.) | Fasolka Szparagowa mrożona 2,5kg | IMF FASOLKA SZPARAGOWA ZIELONA CIĘTA 2,5kg/4 | |
| P038 | Frytura Eppo 15L | Frytura Effo 15L | EFFO DEEP FRY FRYTURA ROŚLINNA 15L BIB | sheet and prod both say "Eppo"; the brand is Effo |
| P040 | Woda 5l pracownicza | Woda 5L | KURACJUSZ WODA NIEGAZOWANA 5L | |
| P041 | Olej Rzepakowy 5 L | Olej Rzepakowy 5 L (no change) | OLEJ UNIWERSALNY RZEPAKOWY 5L (4) | |
| P042 | Ketchup Fanex VII 1,1 kg | (no change) | FANEX KETCHUP VII 1,1kg/4 PREMIUM | |
| P043 | DEVELEY MUSZTARDA 3 kg | Develey Musztarda 3 kg | (no invoice) = screen name | case only |
| P044 | FANEX MAJONEZ 4kg | Fanex Majonez 4kg | FANEX MAJONEZ 4kg SAŁATKOWY WYŚMIENITY | |
| P045 | Oliwa z Oliwek 1L | (no change) | GREEK OLIWA Z OLIWEK POMACE HELCOM 1L/15 plastik | |
| P046 | CIECIORKA | Cieciorka w zalewie 400g/240g | ROLNIK CIECIORKA W ZALEWIE 400g/240g (12) puszka | |
| P047 | Kasza Pęczak Melvit 900g | (no change) | MELVIT KASZA PĘCZAK 900g/10 | |
| P048 | Sriracha chili 730 ml | (no change) | ASIA SOS SRIRACHA CHILI PIKANTNY FG 730ml/12 | |
| P049 | Miód 1 kg | (no change) | CD MIÓD WIELOKWIATOWY 1kg/6 | |
| P050 | Pieprz | Prymat Pieprz | (no invoice) = screen name | **Q:** unit is `kg` in prod, sheet counts `Opak` |
| P051 | Oregano | Prymat Oregano | (no invoice) = screen name | same unit question |
| P052 | Papryka słodka - mielona | Prymat Papryka słodka - mielona | PRYMAT PAPRYKA SŁODKA 720g/9 pet | prod price 25.76 = one 720 g jar, but unit says `kg` |
| P053 | Sól 1kg | Sól kamienna 1kg | (no invoice) = screen name | |
| P054 | Liść Laurowy (supplier: Liść Laurowy 80g) | Prymat Liść Laurowy 80g | (no invoice) = Prymat Liść Laurowy 80g | operator: 80 g everywhere |
| P055 | Ziele Angielskie (supplier: Ziele Angielskie 500g) | Kamis Ziele Angielskie | (no invoice) = Kamis Ziele Angielskie 500g | keep the pack size the supplier name already has |
| P140 | KAWA JACOBS CRONAT GOLD ROZPUSZCZALNA 200g/6 | Kawa Jacobs Cronat Gold Rozpuszczalna 200gr | KAWA JACOBS CRONAT GOLD ROZPUSZCZALNA 200g/6 | supplier name unchanged |
| P141 | LIPTON HERBATA YELLOW LABEL 100szt./12 koperta | Herbata Lipton Yellow Label 100szt | (no invoice) = current supplier name kept | |
| P189 | Cukier w kostkach Diament 1kg | **Q:** 1 kg or 0,5 kg? | DIAMANT CUKIER KOSTKA BIAŁY 0,5kg/10 (operator) | price 4.08 zł netto (operator) |
| P057, P058 | Sól / Pieprz w saszetkach 5g | (no change) | (no change) | |

## Batch N1 — other suppliers on the Norblin sheet

| ID | Now | New screen name | New supplier name | Note |
|---|---|---|---|---|
| P012 | Hot Feta 2kg (supplier: Hot Feta (Tirokafteri) 2kg) | Tirokafteri 2kg | (no change) | sheet name |
| P084 | Opakowaie sałatki duże jednocześciowe 750ml | Opakowanie sałatki duże jednoczęściowe 750ml | see Batch N2 | typo fix (sheet has the same typo) |
| P085 | Opakowanie sałatki małe jednocześciowe 250ml | Opakowanie sałatki małe jednoczęściowe 250ml | see Batch N2 | typo fix |
| P094 | Torby fałdowane pojedycze do pity | Torby fałdowane pojedyncze do pity | see Batch N2 | typo fix |
| P095 | Folia Alumiuniowa | Folia Aluminiowa | see Batch N2 | typo fix |
| P121 | Gąbka do naczyń | Gąbka do naczyń 10szt | (no change) | sheet name; counted in szt (×10 conversion already in thresholds) |

All other Norblin-sheet rows (Bukat produce, Coca-Cola, Filber, Blue Service, Pago, Mory) already match prod
or are less precise than prod (e.g. sheet "Coca Cola" vs prod "Coca-Cola 0,33 l puszka") — left as they are.
"Pita (opakowania) szt 10" (Pago) keeps its GoStock-style name: it is the sheet name and there is no Pago invoice
in the mirror.

## Batch N2 — supplier names only, from invoices (products not changed on screen)

Optional second step; only the name the supplier sees changes. One KEN invoice per line — confirm the other
locations buy the same item.

| ID | Screen name (unchanged) | Supplier name (invoice) |
|---|---|---|
| P082 | Bowl opakowanie papierowe miska 1300 ml | Miska/pojemnik papierowy na sałatkę 1300ml PE(185) kraft 50 sztuk 56895 |
| P083 | Bowl opakowanie pokrywka plastik 1300 ml | Pokrywka do miski na sałatkę (185) 1100/1300 ml opak 50sztuk 44915 |
| P084 | Opakowanie sałatki duże… 750ml | Pojemnik/pucharek PET okrągły z łączonym wieczkiem 750ml opak. 50 sztuk SLR750C |
| P085 | Opakowanie sałatki małe… 250ml | Pojemnik/pucharek PET okrągły z łączonym wieczkiem 250ml/ opak. 50 sztuk 45138 |
| P086 | Sos opakowanie pojemnik | Pojemnik na sos/sosjerka 80 ml PP transparent opak. 100 sztuk 3450 |
| P087 | Sos opakowanie pokrywka | Pokrywka do pojemnika na sos PET 30/50/80 ML opak. 100 sztuk 3456 |
| P093 | Torba na wynos z uszami | TORBA PAPIEROWA BRĄZOWA uchwyt płaski 320x220x250 250 sztuk |
| P094 | Torby fałdowane pojedyncze do pity | Torebki papierowe fałdowane 18x6x35 opakowanie 250 sztuk BIAŁE/BRĄZOWE |
| P095 | Folia Aluminiowa | Folia Aluminiowa 1,5 kg 45 cm CATERING |
| P096 | Folia spożywcza | FOLIA SPOŻYWCZA 45 cm/ 180 m KRAM Catering |
| P097 | Papier Pergamin do pieczenia | Papier do pieczenia 50/38 cm BRĄZOWY Z TULEJKĄ GOOD PRICE |
| P100 | Jednorazowe Noże | NÓŻ WPC opak 100 szt. 1107 reuse |
| P101 | Jednorazowe Widelce | WIDELEC WPC opak 100 szt. wielorazowy 1108 |
| P104 | Ręczniki papierowe ZZ | LAMIX V Cliver Economic 4000 - szary 2226 |
| P106 | Domestos 5L | Domestos Prof. Pine Fresh 5L |
| P111 | Fenix grill cleaner 1L | Feniks Professional Grill Cleaner 1L |
| P112 | Fenix degreaser 1L | Feniks Professional Degreaser 1L odtłuszczacz |
| P020 | Falafel (Kuchnie Świata) | Falafel standard. bób/ciecierzyca mroż. 5kg |
| P059 | Ionos Wino Białe 750ml | Cavino Ionos BW GRE 0,75l Roditis, Moschato |
| P061 | Ionos Wino Czerwone 750 ml | Cavino Ionos CW GRE 0,75l Cabernet Sauvignon, Merlot |
| P072 | Retsina 500 ml | Malamatina Retsina 0,5L BW GRE |
| P073 | Mythos | Piwo Mythos butelka 330ml (24szt/krt) |
| P136 | Corfu Lager | Piwo Corfu Premium Lager 0,5 L |
| P137 | Corfu Weiss | Piwo Corfu Amorosa Weiss 0,5 L |
| P157 | Corfu Pilsner | Piwo Corfu Ionian Pilsner 0,5 L |

Not mapped on purpose: gloves (invoice is black nitrile at 14.50 zł/100, prod price 9.75 — may be a different
item), Coca-Cola family (invoice codes like "0.25 RGB X24 FANTA ORANGE" are worse than the current names),
Bukat produce (invoice names carry origin and class, e.g. "Pomidor (waga) Okrągły Czerwony ( BB) Kraj poch: Polska,
klasa I"), and P109 Tenzi vs the Cif glass cleaner on the invoice (P169 Cif has no active supplier).

## Side findings from the invoices (not part of the naming pass)

- Coca-Cola invoices for KEN bill Cappy, Fanta and Sprite as "0.25 RGB X24" (glass, crate of 24). Prod has
  Cappy as zgrzewka × 12 and Fanta/Sprite as zgrzewka × 24 with no glass variant — relevant to the open
  "Cappy 12/24" item in `master-data-followups`.
- Products on the Norblin sheet with a different counting label than prod (thresholds were copied 1:1, so only
  the label differs): Torba na wynos (sheet Szt, prod box), Torby fałdowane (Szt vs opak), Serwetki białe (Box vs
  opak), Worki 120 L (Opak vs szt), Miód 1 kg (Szt vs kg), the Prymat spices (Opak vs kg).
