# GoStock: jak pobierać dane przez API (stan na 28.09.2026)

Instrukcja dla ludzi i agentów. Opisuje, jak wyciągnąć z GoStock (moduł magazynowy GoPOS) dane potrzebne do sugestii zamówień: receptury, sprzedaż, zużycie teoretyczne, PZ, straty i liczenia. Wszystko tylko w trybie odczytu.

Źródło: wewnętrzne API aplikacji `stock.gopos.io`, sprawdzone na Woli (org 5079) 28.09.2026. Publicznej dokumentacji nie ma. Endpointy i format filtra odczytano z ruchu przeglądarki, więc GoPOS może je zmienić bez ostrzeżenia.

Przykład wyniku: `docs/pita-supply-os-v1/analysis/recipes-wola-2026-09-28/` (receptury, zużycie per dzień tygodnia, wnioski). Starsza analiza z eksportów CSV: `docs/pita-supply-os-v1/analysis/gostock-2026-09-06/` (tam jest też semantyka dokumentów).

## 1. Dostęp

- Logowanie tylko przez właściciela w jego przeglądarce (Chrome, `https://stock.gopos.io/dashboard`). Agent **nie wpisuje hasła**. Jeśli strona przekierowuje na `/login`, sesja wygasła i właściciel musi zalogować się ponownie.
- API wymaga nagłówka `Authorization: Bearer <token>`. Token to wartość cookie `token` zalogowanej sesji. Bez nagłówka API zwraca 403, po wygaśnięciu sesji 500 lub przekierowanie.
- **Tokenu nie wolno wypisywać, logować, zapisywać do pliku ani wysyłać poza `stock.gopos.io`.** Odczytuj go w kodzie strony i używaj tylko w `fetch` do tej samej domeny.
- Zapytania wykonuj z karty `stock.gopos.io` (np. `javascript_tool` w Claude in Chrome). Wtedy są same-origin i nie trzeba nic wystawiać lokalnie.

## 2. Organizacje (lokale)

Każdy lokal to osobna organizacja z własnymi recepturami i stanami. Adres: `https://stock.gopos.io/ajax/{org}/...`. Listę organizacji konta zwraca `GET /ajax/me`.

| Lokal | org | Supply OS `location_id` |
|---|---|---|
| Wola | 5079 | WOLA |
| Centrala | 5054 | — |
| Bracka | 5153 | BRACKA |
| Browary | 5078 | BROWARY |
| Powiśle | 5156 | — |
| Ursynów (KEN) | 5154 | KEN |
| Poznań | 5155 | — |
| Supersam | 6274 | — |
| Westfield | 6504 | — (start 1.10) |
| MEZE | 4352 | — |

## 3. Filtr `f`

Raporty i listy przyjmują parametr `f`: **base64** (UTF-8) z tekstu, w którym `ç` oddziela warunki, a `¥` oddziela wartości.

Raport per produkt per dzień:

```
_groups=PRODUCT¥DATEçgroup_column=çsort=ççdate_range|bt=2026-09-06 00:00:00¥2026-09-26 23:59:59çproduct_statuses|e=ENABLED¥DISABLED¥DELETED
```

- `_groups=PRODUCT¥DATE` daje wiersz produkt × dzień. `_groups=PRODUCT` daje sumę za cały okres.
- `product_statuses` z `DELETED` jest potrzebne, bo sprzedaż starych pozycji menu inaczej znika z raportu.
- Lista produktów danego typu: `_çproduct_type|e=PACKAGE` (dania i pakiety z recepturą), `COMPOSITE` (półprodukty, np. Musztarda Miodowa), `BASIC` (surowce; bez filtra lista zwraca tylko BASIC).

Kodowanie w JS: `btoa(unescape(encodeURIComponent(tekst)))`, a potem `encodeURIComponent(...)` w URL.

## 4. Endpointy

| Co | Endpoint | Uwagi |
|---|---|---|
| Receptury | `products?f=<PACKAGE>&include=all&page=N&size=100&s=all` | Składniki w `recipes[0].components[]`: `product_id`, `amount`, `measure_type` (KILOGRAM / PIECE / LITER), `sub_product_type`. Stronicuj, aż strona będzie pusta. Na Woli: 97 PACKAGE + 1 COMPOSITE. |
| Surowce | `products?include=all&page=N&size=100&s=all` | Nazwy i jednostki surowców. `id` GoStock ≠ `products.gostock_id` w Supply OS (patrz §6). |
| Sprzedaż dań | `reports/sales_orders?c=quantity,total_price_net&f=<raport>` | Sztuki sprzedanych pakietów per dzień (GoPOS). |
| Zużycie teoretyczne | `reports/sales_orders_products?c=quantity&f=<raport>` | GoStock sam rozkłada sprzedaż przez receptury. Na Woli zgadza się z „sprzedaż × receptura” dla 44/44 surowców. |
| Zakupy (PZ) | `reports/purchase_orders?c=quantity,quantity_received&f=<raport>` | Tylko to, co ktoś zaksięgował. Frytki, falafel i gyros kurczak nie mają PZ nigdzie. |
| Straty / dostosowania | `reports/stock_adjustments?c=quantity,quantity_adjusted&f=<raport>` | Tygodniowy raport strat (sobota) + jednorazowe „dodania stanu”. |
| Liczenia (FIFO) | `reports/stocktakings/fifo?c=amount_initial,amount_actual,amount_consumption,sold_amount&f=<raport>` | Stan systemowy przed liczeniem, stan policzony, rozchód. |
| Korekty | `reports/corrections?f=<raport>` | Różnice przy liczeniach. |
| Stany | `reports/states?f=<raport>` | Stan systemowy na dzień. |

## 5. Procedura dla jednego lokalu

1. Właściciel loguje się w Chrome i otwiera `https://stock.gopos.io/{org}`.
2. W karcie wykonaj pomocnika (token zostaje w pamięci strony):

   ```js
   const tok = decodeURIComponent((document.cookie.match(/(?:^|; )token=([^;]*)/) || [])[1] || '');
   const enc = s => btoa(unescape(encodeURIComponent(s)));
   window.__gs = async (org, path) => {
     const r = await fetch(`/ajax/${org}/${path}`, { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json' } });
     return { status: r.status, j: await r.json().catch(() => null) };
   };
   window.__rep = (from, to, groups = 'PRODUCT¥DATE') => encodeURIComponent(enc(
     `_groups=${groups}çgroup_column=çsort=ççdate_range|bt=${from} 00:00:00¥${to} 23:59:59çproduct_statuses|e=ENABLED¥DISABLED¥DELETED`));
   !!tok  // true = sesja jest; nie zwracaj samego tokenu
   ```

3. Pobierz receptury (stronicowanie) i raporty za **pełne tygodnie** (pon–nd), co najmniej 8 tygodni. Do porównań z liczeniami bierz okno od dnia liczenia do dnia przed następnym liczeniem.
4. **Wyciąganie wyniku:** wypisanie z JS ucina się po ok. 800 znakach, a Chrome blokuje drugie pobranie pliku. Zapisz wynik jako CSV w `<pre>` na stronie (`document.body.innerHTML = '<pre>' + csv + '</pre>'`) i odczytaj `get_page_text`. Duże zbiory dziel na partie. Po przeładowaniu strony pomocników trzeba utworzyć od nowa.
5. Zapisz surowe CSV w `docs/pita-supply-os-v1/analysis/<temat>-<lokal>-<data>/raw/`, a wyniki obok, z README: skąd dane, okres, zapytania, wnioski.
6. Sprawdzenie spójności: suma „sprzedaż dań × receptura” musi równać się `sales_orders_products` dla każdego surowca. Różnica oznacza brakującą recepturę albo pakiet bez receptury.

## 6. Pułapki (sprawdzone na danych)

- **`products.gostock_id` w Supply OS to nie jest ID z GoStock**, tylko numer z naszego ID (P006 → 6, a w GoStock Pomidor = 72). Paruj po nazwie. Tabela dla Woli: `weekday_usage_wola.csv` (kolumny `gostock_id` → `supply_os_product_id`).
- **Jednostki różnią się między systemami:**
  - pita: GoStock liczy sztuki, Supply OS opakowania po 10;
  - gyros: GoStock kg, Supply OS kg, zamówienie w blokach 15 kg;
  - halloumi: GoStock kg (receptura: 35 g plaster, Pita Halloumi = 3 plastry = 105 g), Supply OS szt = **blok 200 g** (Eurial Reha 200 g/12 z faktur Inter-Mlecz);
  - frytki Aviko: GoStock kg, Supply OS worek 2,5 kg (karton = 4 worki = 10 kg);
  - bataty: GoStock kg, Supply OS worek 2,27 kg (karton = 5 worków = 11,35 kg).
- Receptury frytek i batatów mają gramaturę surowego produktu (Frytki 150g = 0,204 kg mrożonych, bataty 150g = 0,234 kg).
- Dokumenty z datą równą dacie liczenia GoStock księguje **po** liczeniu. Okno dokumentów = [poprzednie liczenie, to liczenie).
- GoStock nie ma przesunięć między lokalami; transfer widać jako dwie korekty o przeciwnych znakach.
- Ceny Pago w GoStock są błędne (gyros ok. 2 zł/kg). Wyceniaj ceną z Supply OS (`supplier_products.price_estimate_pln`).
- Warzyw i nabiału z Bukatu GoStock na Woli nie liczy (brak liczeń i PZ), ale są w recepturach, więc zużycie teoretyczne jest. Zużycie rzeczywiste liczymy z liczeń i przyjęć w Supply OS.
- Receptury mogą się różnić między lokalami. Pobieraj je dla każdej organizacji osobno i porównuj przed użyciem.

## 7. Czego nie robić

- Nie loguj się za właściciela, nie zapisuj i nie wypisuj tokenu.
- Żadnych zapisów w GoStock: tylko `GET`.
- Dane sprzedażowe są poufne. Nie wysyłaj ich poza repo i sesję.
- Nie wystawiaj lokalnego serwera do odbioru danych (odmowa klasyfikatora z 28.09). Używaj metody `<pre>` + `get_page_text`.
