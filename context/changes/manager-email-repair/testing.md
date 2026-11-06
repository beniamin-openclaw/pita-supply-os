# Plan i dowody testów — Manager / transport

Zakres: Warszawa (wspólny katalog), Kraków / Katowice / Gdańsk (własne katalogi), Pago, Mory i oba magazyny na jednym transporcie. Produkcja jest sprawdzana wyłącznie odczytem; zapisy, finalizacja i awarie wyłącznie na lokalnej bazie z testowym uwierzytelnieniem. Gmail testujemy z przechwyconą komunikacją, bez tworzenia ani wysyłania prawdziwego zamówienia.

| Ryzyko użytkownika | Trwałe zabezpieczenie | Dowód wykonania wymagany przed zamknięciem |
|---|---|---|
| Miasto dostaje pustą kolumnę bez produktów | API: katalog Managera, prefill i dodanie produktu; Captain zachowuje własny katalog | Warszawa + każde miasto; bez mockowania bazy |
| Przy wyborze Pago i Mory powstaje tylko Pago | Test kliknięcia formularza nowej siatki dla obu / jednego magazynu | Dokładnie jedna para lokalizacja–dostawca, brak duplikatów |
| Zapis znika albo ilości/miasta/magazyny się mieszają | API na Postgresie: utworzenie, zapis, ponowny odczyt i finalizacja | Identyczny product_id u dwóch dostawców; jednostki i sumy sprawdzone oddzielnie |
| Puste szkice i PDF-y / zera po ręcznej edycji | Komponent blokuje puste/niezapisane dokumenty; API odrzuca pustą finalizację bez zmiany statusu | Zero po żądaniu Kapitana; brak wywołania Gmaila; poprawne usuwanie pustych zamówień |
| Mory trafia do dokumentu Pago lub znika z listy kierowcy | Testy budowania dokumentów i treści maila | Pago tylko jego pozycje; kierowca oba magazyny i właściwe kolumny miast |
| Skopiowana lista powtarza nazwy lub gubi dopiski | Wspólny formatter oraz testy dispatch / post-send | Jedna nazwa, prawidłowe ilości/opakowania, pozycje spoza katalogu |
| Kierowcy nie pojawiają się po późnym pobraniu konfiguracji | Test opóźnionej odpowiedzi i ręcznego wyboru | Konfiguracja po otwarciu formularza; zachowanie wpisanego wyboru |
| Kolejka wymusza długi scroll lub gubi zaznaczenie po zwinięciu | Test dostępnego przełącznika i zachowania zaznaczeń | Zwiń → rozwiń → nadal to samo zaznaczenie |
| Testy przechodzą mimo starego błędu | Próba na kopii kodu sprzed poprawki | Nowe testy muszą polec na starym kodzie i przejść na poprawionym |
| Zły odbiorca / konto lub awaria po utworzeniu szkicu powoduje powtórkę | Istniejące testy verified mailbox, kolejności operacji, odmowy tokena, timeoutów i zapisu historii | Pełne testy frontendu i bezpieczny lokalny przebieg; prawdziwe OAuth osobno po wdrożeniu |
| Poprawny kod, zła konfiguracja produkcji | Odczyt katalogów, kanałów i konfiguracji + jawne blokery release | Nie traktować `manual` jako wysłanego maila; nie zgadywać kontaktów Gdańska |

Kolejność: (1) mapa i testy regresji; (2) stary kod — spodziewane błędy; (3) pełne lokalne testy i wszystkie warianty Postgres/API; (4) scenariusze na kopii rzeczywistych danych i przegląd PDF-ów; (5) raport PASS/FAIL/ograniczenia.

Testy `pytest`, `pytest -m integration` oraz `vitest` już wykonuje istniejący CI przy push/PR. Nowe przypadki w tych zestawach będą wykonywane przy każdej kolejnej zmianie. Nie dodajemy drugiego frameworka ani automatycznych zamówień na produkcji. Nie zakładamy, że CI blokuje merge, dopóki nie sprawdzimy ustawień ochrony gałęzi.

## Wyniki wykonania — 2026-11-06

| Sprawdzenie | Wynik | Co stanowi dowód |
|---|---|---|
| Nowe przypadki w istniejącym CI | PASS lokalnie | +24 przypadki: 15 pełnych przepływów Postgres, 3 anulowane członkostwa, 2 dodatkowe warianty tworzenia siatki, 4 szerokości PDF |
| Próba na starej wersji `e4d4c54` | Błędy wykryte zgodnie z oczekiwaniem | 11 frontendowych, 13 Postgres/API, 3 członkostwa i 4 PDF; po poprawce te przypadki przechodzą. Stary kod uruchomiono w osobnej kopii poza repo, bez `.env` |
| Pełny backend / Postgres / frontend | PASS | 1269 / 69 / 1361; Ruff, ESLint i build PASS. Hosted CI tej nieopublikowanej wersji jeszcze nie wykonano |
| Rzeczywiste katalogi — lokalna kopia | PASS | 18 wariantów: Warszawa (wszystkie 7 aktywnych lokali), Kraków, Katowice, Gdańsk, wszystkie 10 aktywnych lokali, mieszany zestaw 4 miast; każdy × Pago / Mory / oba |
| Zapis i odmowy API na rzeczywistych danych | PASS | Prefill, odczyt po zapisie, sumy po magazynie/lokalu, zły duplikat, ujemna ilość 422 bez utraty danych, pusty transport 400 bez zapisu, ponowna finalizacja 409 |
| Treści i dokumenty | PASS | 74 podglądy mail/list; 36 PDF z 18 lokalnych transportów; ilości, jednostki, kolumny i zakres dostawcy porównane z zapisanymi danymi |
| Układ wydruku | PASS po dodatkowej naprawie | Stary PDF 10 lokali wychodził poza stronę. Wszystkie 37 nowych PDF (36 + wariant 13 kolumn) mają cały tekst w marginesach. Obejrzano wyrenderowane przykłady 10 i 13 kolumn oraz Mory Gdańsk |
| Przeglądarka + API + Postgres + przechwycony Gmail | PASS w granicy lokalnego testu | Błędne konto: brak finalizacji/szkicu. Poprawne konto testowe: dwa MIME z PDF, dokładni odbiorcy i nadawca, dwa zdarzenia historii. Wszystkie zewnętrzne żądania Google przechwycone; 0 prawdziwych szkiców/wysyłek |
| Produkcja — aktualny odczyt | Stara wersja, błędy nadal obecne | Warszawa ma katalogi; Forum/Supersam/Słony nadal 0 dla obu magazynów; 4 dostawców z adresem nadal `manual`. Nie wdrożono ani nie zmieniono konfiguracji |
| Ochrona `main` | LUKA — brak wymuszenia CI | GitHub zwraca `protected=false`, protection API: `Branch not protected`. Sam zielony CI nie blokuje pominięcia testów |

Dodatkowo wykryte i naprawione:

1. Anulowany członek zachowywał znacznik transportu dla audytu i wracał do szczegółów/listy, a ponowne dodanie tej lokalizacji było odrzucane. Teraz odczyty i sprawdzenie duplikatu pomijają anulowanych; zapis i historia pozostają. Liczba zamówień/lokalizacji w podsumowaniu oznacza faktyczny ładunek, bez anulowanych.
2. Stałe szerokości kolumn na pionowym A4 ucinały szeroką listę kierowcy. Dla więcej niż 4 lokali jest poziome A4 z szerokościami obliczonymi po odjęciu marginesów, kolumn stałych i odstępów. Ilości i kolejność kolumn pozostają bez zmian. Dokument dostawcy nadal jest pionowy.

Dowody prywatne: `/Users/ben/Documents/Codex/2026-11-06/manager-email-repair/`: `matrix-local-results.json`, `render-extended-verification.json`, `pdf-bounds-verification.json`, `browser-draft-flow-verification.json`, `production-current-check.json`, kopia starego kodu `regression-before/`. Raport nie zawiera tokenów ani prawdziwych szkiców Gmail.

## Warunki dalszego wydania

- Wymagane jest zatwierdzenie wdrożenia kodu i osobno proponowanych czterech kanałów e-mail. Bez migracji, bez modyfikowania istniejących produkcyjnych zamówień.
- Po zgodzie: zweryfikować aktualny `main`, CI i identyczność wdrożonych artefaktów, następnie publiczny odczyt i obecność produktów/wyborów oraz prawdziwe logowanie Google i uprawnienia nadawcy. Lokalny test nie dowodzi zgód ani aliasów prawdziwego konta.
- Rekomendacja zabezpieczenia repo: wymagać udanych `Backend (ruff + pytest)`, `Backend integration (real Postgres)`, `Frontend (build + lint)` przed zmianą `main`. Jest to propozycja zmiany polityki, nie wprowadzona reguła ani nowa konwencja PR.
- Kontakty e-mail części dostawców w Gdańsku pozostają nieuzupełnione; nie podstawiać adresów innych miast. Nigdy nie traktować szkicu jako dowodu wysłania maila.
