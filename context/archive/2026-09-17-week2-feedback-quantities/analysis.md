# Tydzień 2 — feedback o ilościach: analiza, rekomendacje, plan (draft do decyzji)

Stan na 2026-09-17 wieczorem. Źródła: eksport czatu Connecteam (79 wierszy, do Sławka 15.09
20:20), prod Supabase (odczyty SELECT), repo (`main` + gałąź `feat/dynamic-target-wola`),
archiwa zmian od 1.09. Nic tu nie zostało jeszcze wdrożone ani zmienione na prodzie.

---

## 0. Gdzie skończyliśmy (stan przed tym feedbackiem)

| Data | Co poszło | Gdzie |
|---|---|---|
| 1–4.09 | Szkolenie 4 lokali; „overrule all”, kategorie PL na remanencie, edycja remanentu z audytem, produkt ad-hoc, **minimum dostawcy jako informacja (nigdy bramka)**; Pago 24→6 SKU, powstał `SUP_MORY` | `context/archive/2026-09-01-training-feedback-0901/` |
| 5.09 | Rolki per lokal, 5 minimów dostawców (Intermlecz 650, Bukat/CC/Blue 500, Kuchnie 600) | `…/2026-09-05-rolki-minima-master-data/` |
| 6.09 | Karta „Remanent zapisany” + Historia; split gyrosu; Corfu Pilsner; „N szt = M zgrzewek” na ekranach zamówień i **na remanencie tylko toggle** (patrz §3.B) | `…/2026-09-06-inventory-confirm-and-history/`, `…/2026-09-06-pack-units-display-mobile-wrap/` |
| 6.09 | Feedback tygodnia 1: 22 progi KEN/WOLA/BROWARY, kod powodu `STOCK_UNTIL_NEXT_DELIVERY`, draft pytań do managera | `…/2026-09-06-week1-feedback-targets/` (deploy `637270f`) |
| 7.09 | Dynamiczny target Wola (usage × dni do dostawy) — **PR #30 otwarty, niezmergowany, SQL na prod nieodpalony** | `feat/dynamic-target-wola` |
| 13.09 | Sprzątanie: 9 lane’ów zarchiwizowanych, otwarte pozycje operatora → `master-data-followups` | `context/changes/master-data-followups/change.md` |
| 14.09 | Certyfikacja (PR #31) — bez zmian produktowych | — |

**Wniosek:** cały feedback z czatu po 6.09 19:50 (Tushar, Juliana, Sławek, Khushi, Mirsini, Ela) nie ma
żadnego śladu w repo — to jest nieprzerobiona runda. Otwarte z poprzednich rund i istotne tutaj:
C-1 bifteki (upp kartonu), C-3 Coca-Cola KEN, R3 „stan > 3×max → ostrzeżenie o jednostce” (kandydat na
osobną zmianę, nie zbudowany), B16 jogurt/gouda ukryte na KEN.

---

## 1. Triage czatu (nowe wiadomości po 6.09 + obrazki bez treści)

Legenda typu: **K** = kod, **MD** = master data (SQL na prod, diff-before/audit-after), **P** = proces/komunikat, **D** = decyzja operatora.

| # | Kto / kiedy | Zgłoszenie (skrót) | Co widać na prodzie / w kodzie | Typ | Rekomendacja |
|---|---|---|---|---|---|
| 1 | Tushar 7.09 11:58 | dodać „bombila 330 ml” do warzyw (Bukat) i do remanentu | `P135 Bombilla` istnieje, `active=false`, ma aktywny `SUP_BUKAT` sp. Sprzeczność: 1.09 zdecydowano **usunąć** „bąbila” | D + MD | Decyzja: WOLA chce, inne nie? Jeśli tak — `products.active=true` + setting tylko WOLA (inne lokale bez wiersza = nie widzą) |
| 2 | Tushar 7.09 12:13 | Kamino: 11 butli łącznie, max do zamówienia 9 | WOLA `P181 Butla zamknięta` target=max=8 (kopia); `P134` nieaktywny, więc bez duplikatu | MD | WOLA: target=max=9 (Tushar); patrz #11 dla reguły butli |
| 3 | Tushar/Marek 7.09 12:17–12:34 | zamówił „Magazyn własny Mory” z apki; Marek: „we don’t order this one anymore” | `SUP_MORY` aktywny, 15 wierszy; od 7.09 **4 zamówienia** do Mory (WOLA ×2, BRACKA, KEN), 2 z nich `closed` (odebrane!) | D | Wyjaśnić z Markiem, co znaczy „nie zamawiamy”: (a) Mory nie jest dostawcą → dezaktywować + przenieść opakowania PB pod Pago/transport; (b) zamawia się inaczej (telefon do Marka) → zostawić `manual`, dopisać w `notes`/`order_note` „odbiór własny, informujemy Marka”. Nie ruszać przed odpowiedzią |
| 4 | Juliana 7.09 15:28 (obraz) | bifteki: „podane w sztukach, max 2 sztuki = 6–8 kg” | BROWARY bifteki: `inventory_unit=kg`, `purchase_unit=karton`, **upp=1.0** (PZ: 4,2 kg), target=max=1 (obejście z 6.09). BRACKA target 1,5 kg vs karton. WOLA **brak wiersza** (nie da się zamówić) | MD (C-1) | Zamknąć C-1 raz: `upp=4.2` (potwierdzić kg/karton z Markiem), targety z powrotem w kg (Browary 8 kg = 2 kartony), dodać wiersz WOLA. Wtedy stan w kg i zamówienie w kartonach zgadza się z hintem „1 karton = 4,2 kg” |
| 5 | Juliana 8.09 + Sławek 8.09 | zamówione 2 Coca-Cole w puszkach, przyjechała butelka; „w nazwie pojemność + puszka/butelka” | `P068 Coca Cola` / `P069 Zero`: zgrzewka×24, nazwa bez pojemności/opakowania. Brak osobnych SKU puszka/butelka | D + MD | Ustalić z Markiem/Sławkiem, co lokale realnie kupują (puszka 0,33? butelka 0,5?). Rename `product_name_pl` + `supplier_product_name` (np. „Coca Cola 0,33 l puszka”); jeśli oba formaty są w użyciu — drugi SKU. Zero kodu |
| 6 | Khushi 9.09 (obraz) | odbiór: jogurt i ser przyjechały, „nie ma gdzie tego wpisać” | Ekran odbioru **nie ma pola uwag ani komentarza do linii** — backend je ma (`ReceiptSubmitRequest.notes`, `receipt_comment`), FE nie wysyła (`ReceiveDeliveryPage.tsx:127-131`). Do tego B16: jogurt/gouda ukryte na KEN | K (S) + D | Dodać pole „Uwagi do dostawy” (→ `notes`) na ekranie odbioru + pokazać je managerowi w sekcji dostawy. Osobno: decyzja o P162/P172 na KEN |
| 7 | Mirsini 9.09 17:32 | butle gazowe: „nie trzeba podpowiedzi, zamawiamy tyle, ile pustych (4 z 5)” | Model już to robi, jeśli **target = liczba butli w obiegu**, a stan = pełne: sugestia = target − pełne = puste. Bracka ma target 8 (kopia z Woli) | MD + P | Per lokal: target=max = liczba butli w obiegu (Bracka 5?, Wola 9); `order_note` „cel = butle w obiegu, sugestia = puste do wymiany”. Bez nowej reguły |
| 8 | Mirsini/Ela 9.09 18:54–19:14 | Bracka: zamówienie Coca-Cola z 2.09 „in progress”; Ela: zrealizowane, „możliwe, że nie potwierdziłam” | `ORD-20260902-BRA-COCA-c673c7` status **`manager_claimed`** od 2.09 — manager zamówił w portalu, nie kliknął „Zamów” w apce. Plus 6 zamówień Pago w `manager_claimed` (drafty transportu / nie sfinalizowane) | P + K (S) | Dziś: manager domyka ręcznie (Zamów/Anuluj). Kod: w kolejce managera chip „przejęte > 3 dni” (informacyjny) — patrz P3 |
| 9 | Tushar 14.09 12:44 (obraz) | Pago: „w sugestii nie widać liczby, nie podpowiada” | WOLA×Pago 14.09: stan 30 kg gyros vs target 10; souvlaki 40 vs 12; pita 17 vs 5 → **sugestia = 0** na każdej linii → „brak bazy — wymagany powód” → kapitan wybiera `SYSTEM_SUGGESTION_WRONG`. To samo 7.09 (gyros 90 kg / target 10). Targety Pago na Woli to pokrycie ~1 dnia (analiza GoStock) przy dostawie raz w tygodniu | MD + K (M) | Dwie rzeczy naraz: (a) targety Pago = pokrycie tygodnia (jest gotowe `target_seed.csv` z GoStock, sekcja D w `prod-sql.sql` z #30); (b) **przy policzonym stanie i sugestii 0 nie wymuszać powodu** — tylko informacja (§4). Docelowo #30 (dynamiczny target) |
| 10 | Sławek 14.09 12:46 | filtrowanie, sortowanie, wyszukiwanie produktów na stanach po remanencie (perspektywa managera) | Manager: `ManagerInventoryPage` = płaska tabela Produkt/Stan, tylko select lokalu; 146–153 produktów / 10 kategorii na lokal. Kapitan: grid z kategoriami (zwinięte), bez szukania/filtrów. Reużywalne: `AddProductPicker` (search), `ManagerFilterBar` (chipy) | K (M) | P3: wyszukiwarka + chipy kategorii + sort (nazwa / stan / „uwaga”) + przełączniki „tylko krytyczne / tylko nieliczone / poniżej min”. Żeby „wymaga uwagi” miało sens, detal managera musi dostać Cel/Min/Max (dziś ich nie ma w `InventoryCountDetailLine`) |
| 11 | Tushar 14.09 12:47–12:48 (3 obrazy) | „zamówiliśmy w zeszłym tygodniu, nie dostaliśmy”; „w tym tygodniu zamówiliśmy to i Pago” | Obrazy niewidoczne; najpewniej Mory 7.09 (`manager_sent`, 0 odbiorów) + Pago 14.09 (`manager_claimed`, manager wpisał 0 we wszystkich liniach — patrz #9) | P | Do wyjaśnienia z Markiem: czy Mory 7.09 pojechało; Pago 14.09 wyzerowane przez managera — kapitan powinien dostać info (dziś widzi tylko „Zablokowane”) |
| 12 | Sławek 15.09 20:20 | Coca-Cola: przy zamówieniu trzeba podać liczbę plastikowych skrzynek do odbioru, inaczej nie zabiorą | Brak takiego pola. Coca-Cola = `portal` (manager przepisuje do portalu). Jest `captain_note` (widzi manager) i `extra_items` (idzie do dostawcy) | K (S) + D | Najprościej: przy dostawcy z „zwrotami” pokazać nad `captain_note` podpowiedź/pole „Skrzynki do odbioru: __” zapisane do `captain_note`; manager widzi w panelu dispatch. Wariant strukturalny w §5 P4 |
| 13 | Ajith 6.09 / Ela 6.09 (obrazy 28, 35, 37) | zamknięte w week1 | — | — | nic |

Wiadomości Khushi 6.09 (pkt 3–9) i Tushara 6.09 (opakowania: gąbki 5/10 w paczce, cola) były przerobione w
week1 — ale **wzorzec wraca w danych** (§2): kapitani nadal zamawiają „w paczkach” tam, gdzie `purchase_unit` to
sztuka (halloumi 12/box, frytki 4/box, cebula worek 5 kg, gąbki).

---

## 2. Co mówią dane z produ (7–17.09)

- **Linie zamówień: 311.** Z powodem: 59. `SYSTEM_SUGGESTION_WRONG` = **28** (największy), z czego **11 przy sugestii 0**;
  `STOCK_UNTIL_NEXT_DELIVERY` = 17 (nowy kod działa — 13× „mniej niż sugestia”), `OTHER` 6, `LOW_STORAGE` 4,
  `PACKAGING_LIMITATION` 2, `WEEKEND` 2.
- **„System wrong” to w 80 % Pago** (WOLA + BRACKA): stan wielokrotnie powyżej targetu, sugestia 0, kapitan zamawia
  zapas tygodniowy. To nie jest błąd silnika — to targety Pago w złej skali + bramka „brak bazy”.
- **Jednostki (potwierdzone w komentarzach kapitanów):** Browary majonez „8 szt zamiast 8 kg = 2 wiadra”; KEN frytki
  „1 box = 4 paczki”; KEN halloumi „1 box = 12”; Wola cebula „przychodzi w 5 kg”; Bracka koperty target **100 box**;
  tzatzyki target 36 kg (=12 wiader) na WOLA/BRACKA/BROWARY, KEN poprawione na 18.
- **Remanenty są robione:** 4 lokale × 2 tygodnie (6.09 i 13.09), 115–153 linii, Tushar poprawiał 13.09 (edycja działa).
- **Progi target=0 (produkt widoczny, sugestia zawsze 0, każde zamówienie = powód):** Blue Service 6–10 wierszy na
  lokal, Coca-Cola Norblin 6, Eurofood Norblin 6, Mory WOLA 3. To „biurowe/pakowe” — to samo zjawisko co Pago.
- **Zawieszone statusy:** Bracka Coca-Cola 2.09 `manager_claimed`; 6× Pago `manager_claimed` (2–14.09); stare
  `manager_sent` z czerwca–sierpnia na Woli bez odbioru (historyczne, nie z tej rundy).

---

## 3. Analiza: inwentaryzacja ↔ zamówienie — gdzie się rozjeżdża

### A. Sugestia 0 = przymus powodu (największy generator szumu)
Dziś: `computeRowState` przy `suggested === 0` → „Brak bazy sugestii — **wymagany powód**” (czerwona karta, blokuje
submit po stronie UI); backend: `delta_pct = |final − 0| / max(0, step)` → zawsze > 25 % → 400 bez powodu
(`main.py:511-535`). Efekt: gdy stan ≥ cel, każde zamówienie choćby 1 sztuki wymaga powodu, więc kapitan klika
„system się myli” — i ta etykieta ląduje w statystykach FR‑012 jako sygnał do poprawy master data, choć nic nie mówi.

Rekomendacja (rozluźnienie jednej reguły, reszta bez zmian): **przy policzonym stanie i sugestii 0 nie wymagać
powodu**; karta żółta, tekst informacyjny „Stan ≥ cel ({stan} / cel {cel}) — zamawiasz ponad cel”; `delta_vs_suggestion_pct`
zapisywać jako `None` (jak w gałęzi „niepoliczone”), żeby nie zawyżać średnich odchyleń. Bramka > 25 % i „krytyczny
poniżej sugestii” zostają dla sugestii > 0. To jest zgodne z Twoim „nie zaszywać za dużo zasad”: reguła zostaje tam,
gdzie jest baza do porównania.

Alternatywa (jeśli chcesz zachować ślad): zamiast powodu zapisywać automatycznie `reason_code=NULL`, a w roll‑upie
FR‑012 liczyć osobno „zamówienia ponad cel”. Tańsze i czystsze niż wymuszony kod.

### B. Jednostki: remanent liczy w `inventory_unit`, zamówienie w `purchase_unit` — ekran remanentu nic o tym nie mówi
Fakty z kodu: grid remanentu pokazuje **tylko** nazwę, badge KRYTYCZNY, jednostkę i input (`InventoryCountGrid.tsx:82-119`);
`InventoryProduct` nie niesie `purchase_unit` / `units_per_purchase_unit` / target / max, więc nie da się tam pokazać
„1 karton = 4,2 kg” ani „ostatnio: 36 opak”. Pomocnik `packHint()` istnieje i ma testy, ale **nie ma ani jednego
użycia w produkcji**. Ekran zamówienia ma pełną informację (target · max · 1 karton = N).

Rekomendacja — **warstwa informacyjna na remanencie** (zero reguł):
1. hint jednostki: „1 {purchase_unit} = {upp} {inventory_unit}” + `order_note` (np. „1 karton = 6 szt (18 kg)”),
2. „ostatnio: {stan} · {data}” z poprzedniego snapshotu tego lokalu (to jest odpowiedź na „weryfikację po inwentaryzacji”),
3. sygnał wiarygodności (R3): jeśli wpisany stan > 3 × max (i max > 0) → żółty dopisek „sprawdź jednostkę — max to {max} {unit}”.
   Nigdy nie blokuje zapisu (spójne z „prefill must never block ordering”).

Drugi tor to master data: tam, gdzie kapitan mówi „przychodzi w paczkach po N”, poprawna odpowiedź to
`purchase_unit`=paczka i `upp`=N (nie kod powodu „packaging”). Lista w §5 P0.

### C. Targety w skali dnia przy dostawie tygodniowej (Pago, Coca‑Cola)
Statyczny target Wola/Pago pokrywa 0,5–1 dnia (GoStock), dostawa we wtorek. Kapitan zamawia zapas tygodnia, silnik mówi 0.
Dwie ścieżki: (1) **teraz** przepisać targety Pago (i Coca‑Cola tam, gdzie week1 nie dotknął) na pokrycie tygodnia
— dane są w `target_seed.csv` i sekcji D `prod-sql.sql` w PR #30; (2) **potem** zmergować #30 (dynamiczny target),
który liczy to sam z kalendarza dostaw. Rekomenduję (1) od razu (SQL, godzina) i (2) jako osobną decyzję po
stabilizacji — nie łączyć z tą rundą (lesson: nie stackować dwóch dużych zmian).

### D. Listy produktów (Sławek)
Manager ogląda snapshot jako płaską tabelę Produkt/Stan bez celu — nie ma jak „zobaczyć, co wymaga uwagi”.
Rekomendacja: (1) `InventoryCountDetailLine` += `min/target/max` (join z `location_product_settings` po stronie
serwera, jak `manager_order_detail`), (2) w tabeli kolumny Stan · Cel · Δ i flaga „poniżej min / powyżej 3×max / 0”,
(3) pasek: wyszukiwarka (substring po nazwie, jak `AddProductPicker`), chipy kategorii (`ManagerFilterBar` idiom),
sort (nazwa PL / stan / Δ vs cel / kategoria), przełączniki „tylko z uwagą / tylko krytyczne”. Klient‑side, ulotne
(bez localStorage — precedens S‑05). Ten sam pasek (bez kolumn celu) na gridzie kapitana: szukaj + „tylko nieliczone”.

### E. Gdzie „informacja”, gdzie „reguła” — proponowany podział

| Sygnał | Dziś | Propozycja |
|---|---|---|
| krytyczny poniżej sugestii (sug > 0) | bramka (400 / czerwona) | **zostaje** |
| odchylenie > 25 % (sug > 0) | bramka | **zostaje** |
| sugestia 0 przy policzonym stanie | bramka („brak bazy”) | **informacja** (§3.A) |
| niepoliczony stan + ponad MAX | bramka | zostaje (jedyna bramka bez bazy — chroni przed „0 kg + 1 karton” nieświadomie) |
| minimum dostawcy (PLN) | informacja | zostaje |
| `min` produktu | informacja (czerwony dopisek) | zostaje |
| `over_max` przy policzonym stanie | opis „(exceeds max by N)” | zostaje |
| stan > 3×max na remanencie | brak | **informacja** (nowe) |
| jednostka opakowania na remanencie | brak | **informacja** (nowe) |
| poprzedni stan na remanencie | brak | **informacja** (nowe) |
| „przejęte > 3 dni” w kolejce managera | brak | **informacja** (nowe, mały chip) |
| skrzynki do odbioru (Coca‑Cola) | brak | pole informacyjne w `captain_note` (§5 P4) |

---

## 4. Rekomendacje w skrócie (co i jak)

1. **Master data batch „week2” na prod** (SQL, diff‑before/audit‑after): bifteki upp 4,2 + targety w kg + wiersz WOLA;
   tzatzyki 36→18 kg (WOLA/BRACKA/BROWARY — potwierdzić); koperty Bracka 100→? (jednostka box vs szt); Browary majonez
   8→2, musztarda 6→2; KEN halloumi/frytki jako opakowania (upp 12 / 4) **albo** zostawić sztuki i dopisać `order_note`
   „1 box = 12 szt” (decyzja: czy Intermlecz sprzedaje w boxach); cebula Bukat `order_note` „worek 5 kg”; butle:
   target = butle w obiegu per lokal (Wola 9, Bracka wg Mirsini); Pago targety = tydzień (sekcja D z #30);
   Coca‑Cola nazwy z pojemnością/puszka; Bombilla WOLA; Mory — po odpowiedzi Marka. Blue Service target=0 wiersze:
   przejrzeć (biurowe = zamawiane „na oko” → po 3.A przestaną wymuszać powód).
2. **Kod, faza 1 (mała, największy efekt):** sugestia 0 → informacja zamiast powodu (backend + `compute.ts` + testy).
3. **Kod, faza 2:** warstwa informacyjna remanentu (jednostka, ostatnio, sygnał 3×max) — rozszerzenie `InventoryProduct`.
4. **Kod, faza 3:** listy: szukaj/filtruj/sortuj na remanencie kapitana i w podglądzie managera + Cel/Min/Max w detalu.
5. **Kod, faza 4 (drobiazgi):** pole „Uwagi do dostawy” w odbiorze; „skrzynki do odbioru” dla Coca‑Coli; chip
   „przejęte > 3 dni”.
6. **Proces:** manager domyka Bracka Coca‑Cola 2.09 i drafty Pago; komunikat do kapitanów po deployu (PL/EN): co
   zmieniło się w powodach, jak liczyć butle, że stan ≥ cel nie blokuje.
7. **#30 dynamiczny target:** osobna decyzja po tej rundzie.

---

## 5. Plan wdrożenia (draft — do wyboru zakresu)

Konwencja jak w poprzednich rundach: jedna zmiana `week2-feedback-quantities`, fazy P0–P4, każda osobno weryfikowalna
(`/verify`), deploy `main` → Vercel/Railway, migracje **przed** kodem (tu: brak migracji poza opcją P4‑b).

### P0 — Prod hygiene (bez kodu; operator + SQL package)
- Plik `prod-sql.sql` w tym folderze: sekcje A (bifteki C‑1), B (jednostki/targety z §4.1), C (butle), D (Pago tydzień —
  przeniesione 1:1 z sekcji D PR #30), E (Coca‑Cola nazwy), F (Bombilla), G (Mory — warunkowo). Każda sekcja: BEFORE
  SELECT → UPDATE → AFTER assert (min ≤ target ≤ max, brak `target=0` tam, gdzie produkt ma być sugerowany).
- Ręcznie w apce: Bracka CC 2.09 → Zamów/Anuluj; 6× Pago `manager_claimed` → finalize/cancel.
- Wymaga: odpowiedzi Marka (Mory, bifteki kg/karton, puszka/butelka, box halloumi/frytki), Sławka (butle per lokal).
- Rozmiar: ~2 h + czas na odpowiedzi.

### P1 — „Brak bazy” jako informacja (K, S–M)
- Backend `_evaluate_submit_line` (`main.py:438-563`): nowa gałąź `stock is not None and suggested_qty_purchase == 0`:
  brak bramki odchylenia, `delta_pct=None`, `warning` „Line X: stock ≥ target, ordered N (info)”. Krytyczny‑poniżej
  nie dotyczy (final < 0 niemożliwe).
- Frontend `compute.ts:125-138`: `noBaseline*` → stan `yellow`, `requiresReason=false`, nowa kopia
  `state.aboveTargetInfo` („Stan ≥ cel · zamawiasz ponad cel”); `overruleAll.ts` bez zmian (używa `requiresReason`).
- Manager `OrderLineTable.tsx:182-205`: „brak bazy” zostaje, plus dopisek „ponad cel”.
- Roll‑up FR‑012 (`_aggregate_suggestion_review`): linie z `delta=None` już nie wchodzą do średniej — dodać licznik
  `above_target_count` (opcjonalnie).
- Testy: backend `test_captain_submit.py` (+3: sug 0 bez powodu OK, delta None, z powodem → warning),
  `test_captain_orders.py` (+1 edit), FE `compute.test.ts` (+2), `overruleAll.test.ts` (+1: nie dobiera powodu).
- Ryzyko: statystyki FR‑012 tracą część „SYSTEM_SUGGESTION_WRONG” — to celowe.

### P2 — Warstwa informacyjna remanentu (K, M)
- Backend `InventoryProduct` += `purchase_unit`, `units_per_purchase_unit`, `order_note` (z **aktywnego** sp; przy
  kilku — pierwszy wg `supplier_id` aktywnego dostawcy), `min/target/max_stock_qty_base`, `last_count_qty_base`,
  `last_count_date` (z najnowszego snapshotu lokalu — jeden `get_inventory_count` już jest w `captain_inventory_latest`).
  Route `captain_inventory_products` (`main.py:2252-2284`). Lesson L7: pola opcjonalne → `?` w `types.ts`.
- FE `InventoryCountGrid.tsx`: pod inputem „1 {pu} = {upp} {iu}” (reużyć `packHint()`), „ostatnio {qty} · {data}”,
  żółty dopisek 3×max. Edycja remanentu (`InventoryCountEditPage`) dostaje to samo za darmo (ten sam grid).
- Testy: backend `test_inventory_submit.py` (+3: pola, brak sp → null, last_count), FE nowy `InventoryCountGrid.test.tsx`
  (dziś brak testów UI remanentu — okazja: hint, ostatnio, 3×max, brak hintu przy upp=1).
- Rozmiar: 0,5–1 dnia.

### P3 — Listy: szukaj / filtruj / sortuj (K, M)
- Backend: `InventoryCountDetailLine` += `min/target/max` (`_enrich_inventory_count_detail`, `main.py:2726-2766`).
- FE wspólny komponent `ProductListToolbar` (`components/ui/`): search (debounce 150 ms), chipy kategorii
  (`categoryLabel`), sort select, toggles. Użycie: `ManagerInventoryPage` detal (kolumny Stan · Cel · Δ · flaga),
  `InventoryCountGrid` (szukaj + „tylko nieliczone” + „tylko krytyczne”; szukanie rozwija kategorie z trafieniami),
  opcjonalnie `InventoryHistoryPage` detal.
- Stan filtrów ulotny (precedens S‑05). Sort PL: `localeCompare(…, "pl")`.
- Testy: pure helper `lib/productListFilter.ts` + `.test.ts` (filtr/sort/flagi), backend `test_inventory_manager.py` (+1).
- Rozmiar: 1 dzień.

### P4 — Drobiazgi z czatu (K, S każdy)
- a) Odbiór: textarea „Uwagi do dostawy (np. pozycje spoza zamówienia)” → `notes`; manager widzi w `DeliverySection`
  (`ManagerOrderReceipt` += `notes`). Testy: `test_receipt_submit.py` (+1), `test_manager_receiving.py` (+1).
- b) Skrzynki Coca‑Cola — wariant minimalny: mapa w FE `SUPPLIER_NOTE_PROMPTS` (`SUP_COCACOLA` → „Skrzynki plastikowe do
  odbioru: __”), tekst dokleja się do `captain_note`; `DispatchPanel` (portal) wyświetla `captain_note` wyżej.
  Wariant strukturalny (jeśli chcesz danych): kolumna `orders.pickup_note` + migracja 0019 — odradzam na teraz.
- c) Kolejka managera: chip „przejęte {n} dni” gdy `manager_claimed` i `captain_submitted_at` starsze niż 3 dni
  (client‑side, `ManagerQueue.tsx`).
- d) Kapitan: gdy manager wyzerował wszystkie linie (Pago 14.09), detal pokazuje „menedżer zmienił ilości” — dziś
  `OrderDetailPage` pokazuje `manager_final` tylko w tabeli; dodać jednozdaniowy banner (info).

### Kolejność i zależności
P0 (SQL) → P1 (deploy) → komunikat do zespołu → P2 → P3 → P4. P2 i P3 niezależne od siebie; P4 równolegle.
P1 bez P0 nadal pomaga (znika przymus powodu), P0 bez P1 nadal zostawia „brak bazy” na wszystkich target=0.

### Weryfikacja (mapa na `test-plan.md`)
Risk #2 (jednostki) — P0/P2; Risk #4 — bez zmian w auth, ale nowe pola w `InventoryProduct` tylko pod tokenem kapitana
(test istnieje). Każda faza: `/verify` + smoke na prodzie z auth ON (lesson „auth-off preview”), zamówienia testowe
wycofywane przed dispatch.

---

## 6. Decyzje, których potrzebuję od Ciebie

1. **3.A** — czy zdejmujemy przymus powodu przy sugestii 0 (rekomendacja: tak)? Czy zostaje ślad w postaci licznika „ponad cel”?
2. **Mory** — co znaczy „we don’t order this one anymore” (dezaktywacja vs inny kanał)?
3. **Bifteki** — kg czy karton jako jednostka zamówienia; 4,2 kg/karton potwierdzone?
4. **Coca‑Cola** — puszka/butelka: jeden SKU z nazwą czy dwa? Skrzynki: wariant minimalny (nota) czy pole strukturalne?
5. **Halloumi / frytki / gąbki / cebula** — zmieniamy `purchase_unit` na opakowanie (upp N), czy tylko dopisujemy `order_note`?
6. **Bombilla** — tylko WOLA?
7. **Butle** — liczba butli w obiegu per lokal (Wola 9, Bracka ?, KEN ?, Browary ?).
8. **Tzatzyki 36 kg** na WOLA/BRACKA/BROWARY — zejść do 18 jak KEN?
9. **Blue Service target=0** (6–10 wierszy na lokal) — zostawić jako „zamawiane na oko” (po 3.A bez powodu) czy nadać progi?
10. **PR #30** — mergujemy w tej rundzie czy po?

## 7. Czego nie widziałem
Obrazy z czatu (wiersze 57, 58, 60, 63, 71, 73–75): Connecteam nie wyrenderował się w karcie sterowanej automatycznie
(spinner; w tle debugger „ChatGPT”). Jeśli któryś obrazek mówi coś innego niż moja diagnoza w §1 (#4, #5, #6, #9, #11),
wklej go tutaj.
