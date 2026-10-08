# Nowy punkt w Supply OS — checklista

Co trzeba zebrać i zrobić, żeby kapitan nowego lokalu mógł się zalogować, policzyć stan
i złożyć zamówienie. Na podstawie rolloutów Bracka, Norblin, KEN/Browary
i Elektrownia/Westfield (`context/archive/*-rollout*`, `context/changes/elektrownia-westfield-rollout/`)
oraz Kraków Forum / Katowice Supersam (`context/changes/krakow-katowice-rollout/`).

Kod aplikacji się nie zmienia — nowy punkt to dane w bazie i jeden kod dostępu.

## 1. Dane lokalu

Trafiają do tabeli `locations`; adres, spółka i e-mail idą prosto do maila z zamówieniem
do dostawcy, więc muszą być poprawne przed pierwszą wysyłką.

- [ ] Identyfikator lokalu — WIELKIE LITERY, bez spacji (np. `WESTFIELD`). Nie zmienia się później.
- [ ] Nazwa wyświetlana (np. „Pita Bros Westfield Mokotów”) — widać ją w kolejce managera i w mailu.
- [ ] Adres dostawy: ulica z numerem + kod pocztowy i miasto.
- [ ] Wskazówki dla dostawcy, jeśli lokal jest w galerii (rampa, wejście dla dostaw, godziny).
- [ ] Spółka prowadząca lokal: nazwa, adres rejestrowy, NIP (stopka maila). Źródło:
      `docs/pita-supply-os-v1/COMPANY_ENTITIES.md`.
- [ ] E-mail lokalu (skrzynka czytana na telefonie lokalu) → `locations.email` — dodawany do DW maili
      do dostawców.
- [ ] Alias nadawcy → `locations.sender_email`: adres „send-as” skrzynki biuro@ (np. `bracka@pitabros.pl`),
      z którego wychodzi mail do dostawcy. Alias musi być dodany i zweryfikowany w Gmailu biuro@
      przed pierwszą wysyłką; bez niego mail idzie z samego biuro@.
- [ ] Telefon lokalu → `locations.phone` (forma do wyświetlenia, np. „600 722 252”) — drukowany w mailu
      jako „Telefon lokalu:”.

## 2. Produkty i progi min/max

- [ ] Arkusz min/max od Marka (zakładka `min/max`: Dostawca, Produkt, Minimalna ilość,
      Maksymalna ilość, jednostka miary) — **osobny od arkusza inwentaryzacji**.
- [ ] Przy każdej pozycji jednoznaczna jednostka. Gdy liczymy w opakowaniach (karton, blok,
      bidon, zgrzewka, paczka), wiadomo, ile w nim kg lub sztuk — aplikacja trzyma stan w kg / szt / opak.
- [ ] Produkty spoza katalogu aplikacji: nazwa, dostawca, jednostka zakupu, ile w opakowaniu, cena.
      Bez tego pozycja zostaje wstrzymana.
- [ ] Rolki do kas i drukarek: rozmiary z tabeli Sławka dla sprzętu lokalu (np. Sunmi V3 Mix: kasa 80/20,
      drukarka 80/80; 57/50 zostaje nieaktywne) i liczba rolek w opakowaniu. Progi w rolkach (szt).
- [ ] Produkcja własna (sosy, kasza, gyros ścięty): progi albo świadoma decyzja „0”.
- [ ] Napoje Coca-Cola i Cappy: szkło czy plastik/puszka. Coca-Cola: szkło 0,25 (skrzynka 24) czy puszka
      0,33; Cappy: szkło 0,25 (skrzynka 24) czy PET 0,33 (zgrzewka 12). Lokal dostaje tylko wybrany
      wariant, a max jest zaokrąglony do pełnej skrzynki / zgrzewki.
- [ ] Opakowania zbiorcze (`supplier_products.case_unit` / `units_per_case`, np. pomidory skrzynka 6 kg,
      halloumi karton 12) są wspólne dla wszystkich lokali. Sprawdź, że cel lokalu to co najmniej pół
      opakowania — inaczej sugestia wynosi zawsze 0 opakowań i zamówienie pełnego opakowania wymaga powodu.
- [ ] Nazwa firmy dostawcy w arkuszu = nazwa dostawcy w aplikacji („Magazyn” = Magazyn własny Mory).

## 3. Dostawcy i terminy

- [ ] Którzy dostawcy obsługują lokal (Bukat, Intermlecz, Blue Service, Coca-Cola, Kuchnie Świata,
      Filber, Pago, Mory, Spec Food, Go Gastro…).
- [ ] Dni zamawiania i dostaw dla dostawców, którzy mają je per lokal: Pago i Mory, Coca-Cola.
      Trafiają do `supplier_delivery_rules`.
- [ ] Pago: lokal jest w arkuszu „Ordering PB v5 prod” z właściwymi produktami (np. Gyros 25 KG).
- [ ] Minimum zamówienia u dostawców spoza Warszawy (jeśli lokal jest poza Warszawą).
- [ ] Lokal poza Warszawą z własnymi dostawcami (jak FORUM, SUPERSAM): **katalog lokalu**.
      `locations.own_catalog = true` — lokal widzi tylko wiersze `supplier_products` z
      `location_id = <lokal>` i żadnego wiersza wspólnego (warszawskiego). Dostawcy miejscy to osobne
      rekordy `suppliers` na każde miasto. Produkt bez wiersza lokalu jest tam tylko do liczenia.
- [ ] Produkt u dwóch dostawców w jednym lokalu: jeden wiersz główny (progi, sugestia), drugi
      `is_backup = true` — widoczny w zakładce zapasowego dostawcy bez sugestii i bez powodów.
      Każdy zapasowy musi mieć główny w tym samym lokalu (audyt). Kapitan i manager widzą
      „Już zamówione u X” dla otwartych zamówień z ostatnich 7 dni.

## 4. Dostęp

- [ ] Kod kapitana — generuje agent (losowy ciąg hex), podaje go tylko w czacie.
- [ ] Operator dopisuje w Railway → Variables → `SUPPLY_OS_CAPTAIN_TOKENS` parę `LOKAL:kod`
      (po przecinku, bez usuwania istniejących par). Zapis zmiennej = redeploy backendu.
- [ ] Kod trafia do kapitana prywatnie. Kapitan wkleja w aplikacji sam kod, bez `LOKAL:`.
- [ ] Kod managera się nie zmienia (jeden wspólny).

## 5. Kolejność wdrożenia

1. Dane z punktów 1–3 zebrane; braki wypisane operatorowi.
2. Diff „przed” (tylko odczyt) zapisany w folderze zmiany w `context/changes/<lokal>-rollout/`.
3. Jeden skrypt SQL w jednej transakcji: lokal (adres, spółka, `active = true`), brakujące produkty,
   progi z arkusza. Rollback przygotowany przed uruchomieniem. Przy katalogu lokalu wiersze
   `supplier_products` z `location_id` i nowi aktywni dostawcy idą dopiero po wdrożeniu kodu, który
   czyta `location_id` (migracja 0029) — starszy kod pokazałby je we wszystkich lokalach.
   Po dodaniu wierszy lokalu nie uruchamiać `scripts/backfill_supabase.py` ani
   `scripts/sync_master_data.py` bez przeczytania dry-runu (arkusz nie ma tych kolumn).
4. Audyt po zmianie: arkusz vs baza 1:1, brak `min > max`, brak progów na nieaktywnych produktach.
5. Kod kapitana na Railway, potem smoke test kodem lokalu — tylko odczyt (lista produktów Bukat,
   lista do inwentaryzacji). **Nigdy testowego zamówienia do prawdziwego dostawcy.**
6. Kod dla kapitana, krótkie szkolenie: logowanie → pełna inwentaryzacja → pierwsze zamówienie.
7. Manager widzi pierwsze zamówienie w kolejce i sprawdza stopkę maila (adres, spółka, DW).
8. Przegląd progów z lokalem po ~2 tygodniach.

## 6. Po wdrożeniu

- [ ] `COMPANY_ENTITIES.md` — lokal w tabeli „objęte systemem”.
- [ ] Wiersz w `context/foundation/roadmap.md` przy archiwizacji zmiany.
- [ ] Eksport progów do seeda (`docs/pita-supply-os-v1/seed/`), żeby dev/testy nie odjeżdżały od prod.
