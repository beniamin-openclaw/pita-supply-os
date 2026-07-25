---
change_id: feedback-r7-tushar
status: implemented
created: 2026-07-25
updated: 2026-07-25
---

> **Stan: zaimplementowane 2026-07-25, niewdrożone.** Fazy A i B.1 zapisane w prod
> Supabase (działają od razu). Fazy B.2 i C leżą jako zmiana kodowa na gałęzi
> `claude/tushara-feedback-new-products-7623b8` — niezacommitowane i niewdrożone.
> Dziennik wykonania: §10.

# feedback-r7-tushar — plan ostateczny

Gałąź: `claude/tushara-feedback-new-products-7623b8`
Jeden plik = tożsamość zmiany + diagnoza + plan wykonawczy (świadomie bez osobnego
`change.md`).

**Źródło:** wiadomości Tushara (Messenger, 2026-07-24) + 3 nowe wiersze w arkuszu
„Wolska stock" (Google Sheets `1-PWvSF_CxKwPo7ofd9ClY3IA8bkHf9i4IxkulkeCci8`,
wiersze 60/61/62), doprecyzowane przez operatora 2026-07-25.

---

## 1. Zakres

Trzy niezależne kawałki, każdy da się wdrożyć osobno:

| # | Co | Rodzaj | Deploy? |
|---|---|---|---|
| A | 3 nowe produkty u Intermlecza, lokal WOLA | dane (prod Supabase) | nie |
| B | Adresaci maila: 2 adresy Intermlecza + stałe DW `biuro@pitabros.pl` | dane + kod | tak (część kodowa) |
| C | Linia „Proszę o dostawę w dniu:" w treści maila — **do ręcznego uzupełnienia** | kod | tak |

Poza zakresem świadomie: portal Intermlecza (kanał zostaje e-mail), diagnoza problemu
Tushara z wysyłką (decyzja operatora: odpuszczamy), rollout produktów na BRACKA/KEN.

---

## 2. Ustalenia i decyzje

| # | Temat | Rozstrzygnięcie |
|---|---|---|
| D1 | Nazwy i min/max produktów | Bierzemy z poprawionego arkusza **1:1**; wszystkie trzy: min 0,5 / max 1,5, `target = max` |
| D2 | Opakowania | Miód i herbata — **tylko całe opakowania**; kawa — całe sztuki (słoiki). Wszystkie trzy: `units_per_purchase_unit = 1`, `rounding_rule = full_only`, **`allow_over_max_due_to_packaging = TRUE`** (uzasadnienie w §3.2 — arytmetyka zaokrąglenia jest dla całej trójki identyczna) |
| D3 | Lokale | Tylko **WOLA** |
| D4 | Adresaci Intermlecza | `handel@intermlecz.pl` **oraz** `katarzyna.szymanska@intermlecz.pl` |
| D5 | DW (CC) | `biuro@pitabros.pl` standardowo na **wszystkich** mailach zamówieniowych; wartość z konfiguracji backendu, nie hardcode w dwóch miejscach |
| D6 | Data dostawy | **Nie wstawiamy wyliczonej daty.** Do treści maila wchodzi pusta linia `Proszę o dostawę w dniu:` — uzupełnia człowiek przed wysłaniem. Dotyczy wszystkich dostawców (Bukat, Intermlecz i reszta) |
| D7 | Portal Intermlecza | Odpada — kanał zostaje `email` |
| D8 | Problem Tushara z wysyłką | Odpuszczamy (decyzja operatora). Fakt techniczny zostaje w §7 jako ryzyko |
| D9 | Dni/godziny dostaw Intermlecza | Operator zmienia po swojej stronie; **plan już od tego nie zależy** (patrz D6) |

**Jedyny punkt otwarty (nieblokujący):** czy linia ma być gołym `Proszę o dostawę w dniu:`,
czy z widocznym miejscem do wpisania (np. `Proszę o dostawę w dniu: ..........`).
Rekomendacja: goła wersja z dwukropkiem — końcowe spacje bywają obcinane, a kropki
wyglądają jak formularz. Domyślnie implementuję gołą.

---

## 3. Faza A — 3 nowe produkty (dane, prod Supabase)

**Gdzie:** projekt `lpzhphufjwrndfogkfub`, tabele `products`, `supplier_products`,
`location_product_settings`. Bez migracji — sam INSERT danych.
Precedens: `context/archive/2026-07-15-feedback-r4-suppliers-master-data` (P135–P138
dodane dokładnie tą drogą).

**Seed CSV w repo NIE jest aktualizowany** — `docs/pita-supply-os-v1/seed/` stoi na P134
i nie był ruszany przy r4 ani r6. To fallback dla dev, nie źródło prawdy.

### 3.1 Wiersze do wstawienia

```sql
-- 1) products
INSERT INTO products (product_id, product_name_pl, product_category, inventory_unit,
                      is_critical, active, notes) VALUES
('P139','AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30','Spożywcze','opak',FALSE,TRUE,
 'dodane 2026-07-25 (feedback r7 Tushar)'),
('P140','KAWA JACOBS CRONAT GOLD ROZPUSZCZALNA 200g/6','Spożywcze','szt',FALSE,TRUE,
 'dodane 2026-07-25 (feedback r7 Tushar)'),
('P141','LIPTON HERBATA YELLOW LABEL 100szt./12 koperta','Spożywcze','opak',FALSE,TRUE,
 'dodane 2026-07-25 (feedback r7 Tushar)');

-- 2) supplier_products (Intermlecz)
INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id,
                               supplier_product_name, purchase_unit,
                               units_per_purchase_unit, rounding_rule,
                               price_estimate_pln, active, order_note) VALUES
('SP_INTERMLECZ_P139','SUP_INTERMLECZ','P139','AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30',
 'opak',1,'full_only',NULL,TRUE,'1 opak = 30 szt (25 g)'),
('SP_INTERMLECZ_P140','SUP_INTERMLECZ','P140','KAWA JACOBS CRONAT GOLD ROZPUSZCZALNA 200g/6',
 'szt',1,'full_only',NULL,TRUE,'1 karton = 6 szt'),
('SP_INTERMLECZ_P141','SUP_INTERMLECZ','P141','LIPTON HERBATA YELLOW LABEL 100szt./12 koperta',
 'opak',1,'full_only',NULL,TRUE,'1 karton = 12 opak');

-- 3) location_product_settings (tylko WOLA; target = max wg decyzji z r4)
INSERT INTO location_product_settings (setting_id, location_id, product_id,
                                       min_stock_qty_base, max_stock_qty_base,
                                       target_stock_qty_base, is_critical_for_location,
                                       allow_over_max_due_to_packaging, notes) VALUES
('WOLA__P139','WOLA','P139',0.5,1.5,1.5,FALSE,TRUE ,'AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30'),
('WOLA__P140','WOLA','P140',0.5,1.5,1.5,FALSE,TRUE ,'KAWA JACOBS CRONAT GOLD ROZPUSZCZALNA 200g/6'),
('WOLA__P141','WOLA','P141',0.5,1.5,1.5,FALSE,TRUE ,'LIPTON HERBATA YELLOW LABEL 100szt./12 koperta');
```

Uwagi wykonawcze:
- w arkuszu nazwa kawy ma **wiodącą spację** — przycinamy (`trim`), żeby nie zaśmiecać
  maila do dostawcy;
- `order_note` jest ograniczone do `varchar(60)` (migracja 0006) — wszystkie trzy mieszczą się;
- `price_estimate_pln = NULL`, bo cen nie znamy: te pozycje **nie doliczą się** do
  szacunkowej wartości zamówienia. Do uzupełnienia po pierwszej fakturze;
- `supplier_product_name` = ta sama nazwa co `product_name_pl` — Intermlecz zobaczy
  w mailu dokładnie to, co Tushar wpisał w arkuszu.

### 3.2 Dlaczego `allow_over_max_due_to_packaging = TRUE` dla całej trójki

Wszystkie trzy SKU mają identyczne ustawienia (min 0,5 / max 1,5, target 1,5,
`upp = 1`, `full_only`) i wszystkie trzy kupuje się w niepodzielnych jednostkach —
miód i herbatę w całych opakowaniach, kawę w całych słoikach. Przy pustym stanie
silnik policzy `1,5 − 0 = 1,5`, a `full_only` zaokrągli **w górę do 2**
([suggestion.py:62](supply-os-v1/app/suggestion.py:62)) — czyli powyżej MAX-a.
Bez tej flagi Captain, który **nie policzy stanu**, dostanie żądanie podania kodu przyczyny
(bramka over-MAX w `_evaluate_submit_line`, [main.py](supply-os-v1/app/main.py)) za coś,
co wynika wyłącznie z wielkości opakowania. Flaga istnieje dokładnie na ten przypadek.

**Poprawka po radzie modeli (F1):** pierwotnie kawa miała flagę `FALSE` z uzasadnieniem
„kawa idzie na sztuki". Arytmetyka zaokrąglenia jest jednak dla całej trójki taka sama,
więc kawa trafiałaby w tę samą bramkę bez powodu — flaga jest `TRUE` dla wszystkich trzech.

**Do wiadomości:** te same wartości (0,5 / 1,5 + `full_only`) mają dziś saszetki
cukru/soli/pieprzu (P056–P058) z flagą `FALSE` — ten sam zgrzyt już w systemie jest.
**Nie ruszam go** w tej zmianie.

### 3.3 Weryfikacja fazy A

1. SQL kontrolny: 3 nowe produkty + join do `WOLA` → 0 braków.
2. Prod, ekran Captaina (token WOLA) → dostawca Intermlecz → 3 nowe pozycje z poprawnymi
   jednostkami i `order_note` na karcie produktu.
3. Ekran inwentaryzacji lokalu → 3 nowe pozycje w kategorii „Spożywcze".
4. **Bez składania prawdziwego zamówienia** (twarda zasada repo).

**Rollback:** `DELETE` po `product_id IN ('P139','P140','P141')` z trzech tabel
(w kolejności: settings → supplier_products → products). Nic ich jeszcze nie referencuje.

---

## 4. Fundament dla faz B i C: gdzie powstaje mail

**Treść maila budują DWA bliźniacze moduły, które muszą zmieniać się razem:**

- [supply-os-v1/app/gmail_url.py](supply-os-v1/app/gmail_url.py) — buduje
  `ManagerDispatchResponse.gmail_compose_url`, używany **tylko** jako link „otwórz
  ponownie" w tej samej sesji;
- [frontend/src/pages/manager/lib/emailBody.ts](frontend/src/pages/manager/lib/emailBody.ts) —
  **autorytatywny**: Manager edytuje temat i treść w panelu, a URL Gmaila powstaje z tego,
  co edytował ([DispatchPanel.tsx:216](frontend/src/pages/manager/DispatchPanel.tsx:216)).

Oba pliki mają wzajemne komentarze „keep byte-identical". Każda zmiana treści maila =
zmiana w obu + aktualizacja
[emailBody.test.ts](frontend/src/pages/manager/lib/emailBody.test.ts). To główne ryzyko
regresji w tej zmianie.

---

## 5. Faza B — adresaci Intermlecza + stałe DW

### 5.1 Dwa adresy Intermlecza (dane, bez deployu)

```sql
UPDATE suppliers
   SET email = 'handel@intermlecz.pl,katarzyna.szymanska@intermlecz.pl'
 WHERE supplier_id = 'SUP_INTERMLECZ';
```

Format „adresy po przecinku" jest już w produkcji — `SUP_EUROFOOD` ma trzy adresy
i działa. Gmail przyjmuje przecinki w parametrze `to`; bramki „@" (backend i frontend)
sprawdzają tylko obecność `@`, więc łańcuch przechodzi.

### 5.2 DW `biuro@pitabros.pl` na wszystkich mailach (kod)

**Stan dziś:** URL Gmaila niesie wyłącznie `to`, `su`, `body` — parametru `cc` nie ma
([gmail_url.py:180](supply-os-v1/app/gmail_url.py:180),
[emailBody.ts:117](frontend/src/pages/manager/lib/emailBody.ts:117)).

| Plik | Zmiana |
|---|---|
| [supply-os-v1/app/config.py](supply-os-v1/app/config.py) | nowe ustawienie `order_cc_email` (env `SUPPLY_OS_ORDER_CC_EMAIL`, domyślnie `biuro@pitabros.pl`; puste ⇒ brak DW) |
| [supply-os-v1/app/gmail_url.py](supply-os-v1/app/gmail_url.py) | `build_draft_url` dokłada `("cc", cc_email)` do `urlencode`, gdy wartość niepusta i zawiera `@` |
| [supply-os-v1/app/models.py](supply-os-v1/app/models.py) | `ManagerOrderDetail.cc_email: Optional[str]` |
| [supply-os-v1/app/main.py](supply-os-v1/app/main.py) | `manager_order_detail` zwraca `cc_email` z ustawień |
| [frontend/src/types.ts](frontend/src/types.ts) | pole `cc_email` w `ManagerOrderDetail` |
| [frontend/src/pages/manager/lib/emailBody.ts](frontend/src/pages/manager/lib/emailBody.ts) | `buildGmailComposeUrl` przyjmuje opcjonalne `cc` → `&cc=` |
| [frontend/src/pages/manager/DispatchPanel.tsx](frontend/src/pages/manager/DispatchPanel.tsx) | przekazuje `detail.cc_email` + pokazuje wiersz „DW:" obok „Do:" |
| [frontend/src/i18n/strings.ts](frontend/src/i18n/strings.ts) | klucz `manager.dispatch.emailCc` (PL/EN) |
| [supply-os-v1/tests/](supply-os-v1/tests/) | URL zawiera `cc=` gdy skonfigurowane, nie zawiera gdy puste |
| [frontend/src/pages/manager/lib/emailBody.test.ts](frontend/src/pages/manager/lib/emailBody.test.ts) | bliźniaczy przypadek po stronie FE |

**Uwagi:**
- DW jest **jawne** dla dostawcy (prośba brzmiała „DW", nie „UDW") — zgodnie z intencją;
- nowy parametr wydłuża URL, ale limit 8000 znaków liczony jest po zbudowaniu całości,
  więc bramka `tooLong` obejmuje go automatycznie;
- wiersz „DW:" w panelu jest po to, by operator **widział**, że kopia idzie do biura —
  inaczej dowiedziałby się o tym dopiero w oknie Gmaila.

---

## 6. Faza C — linia „Proszę o dostawę w dniu:"

**Stan dziś:** treść maila ma stałą linię `Dostawa możliwa od godziny 11:00`, a **data
dostawy została świadomie usunięta** na wcześniejszą prośbę operatora — komentarze
w [gmail_url.py:120](supply-os-v1/app/gmail_url.py:120) i bliźniaczo
[emailBody.ts:86](frontend/src/pages/manager/lib/emailBody.ts:86)
(zmiana `context/archive/2026-06-26-email-delivery-time`).

**Co robimy:** wracamy z linią o dacie, ale **pustą** — dopisujemy do treści

```
Proszę o dostawę w dniu:
```

a wartość wpisuje człowiek: albo w edytowalnym polu treści w panelu wysyłki, albo już
w oknie Gmaila przed wysłaniem.

**Dlaczego tak, a nie automatem:** `orders.requested_delivery_date` jest wprawdzie
wypełniane (57/69 zamówień), ale liczy je frontend Captaina z `supplier.delivery_days`
([captain-mp/lib/dates.ts:17](frontend/src/pages/captain-mp/lib/dates.ts:17)) — a przy
dostawcach z `delivery_days = 'TBD'` (m.in. Intermlecz, Pago, Blue Service) wpada
fallback „jutro". Wysyłalibyśmy dostawcy **zgadywaną** datę. Pusta linia jest uczciwsza
i znosi zależność od porządkowania dni dostaw.

| Plik | Zmiana |
|---|---|
| [supply-os-v1/app/gmail_url.py](supply-os-v1/app/gmail_url.py) | w `_build_body`, bezpośrednio przed `Dostawa możliwa od godziny 11:00`, dopisać `Proszę o dostawę w dniu:` |
| [frontend/src/pages/manager/lib/emailBody.ts](frontend/src/pages/manager/lib/emailBody.ts) | to samo, bajt w bajt (bliźniak) |
| [frontend/src/pages/manager/lib/emailBody.test.ts](frontend/src/pages/manager/lib/emailBody.test.ts) | aktualizacja oczekiwanej treści |
| [supply-os-v1/tests/](supply-os-v1/tests/) | test treści po stronie backendu |

Linia jest **stała dla wszystkich dostawców** — bez rozgałęziania per dostawca.
`requested_delivery_date` zostaje bez zmian jako informacja wewnętrzna w panelu Managera
([OrderDetailPane.tsx:148](frontend/src/pages/manager/OrderDetailPane.tsx:148)).

---

## 7. Kolejność, weryfikacja, ryzyka

### Kolejność

1. **Faza A** (dane) — od razu; niezależna od kodu, daje Tusharowi 3 produkty natychmiast.
2. **§5.1 dwa adresy Intermlecza** (dane) — od razu, bez deployu.
3. **Fazy B + C** (kod) — jedna gałąź, jeden deploy.

### Weryfikacja

- `/verify` przed commitem: backend `python -m pytest` + `ruff check .`,
  frontend `npm run build` + `npm run lint` + `npm run test`.
- Merge do `main` → Railway deployuje backend, Vercel frontend.
- **Weryfikacja na prod, nie lokalnie**: najpierw potwierdzam nowy hash bundla,
  dopiero potem operator dostaje listę do sprawdzenia na żywo.
- Test maila: otworzyć szkic i sprawdzić **Do** (dwa adresy Intermlecza), **DW**
  (`biuro@pitabros.pl`) i obecność pustej linii o dacie — ale **nie klikać „Wyślij"**
  (twarda zasada repo: żadnych prawdziwych zamówień z testów).

### Ryzyka

| Ryzyko | Waga | Mitygacja |
|---|---|---|
| Rozjazd bliźniaków `gmail_url.py` ↔ `emailBody.ts` | wysoka | Zmiana treści zawsze w obu plikach + oba testy w tym samym commicie |
| Status „zamówione" zapisuje się **w chwili kliknięcia linku, przed faktyczną wysyłką** ([DispatchPanel.tsx:283](frontend/src/pages/manager/DispatchPanel.tsx:283)) — zamówienie może wyglądać na wysłane, choć nie dotarło (precedens Blue Service, r4) | wysoka | Poza zakresem tej zmiany (decyzja operatora). Kandydat na osobną zmianę: rozdzielić „otwórz szkic" od „oznacz jako wysłane" |
| Drugi adresat wpisany z błędem = cicha niedostarczalność | średnia | Weryfikacja w oknie Gmaila: **oba** adresy widoczne w „Do" |
| Pusta linia o dacie zostanie wysłana niewypełniona | średnia | Widoczna w edytowalnym polu treści w panelu, więc operator ma ją przed oczami przed kliknięciem |
| Seed CSV odstaje od prod (P134 vs P141) | niska | Świadomy dług; brak narzędzia backfillu prod→seed (`sync_master_data.py` idzie seed→Sheet, nie Supabase→seed) — osobny temat |
| Brak `price_estimate_pln` dla 3 nowych SKU | niska | Szacunkowa wartość zamówienia zaniżona; uzupełnić po pierwszej fakturze |

---

## 8. Czego ten plan świadomie NIE robi

- nie dodaje produktów do BRACKA i KEN (arkusz jest wolski; przy rolloutcie trzeba będzie
  dołożyć 3 wiersze — dziś pokrycie master-data przestaje być równe: 138 vs 141),
- nie aktualizuje seed CSV w repo,
- nie zmienia flagi `allow_over_max_due_to_packaging` dla istniejących saszetek (P056–P058),
- nie wstawia do maila wyliczonej daty dostawy ani nie porządkuje `delivery_days`
  u dostawców z `TBD`,
- nie dodaje Managerowi edycji daty jako osobnego pola (cała treść maila i tak jest edytowalna),
- nie przełącza Intermlecza na kanał `portal`,
- nie zajmuje się problemem Tushara z wysyłką (decyzja operatora),
- nie rusza dostawców z `email = 'TBD'` (Pago, Blue Service) — otwarty punkt z r4.

---

## 9. Załącznik: fakty z rozpoznania (2026-07-25)

Ustalone bezpośrednio w prod Supabase i w kodzie — kontekst dla recenzenta planu.

**Master data jest kompletna, nie ma luki w konfiguracji.** 138/138 produktów ma wiersz
`location_product_settings` dla WOLA, BRACKA i KEN; 0 braków u wszystkich 10 dostawców.
Intermlecz ma 28 produktów, wszystkie widoczne dla WOLA. Powód, dla którego Tushar nie
widział miodu/kawy/herbaty: **tych SKU po prostu nie ma w bazie** — nigdy nie zostały
dodane. Jedyny pokrewny to `P049 Miód 1 kg` (miód w wiadrze, nie saszetki).

**Wysyłka do Intermlecza działała technicznie.** Wszystkie 8 zamówień: status
`manager_sent | closed`, `sent_method = email`, wypełnione `manager_sent_at`. Treść maila
to 200–610 znaków przy limicie 8000, więc bramka `tooLong` nigdy nie ukryła przycisku
„Otwórz w Gmail"; adres `handel@intermlecz.pl` przechodzi bramkę „@". Ostatnie zamówienie:
`ORD-20260724-WOL-INTE-6320a7` (2026-07-24, `ordered_by: tushar limkar`).

**System nie wysyła maili** — otwiera szkic w Gmailu, wysyła człowiek. Stąd ryzyko
opisane w §7.

**Precedens dla fazy A:** produkty P135–P138 (Bombilla, Corfu Lager/Weiss/Free) dodano
w r4 dokładnie tą samą drogą — wpisem do prod Supabase, bez migracji i bez ruszania
seed CSV.

---

## 10. Dziennik wykonania (2026-07-25)

### Zrobione w prod Supabase (`lpzhphufjwrndfogkfub`) — działa od zaraz

- **P139 / P140 / P141** + `SP_INTERMLECZ_P139..141` + `WOLA__P139..141`.
  Zweryfikowane zapytaniem kontrolnym: wszystkie trzy mają komplet trzech wierszy,
  `allow_over_max_due_to_packaging = true`, `order_note` na miejscu.
- **`SUP_INTERMLECZ.email`** → `handel@intermlecz.pl,katarzyna.szymanska@intermlecz.pl`.

Rollback: `DELETE` po `product_id IN ('P139','P140','P141')` (settings → supplier_products
→ products) i przywrócenie `email = 'handel@intermlecz.pl'`.

### Zmiana kodowa (gałąź, NIEwdrożona)

| Plik | Co |
|---|---|
| `supply-os-v1/app/config.py` | `order_cc_email` (env `SUPPLY_OS_ORDER_CC_EMAIL`, domyślnie `biuro@pitabros.pl`) |
| `supply-os-v1/app/gmail_url.py` | parametr `cc` + linia `Proszę o dostawę w dniu:` |
| `supply-os-v1/app/models.py` | `ManagerOrderDetail.cc_email` |
| `supply-os-v1/app/main.py` | detal zwraca `cc_email`; dispatch przekazuje je do buildera |
| `supply-os-v1/.env.example` | dokumentacja nowej zmiennej |
| `frontend/src/types.ts` | `cc_email` |
| `frontend/src/pages/manager/lib/emailBody.ts` | `cc` w URL + bliźniacza linia daty |
| `frontend/src/pages/manager/DispatchPanel.tsx` | wiersz „DW:" + przekazanie `cc` |
| `frontend/src/i18n/strings.ts` | `manager.dispatch.emailCc` |
| `tests/test_gmail_url.py`, `tests/test_manager_dispatch.py`, `tests/test_manager_queue.py`, `emailBody.test.ts` | 11 nowych testów |

### Weryfikacja

`ruff` czysty · `pytest` 430 passed · `npm run build` OK · `npm run lint` czysty ·
`vitest` 89 passed (10 plików).

### Odstępstwa od planu

- Zmienna środowiskowa nazywa się `SUPPLY_OS_ORDER_CC_EMAIL` (nie `SUPPLY_OS_ORDER_CC`) —
  wynika z nazwy pola w `Settings` przy prefiksie `SUPPLY_OS_`.
- Doszedł wpis w `.env.example` (nie było go w planie, a bez niego nowa zmienna
  byłaby nieudokumentowana).
- Doszły 3 testy integracyjne przez endpointy (plan przewidywał tylko testy builderów).

### Otwarte

- [ ] Commit + merge do `main` (Railway/Vercel) — czeka na decyzję operatora
- [ ] Po wdrożeniu: sprawdzić na prod, że w oknie Gmaila są **oba** adresy Intermlecza
      w „Do" i `biuro@pitabros.pl` w „DW"
- [ ] Dni i godziny dostaw Intermlecza w `suppliers` — po stronie operatora
