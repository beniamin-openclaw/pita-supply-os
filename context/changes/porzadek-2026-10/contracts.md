# Kontrakty pracy — fala A (po decyzjach z 17.10)

Każdy lane to jedna sesja w osobnym worktree, w pełnym cyklu 10x:
`/10x-new` → research → plan → plan-review → implement → impl-review → `/verify` → PR.
Źródła punktów (W/M/B/N/D) są w `plan.md` oraz w `inputs/crosscheck.md` i `inputs/connecteam-chat.md`.

Zasady wspólne:
- Żadnych prawdziwych zamówień w testach. Prod SQL tylko jako diff + guard + audyt, uruchamia operator (`plan.md`, „Zasada pracy”).
- Copy wyłącznie przez `src/i18n/`, API wyłącznie przez `src/apiClient.ts`, persystencja wyłącznie przez `_choose_backend()`.
- Jedna zmiana = jeden PR. Kolejność w lane jest ważna, bo pierwsze punkty są najpilniejsze.
- Ben testuje dopiero po deployu na prod. Lista kontrolna do sprawdzenia na żywo powstaje po potwierdzeniu nowego bundla.
- Lane'y C i M dotykają obu stron `supply-os-v1/app/main.py` (kapitan i manager). Przed PR rebase na `main`.

---

## Lane C — ekrany kapitana

Pliki: `frontend/src/pages/captain-mp/**`, `frontend/src/lib/orderQty.ts`, `supply-os-v1/app/order_qty.py`,
endpointy kapitana w `main.py`, `InventoryCountPage.tsx`.

1. **N1 (pilne). Podwojenie ilości przy „kartony + luzem”.** Marek 02.10 na czacie Connecteam:
   „Dubluje zamówienie, daje X2” (Browary, Intermlecz). Kolejność: test, który to odtwarza (front + backend parity),
   potem poprawka. Jeśli błędu nie da się odtworzyć, opisać, co sprawdzono, i znaleźć zamówienie z 02.10
   na prodzie (odczyt), żeby porównać linie.
2. **N4.** Przy przyjęciu dostawy jasny komunikat „wpisz, kto odebrał” przy polu zamiast martwego przycisku (Ela, 03.10).
3. **N19.** Klucz szkicu spisu `__inventory__` ma zawierać lokal (`InventoryCountPage.tsx:32`).
4. **N13.** Prośba o liczbę skrzynek do oddania także dla `SUP_COCACOLA_KAT` (`supplierPrompts.ts`).
5. **WP6 + D10 (A).** Stan „wysłane dziś” liczony z bazy, nie z pamięci karty (`CaptainMP.tsx:110,749`, `SupplierPicker.tsx`).
   Do tego ostrzeżenie (bez blokady) przed drugim zamówieniem u tego samego dostawcy tego samego dnia.
   Do tego „masz już otwarte zamówienie u tego dostawcy” (`main.py:398-470`).
6. **D10 (A). Karta zapasowa.**
   - Własny wygląd: przerywana ramka, w kaflu sugestii „u <główny dostawca>” zamiast „—”.
   - Poprawny opis dla czytnika ekranu.
   - Jedna zbiorcza linijka „Zapasowy · główny: X · zamówione DD.MM” (`ProductCard.tsx:258-264,372-403`, `compute.ts:140-162`).
7. **WP4 / D3.** Sufiks „/N” w nazwie obcinany w widoku kapitana. Dane i PDF bez zmian. Mail należy do Lane E.

Done: testy Vitest i pytest na każdy punkt. N1 ma test regresji na przypadku Browary/Intermlecz.

## Lane E — mail do dostawcy

Pliki: `supply-os-v1/app/gmail_url.py`, `frontend/src/pages/manager/lib/emailBody.ts`,
`frontend/src/pages/manager/**/DispatchPanel.tsx`, `orderEmailDraft.ts` + testy golden obu builderów.

1. **WP1.**
   - Stopka po danych firmy, nie przed nimi (`gmail_url.py:366` vs `:381-387`).
   - Pozycje spoza katalogu jako wiersze tabeli, nie osobna sekcja (`gmail_url.py:341`).
   - Builder backendowy i frontendowy muszą dawać identyczny wynik.
2. **D2.** Data dostawy w mailu. Kod już ją obsługuje. Operator przełącza `SUPPLY_OS_ORDER_EMAIL_DELIVERY_DATE_ENABLED=true`
   na Railway po deployu WP1. Lane dopisuje to do listy kroków operatora.
3. **WP3.** Jeden przycisk „Wyślij”, który tworzy draft i otwiera **ten** draft (dziś link otwiera folder szkiców,
   `orderEmailDraft.ts:207`).
4. Później (czeka na Marka): WP2 godziny dostaw per lokal (Westfield do 10:00 zamiast zahardkodowanego „od 11:00”,
   `gmail_url.py:357`, `emailBody.ts:199`). D3 w mailu tylko u dostawców wskazanych przez Marka.

Model: e-mail builders = Opus (review-opus-xhigh).

## Lane M — ekrany managera i Transport

Pliki: `frontend/src/pages/ManagerPage.tsx`, `pages/manager/**` (bez `DispatchPanel.tsx`, `emailBody.ts`, `orderEmailDraft.ts`),
`TransportPage.tsx`, `TransportMatrix.tsx`, `OrderLineTable.tsx`, endpointy managera i Transportu w `main.py`.

1. **WP11 / D11.** Filtr dostawców pokazuje wszystkich aktywnych dostawców, w tym Spec Food (`ManagerPage.tsx:452-460`).
2. **Kontrola Marka (D16).** W kolejce managera znacznik „przejęte > 24 h” i „wysłane > 3 dni bez przyjęcia”.
   U kapitana bez zmian.
3. **D10 (A).**
   - Zero od managera wszędzie bursztynowe i przekreślone (`TransportMatrix.tsx:133,148`, `OrderDetailPage.tsx:273-281`).
   - Filtr miasta w Transporcie bez przekreślenia (`TransportPage.tsx:1141`).
   - W linii zapasowej napis „u głównego” zamiast „—” (`OrderLineTable.tsx:154-158`).
4. **D10 (A).** Test odtwarzający dwie kolumny z tym samym nagłówkiem w Transporcie (`main.py:4737,5960-5969`).
   Jeśli błąd się potwierdzi, scalić kolumny per lokal.
5. **WP9 / D4.** Pago + Mory zgrupowane w UI (dane bez zmian). Filber dostaje przycisk „zamówione” bez warstwy agregacji (`main.py:4674`).
6. **WP10 / D5** (jeśli Ben potwierdzi D5). Akcja managera „zamknij bez przyjęcia” dla `manager_sent`, z powodem i śladem.

## Lane D — dane na prodzie (SQL, aplikuje operator)

Pliki: `context/changes/<id>/prod-sql-*.sql` + audyty. Każdy plik ma BEFORE (odczyt), guard, zmianę, AUDIT i rollback.

1. **Kraków/Katowice (D7).**
   - Bukat KRK: reguła dostaw pn/śr/pt, zamówienie dzień wcześniej do 16:00, minimum 500 zł, `biuro@bukat.com`.
   - Dis-Pack: minimum 700 zł, dzień wcześniej.
   - Kuchnie Świata Kraków obsługuje też Katowice.
   - E-maile Selgrosu KRK i Bytom.
   - `ordering_method='email'` tam, gdzie jest adres i minimum.
   - E-mail Supersamu.
   - Cebula biała FORUM ok. 1 kg na 2 tygodnie.
   - Źródło: mail Marka z 15.10 (`inputs/mail-delta-2026-10-17.md`).
2. **Warszawa, gotowe od ręki.**
   - Souvlaki Browary 0,5/2/2.
   - Majonez i musztarda Browary kg → szt (2×3=6, 2×4=8).
   - Rolki Woli max 5 op.
   - Gąbki w paczkach po 10 szt (D17), progi 0,5/1,5.
   - Corfu „box” → „karton”.
   - Cappy jabłko i pomarańcza w szkle po 24 na Woli.
   - Gyros KEN 3 szt.
   - Koperty i spinacze na Mory (D18).
3. **Westfield (D19).** Fuzetea, napoje w szkle po 24, rolki w chemii. Powiśle: Fuzetea i Kinley. Burn czeka na dostawcę od Marka.
4. **D8.** Pozycje „cięte” (halloumi, gyros) tylko do liczenia, bez sugestii, we wszystkich lokalach, które kroją.
   Najpierw research, czy model danych ma pozycje „tylko do spisu”. Jeśli nie ma, potrzebny jest kod (wtedy przekazać do Lane C).
5. **D10 (A) audyty (odczyt).**
   - Duble w katalogu jednego dostawcy; jeśli 0, to migracja z unikalnym indeksem.
   - Nadstany Katowic (ok. 56 skrzynek Coca-Coli; progi MAX napojów KAT).
   - Tabela gotowości per lokal (dostawcy, progi, tokeny, e-mail lokalu, szkolenie).
6. **D15.** Gdańsk zostawia 12 pozycji. 7 z nich, które mają stan, dostaje dostawcę i progi, gdy Marek je poda.

## Fala B (start po potwierdzeniu)

- **D6 obowiązkowe stany** (czeka: blokada czy ostrzeżenie). Flaga per lokal, Norblin i Elektrownia wyłączone, do odwołania.
  Pliki: submit kapitana + migracja. Lane C po pkt 7.
- **D9 kategoria „Materiały / inne”.** Wolny tekst od lokalu jako zgłoszenie, nie produkt z katalogu. Nowa funkcja
  (backend + kapitan + manager), osobny lane po Lane C.
- **D10 lokal SZKOLENIE** na prodzie z dostawcami bez e-maila (wysyłka zablokowana). Lane D + sprawdzenie w kodzie.
- **D10 przegląd trafności progów Krakowa** ok. 27.10 (jednorazowy SQL).
