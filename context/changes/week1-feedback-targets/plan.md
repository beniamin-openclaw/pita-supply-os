# Tydzień 1 Supply OS — feedback kapitanów: plan implementacji

**Status: WYKONANE 2026-09-06 (tory A, B, C; D czeka na wysyłkę przez operatora w poniedziałek).
Szczegóły i post-implementation review w `change.md`; SQL as-applied w `prod-sql.sql`.**

Cztery tory, niezależne od siebie, w kolejności wykonania:

| Tor | Co | Kod / deploy | Kto zatwierdza |
|---|---|---|---|
| A | Master data prod (KEN, Wola, Browary, nowy produkt) | brak (dane) | operator |
| B | Aplikacja: powód „zapas do następnej dostawy” | frontend + backend enum, deploy | operator |
| C | Nutka do managera (pytania) | — | operator wysyła |
| D | Komunikat do zespołu (co zmieniono + zasada magazynu) | — | operator wysyła |

Tor A i D są ze sobą związane: komunikat D wysyłamy dopiero po odpaleniu SQL z A,
żeby „zmieniliśmy” było prawdą.

---

## 1. Co już jest zrobione (nie ruszać)

Sprawdzone w repo i na prod 2026-09-06 wieczorem:

| Zgłoszenie | Stan | Gdzie |
|---|---|---|
| Ela: „po wysłaniu wszystko się wyzerowało” | ekran „Remanent zapisany” + przycisk Historia na prod | a3d7013 |
| Ajith: gyros kurczak w inwentaryzacji KEN | P178 „Gyros kurczak ścięty” + P179 blok Spec Food, tylko KEN | a3d7013 |
| Ajith / Mirsini: Corfu Pilsner | P157 aktywny, ustawienia WOLA/BRACKA/KEN target 6 | a3d7013 |
| Mirsini: butle gazowe pełne/puste | P181/P182 | training-feedback-0901 ph3, odpalone 2026-09-06 |
| Tushar: 3 pozycje do usunięcia z Intermlecz | zrobione 2026-09-06 11:35 | czat |
| chaos jednostek (szt vs zgrzewki, kg vs kartony) | podpowiedź „N szt = M zgrzewek” na zamówieniach i inwentaryzacji | 9ff1518 |
| P037 „Gyros (ścięty+nieścięty)” policzony dziś przez 3 lokale mimo `active=false` | dezaktywacja weszła 18:15, inwentaryzacje były 11:05–14:22 → zgodne, nie bug | — |

Otwarte po Ajicie: brak linii **„Gyros kurczak nieścięty”** na KEN (jest tylko ścięty). Dodaję w torze A.

---

## 2. Tor A — master data prod (SQL)

### 2.1 Decyzje (zatwierdzone przez operatora 2026-09-06)

Wartości w jednostce ewidencyjnej (`*_qty_base`): napoje w **butelkach**, tzatzyki w **kg**,
reszta w szt/opak. `max = target` (konwencja w bazie).

**KEN**

| Produkt | id | Dziś min / target | Po zmianie min / target | Uzasadnienie |
|---|---|---|---|---|
| Halloumi | P015 | 24 / 72 | **24 / 60** | Khushi: max 5 kartonów. Stan+zamówienie 4.09 = 60. |
| Coca Cola | P068 | 24 / 96 | **24 / 72** (3 zgrz.) | Prośba 48 odrzucona: dziś na stanie 105 szt; produkt krytyczny; min. Coca-Cola 500 zł. |
| Coca Cola Zero | P069 | 24 / 120 | **24 / 96** (4 zgrz.) | jw., na stanie 142 szt. |
| Kropla gazowana | P071 | 24 / 48 | **12 / 24** | niekrytyczna, Bracka ma 24. |
| Kropla niegazowana | P070 | 24 / 48 | **12 / 24** | jw. |
| Tzatzyki | P011 | 3 / 8 | **6 / 18** (6 wiader) | manager sam podniósł do 6 wiader; Bracka/Browary 36. |
| Retsina 500 ml | P072 | 2 / 2 | **3 / 12** | na stanie 12 (kupują poza systemem); parytet z Bracką. |
| Lemoniada Grapefruit | P077 | 10 / 48 | **6 / 24** (4 zgrz.) | stan 21; wrzesień. Wrócić w maju. |
| Lemoniada Lemon | P075 | 10 / 48 | **6 / 24** | stan 30. |
| Lemoniada Orange | P076 | 10 / 48 | **6 / 24** | stan 22. |
| Corfu Lager | P136 | 6 / 6 | **6 / 12** | stan 12; Bracka 12. |
| Corfu Weiss | P137 | 6 / 6 | **6 / 12** | stan 16. |
| Corfu Free | P138 | 6 / 6 | **6 / 12** | stan 10. |
| Corfu Pilsner | P157 | 6 / 6 | **6 / 12** | parytet z resztą Corfu (Khushi wymieniła wszystkie 4). |
| Ocet spirytusowy | P039 | 0,5 / 1,5 | **0 / 0** | „nie używamy”; Bracka/Browary już 0. Pytanie do managera (C-4). |
| Olej rzepakowy 5 L | P041 | 2 / 5 | **1 / 2** | prośba „1” odrzucona: brak oleju = brak frytek; przy stanie 1,25 sugestia = 1 szt. |
| Develey musztarda 3 kg | P043 | 0 / 3 | **1 / 2** | prośba „1” zmieniona na parytet z Wolą (1/2). Przy stanie 3 sugestia 0 przez wiele tygodni. |
| Fanex majonez 4 kg | P044 | 0 / 4 | **1 / 2** | jw. (stan 4). |

> **Korekta po hardeningu:** `min_stock_qty_base` **nie wchodzi do silnika sugestii** (`suggestion.py` liczy tylko
> `max(0, target − stan)`; `min` jest wyłącznie wyświetlany na karcie produktu). Uzasadnienia typu „min 0 = zamówią
> dopiero po wyczerpaniu” były błędne. Wartości `min` zostawiam jak wyżej dla spójności z innymi lokalami, ale
> **jedyną liczbą, która zmienia zachowanie aplikacji, jest `target`** (i `max`, tylko w komunikacie „exceeds max”).

> **Skutek uboczny do świadomej akceptacji:** `max = target` + zaokrąglanie w górę dla produktów krytycznych
> (`up_for_critical` na całej Coca-Coli) oznacza, że przy stanie 40 i targecie 72 system zaproponuje 2 zgrzewki
> (= 88 szt) z dopiskiem „exceeds max by 16”. To nie blokuje zamówienia (bramka over-MAX działa tylko przy
> niepoliczonym stanie). Zachowanie identyczne jak dziś, tylko na niższym poziomie.

**WOLA**

| Produkt | id | Dziś | Po zmianie | Uzasadnienie |
|---|---|---|---|---|
| Gąbka do naczyń | P121 | 4 / 10 | **1 / 3** | opak = 5–10 szt; Tushar zamawia 2 opak (2× w historii). |
| Rękawiczki M | P118 | 3 / 12 | **2 / 6** | 4 zamówienia, śr. 3,8 opak. L (śr. 7,3/12) i XL bez zmian. |
| Rucola 125 g | P007 | 5 / 15 | **4 / 10** | 22 zamówienia, śr. 7,7 opak, 2×/tydz., krótki termin. Bracka 10. |

**BROWARY**

| Produkt | id | Dziś | Po zmianie | Uzasadnienie |
|---|---|---|---|---|
| Bifteki burgers, `SP_PAGO_P145.units_per_purchase_unit` | P145 | 1 (karton = 1 kg) | **`<KG_NA_KARTON>`** | błąd przelicznika; wartość od Pago/managera (C-1). **Blokuje** tę jedną linię, reszta A idzie bez niej. |
| **Bifteki, obejście na już:** `BROWARY__P145.target/max` | P145 | 1 / 4 | **0 / 1** (do czasu wagi kartonu) | Przy `upp=1` target 4 = „4 kartony”, stąd blokada Uliany. Target 1 = sugestia 1 karton przy stanie 0, bez wymuszonego powodu. Po poprawie `upp` wrócić do targetu w kg. Wpis w `notes`, żeby nikt nie uznał 1 za docelowe. |

**Nowy produkt (KEN)**

- `P185` „Gyros kurczak nieścięty”, kategoria `Produkcja`, `kg`, `SUP_INTERNAL`, ustawienie KEN 1 / 3 (kopia P178).
  Przed odpaleniem sprawdzić `max(product_id)` — dziś `P184`.

### 2.2 Zasada „diff before, audit after” (lessons.md)

Plik `prod-sql.sql` w tym folderze powstaje przy wykonaniu, wg wzorca
`context/archive/2026-09-05-rolki-minima-master-data/prod-sql.sql`:
(1) BEFORE snapshot z dokładnymi starymi wartościami (= rollback), (2) UPDATE-y, (3) AFTER audit.

### 2.3 SQL (draft do wklejenia w `prod-sql.sql`)

```sql
-- week1-feedback-targets — PROD Supabase lpzhphufjwrndfogkfub. Data only, no deploy.
-- Source: Connect Teams 2026-09-06 (Khushi 19:49, Tushar 18:48) + operator decisions.

-- (1) BEFORE — run first, paste output into this file as the rollback record
SELECT setting_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base, notes
FROM location_product_settings
WHERE setting_id IN (
  'KEN__P015','KEN__P068','KEN__P069','KEN__P071','KEN__P070','KEN__P011','KEN__P072',
  'KEN__P077','KEN__P075','KEN__P076','KEN__P136','KEN__P137','KEN__P138','KEN__P157',
  'KEN__P039','KEN__P041','KEN__P043','KEN__P044',
  'WOLA__P121','WOLA__P118','WOLA__P007')
ORDER BY setting_id;
SELECT supplier_product_id, units_per_purchase_unit, notes FROM supplier_products WHERE supplier_product_id='SP_PAGO_P145';
SELECT max(product_id) FROM products;  -- expect P184

-- (2) UPDATES
BEGIN;
WITH v(setting_id, mn, tgt) AS (VALUES
  ('KEN__P015', 24, 60),
  ('KEN__P068', 24, 72),  ('KEN__P069', 24, 96),
  ('KEN__P071', 12, 24),  ('KEN__P070', 12, 24),
  ('KEN__P011',  6, 18),
  ('KEN__P072',  3, 12),
  ('KEN__P077',  6, 24),  ('KEN__P075',  6, 24),  ('KEN__P076',  6, 24),
  ('KEN__P136',  6, 12),  ('KEN__P137',  6, 12),  ('KEN__P138',  6, 12),  ('KEN__P157', 6, 12),
  ('KEN__P039',  0,  0),
  ('KEN__P041',  1,  2),
  ('KEN__P043',  1,  2),  ('KEN__P044',  1,  2),
  ('WOLA__P121', 1,  3),
  ('WOLA__P118', 2,  6),
  ('WOLA__P007', 4, 10),
  ('BROWARY__P145', 0, 1)   -- bifteki OBEJŚCIE: 1 „karton” przy upp=1; cofnąć po C-1
)
UPDATE location_product_settings s
SET min_stock_qty_base = v.mn,
    target_stock_qty_base = v.tgt,
    max_stock_qty_base = v.tgt,
    notes = trim(both '; ' from coalesce(s.notes,'') || '; week1-feedback-targets 2026-09-06')
FROM v WHERE s.setting_id = v.setting_id;
-- expect: UPDATE 22
-- (dopisać do BEFORE: 'BROWARY__P145' → dziś 1 / 4 / 4)

-- Gyros kurczak nieścięty (KEN) — mirror of P178
INSERT INTO products (product_id, product_name_pl, product_category, inventory_unit, is_critical, active, notes)
VALUES ('P185', 'Gyros kurczak nieścięty', 'Produkcja', 'kg', false, true, 'Tylko KEN; blok w zamrażarce, z P179 (2026-09-06, Ajith)');
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes)
VALUES ('SP_INTERNAL_P185', 'SUP_INTERNAL', 'P185', 'Gyros kurczak nieścięty', 'kg', 1, 'full_only', 0, true, 'Internal production (KEN)');
INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
VALUES ('KEN__P185', 'KEN', 'P185', 1, 3, 3, false, false, 'week1-feedback-targets 2026-09-06 (Ajith)');
COMMIT;

-- Bifteki — ONLY after the manager confirms the carton weight (see C-1). Separate statement.
-- UPDATE supplier_products SET units_per_purchase_unit = <KG_NA_KARTON>,
--   notes = 'karton = <KG> kg wg Pago (2026-09-xx)' WHERE supplier_product_id = 'SP_PAGO_P145';
-- Dopóki upp = 1, target BROWARY__P145 4 kg oznacza „4 kartony” → po korekcie upp
-- sprawdzić, czy target 4 kg ma sens (Uliana zamawia 1 karton).

-- (3) AFTER audit
SELECT setting_id, min_stock_qty_base mn, target_stock_qty_base tgt, max_stock_qty_base mx
FROM location_product_settings
WHERE notes LIKE '%week1-feedback-targets%' ORDER BY setting_id;   -- expect 23 rows (22 UPDATE + KEN__P185)
SELECT count(*) FROM location_product_settings WHERE min_stock_qty_base > target_stock_qty_base
  AND location_id IN ('KEN','WOLA','BRACKA','BROWARY','NORBLIN');   -- expect 0
```

Uwagi do kolumn: wzorzec INSERT-ów skopiować 1:1 z `context/changes/inventory-confirm-and-history/prod-sql.sql`
(P176–P179 wstawione dziś) — tam są dokładne nazwy kolumn `supplier_products` po migracjach 0006–0015
(`order_note`, `unit_weight_kg`, `supplier_sku`, `warehouse_pickup NOT NULL DEFAULT false`).

### 2.4 Weryfikacja po SQL

- `/api/captain/orderable?supplier_id=SUP_COCACOLA` tokenem KEN: Coca Cola target 72, Zero 96.
- Inwentaryzacja KEN: linia „Gyros kurczak nieścięty” widoczna.
- Zamówienie Intermlecz KEN: musztarda/majonez sugestia 0 przy stanie 3/4 (mają zapas).
- Zamówienie Pago Browary: bifteki przy stanie 0 → sugestia 1, bez wymuszonego powodu.

### 2.5 Tor A′ — dzisiejsze snapshoty inwentaryzacji mają złe jednostki (NOWE po hardeningu)

Przelicznik „N szt = M zgrzewek” wszedł na prod o 18:59, a inwentaryzacje były 11:05–14:22. Kapitani policzyli
część produktów w opakowaniach, nie w jednostce ewidencyjnej:

| Lokal | Produkt | Wpisane | Jednostka w systemie | Prawdopodobnie |
|---|---|---|---|---|
| KEN | Halloumi | 5,5 | szt | 5,5 kartona ≈ 66 szt (Khushi: „4–5 boxes”) |
| BRACKA | Halloumi | 10,5 | szt | kartony? |
| BROWARY | Halloumi | 15,188 | szt | wygląda na kg |
| BROWARY | Gyros 15 KG | 7 | kg | 7 bloków = 105 kg (w zamówieniu 6.09 podała 75 kg) |
| KEN | Gyros 15 KG | 30 | kg | OK |

**Dlaczego to ważne:** FR-017 pre-fill bierze stan z ostatniego snapshotu. Jeśli Khushi we wtorek zamówi Intermlecz
z pre-fillem, halloumi wejdzie jako 5,5 szt → sugestia 60 − 5,5 = **55 szt** (krytyczny, zaokrąglenie w górę) →
przezamówienie o ~50 sztuk, dokładnie odwrotność tego, o co prosiła. Nowy target nie chroni przed złym stanem.

**Akcja (przed wtorkiem):**
1. Wiadomość do KEN/Bracka/Browary z prośbą o **poprawienie snapshotu** funkcją „Edytuj remanent” (Phase 2,
   training-feedback-0901, jest na prod): halloumi w sztukach, gyros w kg. Jedno zdanie, po angielsku dla KEN.
   Dopisane do komunikatu D.
2. Jeśli nie poprawią do wtorku rano: operator poprawia sam przez `PATCH /api/captain/inventory/count/{id}`
   tokenem lokalu (edit_reason „unit fix by operator”), zostaje ślad w `inventory_count_events`.
3. Sprawdzić po korekcie: `SELECT current_stock_qty_base FROM inventory_count_lines WHERE product_id='P015'`
   dla 3 dzisiejszych count_id.

---

## 3. Tor B — aplikacja: powód „zapas do następnej dostawy”

**Dlaczego:** Uliana (Browary) wybrała „event” dla 6 linii, bo zamawiała pod dostawę wtorkową, nie pod imprezę.
Bez tego powodu statystyka odchyleń kłamie, a „OTHER” z „?” rośnie.

**Zakres (mały, jeden PR, ale z migracją):**

1. **Migracja jest OBOWIĄZKOWA** (sprawdzone na prod 2026-09-06: `order_lines_reason_code_check`
   to CHECK z zamkniętą listą 7 kodów). `supply-os-v1/migrations/0016_reason_code_stock_until_next_delivery.sql`:
   `ALTER TABLE order_lines DROP CONSTRAINT order_lines_reason_code_check; ALTER TABLE order_lines ADD CONSTRAINT
   order_lines_reason_code_check CHECK (reason_code IS NULL OR reason_code IN (…7 starych…, 'STOCK_UNTIL_NEXT_DELIVERY'));`
   Migracja idzie na prod **przed** deployem kodu (inaczej pierwszy submit z nowym powodem = IntegrityError = 500).
   Rollback: odwrotny ALTER, tylko gdy żadna linia nie ma jeszcze nowego kodu.
2. `supply-os-v1/app/models.py` → `ReasonCode`: `STOCK_UNTIL_NEXT_DELIVERY = "STOCK_UNTIL_NEXT_DELIVERY"`.
3. `frontend/src/types.ts` → ten sam literał w unii `ReasonCode`.
4. `frontend/src/pages/captain-mp/types.ts` → `REASON_CODES` (jawna lista, karmi `ReasonPicker` i `OverruleAllControl`):
   wstawić po `WEEKEND_HIGH_TRAFFIC`, przed `LOW_STORAGE`.
5. `frontend/src/i18n/strings.ts` → `reason.codes.STOCK_UNTIL_NEXT_DELIVERY`:
   pl „Zapas do następnej dostawy”, en „Stock until next delivery”.
6. Testy: backend — submit z nowym kodem przechodzi bramkę odchylenia (1 test) + grep w `tests/` za listą kodów
   (jeśli jakiś test wylicza 7, poprawić na 8); FE — `compute.test.ts` nie wymaga zmian, dodać 1 asercję,
   że każdy kod z `REASON_CODES` ma klucz i18n PL i EN.
7. Kolejność wdrożenia: migracja 0016 na prod (Supabase MCP `apply_migration`) → `/verify` → commit → push
   (Railway + Vercel auto) → sprawdzić hash bundla na prod → dopiero komunikat D.

**Nie robić teraz:** target liczony pod cykl dostaw (`delivery_days` u Coca-Cola/Pago = „TBD”, brak danych),
wymuszony komentarz managera przy korekcie (osobna decyzja po odpowiedzi managera, C).

---

## 4. Tor C — nutka do managera (draft do wysłania przez operatora)

Do wysłania osobno od drafta Gmail z 2026-09-06 (korekty ilości), albo jako dopisek do niego.

```
Cześć,

4 rzeczy po feedbacku kapitanów z tygodnia 1, potrzebuję Twojej odpowiedzi:

1. Bifteki (Pago): ile kg ma karton? W systemie jest 1 karton = 1 kg i przez to Browary
   nie mogą zamówić 1 kartonu bez „powodu”. Wpiszę realną wagę.
2. Browary, Pago: Uliana pisze, że minima są za niskie na dostawę raz w tygodniu
   (gyros min 2 kg, souvlaki 15 kg). Jakie jest realne tygodniowe zużycie Browarów:
   gyros (bloki), souvlaki kurczak (kartony), pita (kartony)?
3. KEN, Coca-Cola: Khushi twierdzi, że 48 butelek wystarcza na tydzień, a dziś mają na stanie
   105 Cola + 142 Zero. Spójrz proszę na faktury Coca-Cola dla KEN z sierpnia — ile realnie schodzi?
   I drugie: minimum Coca-Cola mamy wpisane 500 zł, a zamówienie KEN z 2.09 poszło za 465 zł.
   Coca-Cola dowozi poniżej 500? Bo po obniżeniu targetów KEN tygodniowo zamówi za ~250 zł
   i albo dowożą, albo KEN zamawia co 2 tygodnie — wtedy „48 na tydzień” nie ma sensu.
4. KEN, Intermlecz 4.09: przez pomyłkę zamówili 3 wiadra musztardy (9 kg) i 4 majonezu (16 kg).
   Da się przerzucić 1 musztardę i 2 majonezy na Wolę lub Brackę przy najbliższym kursie?
   Przy okazji: KEN mówi, że nie używa octu spirytusowego — jest w jakimś standardzie kuchni?

Dzięki,
Beniamin
```

---

## 5. Tor D — komunikat do zespołu (Connect Teams, po odpaleniu A i deployu B)

Wersja PL + EN w jednej wiadomości, jak dotychczasowe ogłoszenia w tym czacie.

```
Dzięki za feedback z pierwszego tygodnia. Co zmieniliśmy:

✅ KEN: targety poprawione wg Khushi — halloumi 60, tzatzyki 18 kg, Corfu 12, Retsina 12,
   lemoniady 24, woda Kropla 24, ocet 0, olej 2, musztarda/majonez 2. Cola/Zero 72/96
   (3/4 zgrzewki), nie 48 — dziś macie na stanie 10 zgrzewek, więc miejsce jest 😉
✅ Wola: gąbki 3 opak, rękawiczki M 6, rukola 10.
✅ Inwentaryzacja: po zapisie widać potwierdzenie i przycisk Historia; gyros rozbity na
   ścięty / nieścięty (kurczak na KEN); Pilsner na Wola, Bracka, KEN.
✅ Przy każdej pozycji widać przelicznik „szt = zgrzewki / kg = kartony”, także w remanencie.
✅ Nowy powód przy zamówieniu: „Zapas do następnej dostawy” — używajcie go zamiast „Event”,
   gdy zamawiacie na cały tydzień pod termin dostawy.
✅ Bifteki na Browarach: na razie target 1 karton, żeby dało się zamówić bez „powodu”;
   docelowo poprawimy przelicznik, jak Pago poda wagę kartonu.
❗ Prośba: w dzisiejszym remanencie halloumi wpisane w kartonach (KEN 5,5, Bracka 10,5), a system
   liczy w SZTUKACH; gyros w blokach (Browary 7), a system liczy w KG. Poprawcie to proszę przez
   „Edytuj remanent”, inaczej we wtorek aplikacja zaproponuje Wam za dużo halloumi.

Jedna zasada na przyszłość: na weekend trzymajcie magazyn odpowiedzialnie, żeby starczyło,
ale w tygodniu nie zamawiajcie na zapas. Lepiej zamówić dwa razy niż przepłacać i mrozić
pieniądze w magazynie. Z aplikacją zamówienie to kilka minut, więc częstsze zamawianie nic
nie kosztuje — a niski magazyn i dobra płynność to klucz dla restauracji.

---
Thanks for the first-week feedback. What we changed:

✅ KEN: targets updated per Khushi — halloumi 60, tzatziki 18 kg, Corfu 12, Retsina 12,
   lemonades 24, Kropla water 24, vinegar 0, oil 2, mustard/mayo 2. Cola/Zero 72/96
   (3/4 cases), not 48 — you hold 10 cases today, so there is room 😉
✅ Wola: sponges 3 packs, gloves M 6, rucola 10.
✅ Inventory: confirmation + History button after saving; gyros split into cut / uncut
   (chicken at KEN); Pilsner at Wola, Bracka, KEN.
✅ Every line now shows the conversion "pcs = cases / kg = cartons", also in the count.
✅ New order reason: "Stock until next delivery" — use it instead of "Event" when you order
   for the whole week ahead of a delivery day.
✅ Bifteki at Browary: target set to 1 carton for now so it can be ordered without a "reason";
   we'll fix the conversion once Pago confirms the carton weight.
❗ Request: in today's count halloumi was entered in BOXES (KEN 5.5, Bracka 10.5) but the app counts
   PIECES; gyros in blocks (Browary 7) but the app counts KG. Please correct it via "Edit count",
   otherwise on Tuesday the app will suggest far too much halloumi.

One rule going forward: stock up responsibly for the weekend so nothing runs out, but don't
over-order during the week. Better to order twice than overpay and freeze cash in the storeroom.
With the app an order takes minutes, so ordering more often costs nothing — and low stock with
good cash flow is key for a restaurant.
```

---

## 6. Kolejność i czas

1. Operator: decyzja nad tym planem. Ewentualne korekty wartości w 2.1.
2. A (z obejściem bifteków, bez zmiany `upp`): BEFORE → UPDATE → AFTER, ~15 min. Wynik do `prod-sql.sql`.
3. C: wysłać nutkę do managera (od razu, niezależnie).
4. B: migracja 0016 na prod → implementacja → `/verify` → deploy, ~1 h. Sprawdzić bundle na prod.
5. D: wysłać komunikat po 2 i 4, **w poniedziałek** (kapitani mają czas poprawić remanent przed wtorkowymi zamówieniami).
6. A′: wtorek rano sprawdzić snapshoty halloumi/gyros; niepoprawione poprawić samemu (2.5 pkt 2).
7. Bifteki `upp`: po odpowiedzi managera osobny UPDATE (upp + powrót targetu do kg) + dopisek na czacie.
8. Archiwum: `/10x-archive week1-feedback-targets` po 7.

## 7. Ryzyka

- **Coca-Cola KEN 72/96 zamiast 48:** Khushi może uznać, że nie posłuchaliśmy. Komunikat D
  tłumaczy dlaczego (10 zgrzewek na stanie). Jeśli manager z faktur potwierdzi niskie zużycie, obniżyć do 48/72.
- **Coca-Cola KEN a minimum 500 zł:** po obniżce tygodniowe zamówienie KEN u Coca-Coli to ~250 zł. Minimum jest
  w aplikacji informacyjne (zamówienie z 2.09 za 465 zł poszło), ale jeśli Coca-Cola realnie nie dowozi poniżej
  500, „zamawiajcie częściej” z komunikatu D nie zadziała dla tego dostawcy. Pytanie C-3 to rozstrzyga; do tego
  czasu nie obiecywać KEN cotygodniowej coli.
- **Złe jednostki w snapshotach (A′)** to dziś większe ryzyko przezamówienia niż targety. Bez korekty wtorkowe
  zamówienie Intermlecz KEN może przynieść ~55 halloumi zamiast 0.
- **Retsina 12 / Corfu 12:** zamrożone ~300 zł na KEN. Akceptowalne, długi termin.
- **Ocet 0 na KEN:** jeśli jest w standardzie czyszczenia, wraca 0,5/1,5 — pytanie C-4. Rekord zostaje (nie DELETE),
  produkt nadal widoczny na ekranie z sugestią 0, tak jak na Brackiej.
- **Obejście bifteków (target 1 „karton”)** jest celowo tymczasowe i opisane w `notes`; ryzyko, że zostanie na
  stałe, jeśli C-1 nie wróci. Kontrola przy archiwizacji (pkt 7 w sekcji 6).
- **Nowy ReasonCode:** CHECK na prod jest faktem (sprawdzone), migracja 0016 obowiązkowa i przed kodem.
  Sheets nie waliduje wartości, enum w Pydantic wystarczy.
- **Komunikat D przed deployem B** = obietnica bez pokrycia. Kolejność w sekcji 6 jest twarda.

## 8. Hardening review (2026-09-06, rola: konstruktywny krytyk)

Co sprawdzono i co zmieniło plan:

| # | Założenie w planie v1 | Weryfikacja | Skutek |
|---|---|---|---|
| H1 | „migracja, jeśli kolumna ma CHECK” | `pg_constraint` na prod: CHECK z 7 kodami istnieje | migracja 0016 obowiązkowa, przed deployem (3.1, 3.7) |
| H2 | „min 0 = zamawiają po wyczerpaniu” | `suggestion.py`: silnik używa tylko `target − stan`; `min` nigdzie w logice | uzasadnienia poprawione, wartości zostają (2.1 ramka) |
| H3 | targety chronią przed przezamówieniem | snapshoty 6.09: halloumi KEN 5,5 (kartony), Browary 15,188, gyros Browary 7 (bloki); pre-fill FR-017 bierze te liczby | nowy tor A′ (2.5), prośba w D, kontrola wtorek rano |
| H4 | bifteki „blokują tylko jedną linię” | przy `upp=1` target 4 = 4 kartony, Uliana nie zamówi 1 bez powodu aż do odpowiedzi Pago | obejście target 1 w batchu A (2.1, SQL) |
| H5 | „zamawiajcie częściej” pasuje do wszystkich dostawców | Coca-Cola min 500 zł; KEN po obniżce ~250 zł/tydz.; zamówienie 2.09 za 465 zł poszło | pytanie C-3 rozszerzone, ryzyko w sekcji 7 |
| H6 | lista kodów tylko w i18n | `captain-mp/types.ts` → `REASON_CODES` karmi `ReasonPicker` i `OverruleAllControl` | 3.4 nazwane wprost |
| H7 | `max = target` bez skutków | `up_for_critical` na coli daje „exceeds max” w opisie, bez bramki przy policzonym stanie | zaakceptowane, opisane (2.1 ramka) |
| H8 | INSERT-y „wg wzorca ph3” | wzorzec sprawdzony: `supplier_products` bez `rounding_rule` (default `'full_only'`), `warehouse_pickup` NOT NULL DEFAULT false | SQL w 2.3 zgodny; `rounding_rule` jawnie = OK z CHECK |
| H9 | AFTER audit „22 rows” | doszedł BROWARY__P145 | 23 (2.3) |
| H10 | D „najpóźniej wtorek rano” | kapitani muszą poprawić remanent PRZED wtorkowym zamawianiem | D w poniedziałek (6.5) |

Czego NIE zmieniono mimo namysłu:
- Retsina 12 i Corfu 12 na KEN: krytyk pytał „czy nie za dużo kapitału”. ~300 zł, długi termin, i tak to trzymają. Zostaje.
- Ocet 0: alternatywa DELETE rekordu odrzucona (Bracka/Browary mają 0/0/0, spójność + historia linii).
- Powód „zapas do następnej dostawy” vs target liczony pod cykl dostaw: cykl wymaga `delivery_days` (dziś „TBD” u
  Coca-Cola, Blue Service, Intermlecz, Filber). Najpierw dane, potem logika. Zostaje powód.
