# Nowy punkt w Supply OS — checklista

Co trzeba zebrać i zrobić, żeby kapitan nowego lokalu mógł się zalogować, policzyć stan
i złożyć zamówienie. Na podstawie rolloutów Bracka, Norblin, KEN/Browary
i Elektrownia/Westfield (`context/archive/*-rollout*`, `context/changes/elektrownia-westfield-rollout/`).

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
- [ ] E-mail lokalu (skrzynka czytana na telefonie lokalu) — dodawany do DW maili do dostawców.
- [ ] Telefon lokalu (dla dostawców; na razie tylko w `COMPANY_ENTITIES.md`).

## 2. Produkty i progi min/max

- [ ] Arkusz min/max od Marka (zakładka `min/max`: Dostawca, Produkt, Minimalna ilość,
      Maksymalna ilość, jednostka miary) — **osobny od arkusza inwentaryzacji**.
- [ ] Przy każdej pozycji jednoznaczna jednostka. Gdy liczymy w opakowaniach (karton, blok,
      bidon, zgrzewka, paczka), wiadomo, ile w nim kg lub sztuk — aplikacja trzyma stan w kg / szt / opak.
- [ ] Produkty spoza katalogu aplikacji: nazwa, dostawca, jednostka zakupu, ile w opakowaniu, cena.
      Bez tego pozycja zostaje wstrzymana.
- [ ] Rolki do kas i drukarek: rozmiary zgodne ze sprzętem lokalu (tabela Sławka) i liczba rolek w opakowaniu.
- [ ] Produkcja własna (sosy, kasza, gyros ścięty): progi albo świadoma decyzja „0”.
- [ ] Napoje Coca-Cola: puszka 0,33 czy szkło 0,25.
- [ ] Nazwa firmy dostawcy w arkuszu = nazwa dostawcy w aplikacji („Magazyn” = Magazyn własny Mory).

## 3. Dostawcy i terminy

- [ ] Którzy dostawcy obsługują lokal (Bukat, Intermlecz, Blue Service, Coca-Cola, Kuchnie Świata,
      Filber, Pago, Mory, Spec Food, Go Gastro…).
- [ ] Dni zamawiania i dostaw dla dostawców, którzy mają je per lokal: Pago i Mory, Coca-Cola.
      Trafiają do `supplier_delivery_rules`.
- [ ] Pago: lokal jest w arkuszu „Ordering PB v5 prod” z właściwymi produktami (np. Gyros 25 KG).
- [ ] Minimum zamówienia u dostawców spoza Warszawy (jeśli lokal jest poza Warszawą).

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
   progi z arkusza. Rollback przygotowany przed uruchomieniem.
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
