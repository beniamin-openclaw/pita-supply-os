---
change_id: supplier-per-location
title: Wymiar dostawcy na poziomie lokalu — jeden produkt, wielu dostawców, wybór per lokal
status: new
created: 2026-08-20
updated: 2026-08-20
archived_at: null
---

## Notes

**Tor B** wydzielony ze zgłoszenia Tushara (2026-08-20) — patrz
[[wolska-blueservice-master-data]] dla toru A (czysto addytywne dane, bez zmiany modelu).

### Problem

Model zakłada, że produkt ma **jednego dostawcę, wszędzie i na zawsze**. Widoczność
pozycji na ekranie zamówienia to `supplier_products` (globalne) ∩
`location_product_settings` (per lokal) — nie ma miejsca, w którym da się zapisać
„Wolska kupuje długopisy w Blue Service, a Bracka w Pago".

Stan faktyczny w prod (2026-08-20): 145 produktów, 145 wierszy `supplier_products`,
**zero produktów u dwóch dostawców, zero bez dostawcy** — reguła 1:1 obowiązuje
w praktyce, mimo że schemat dopuszcza wielu.

### Trzy objawy, jedna przyczyna

1. **Pozycje biurowe na Wolskiej** — zszywki (P127), markery (P132), długopisy (P133)
   mają iść z Blue Service, ale Bracka i Norblin mają na nie realne progi u Pago
   (1/10, 1/3, 1/3). Przepięcie globalne uderzyłoby w nie.
2. **Zamienniki** — frytki bierzemy raz z Selgrosa, raz z Kuchni Świata, przeważnie
   z Intermlecza. Dziś nie do wyrażenia. **Selgrosa w ogóle nie ma w `suppliers`.**
3. **Różne miasta, różni dostawcy** — przy rozwoju poza Warszawę problem się mnoży.

### Rozstrzygnięcia operatora (2026-08-20)

- **Wymiar wieszamy na LOKALU, nie na mieście.** Dwa lokale w tym samym mieście mogą
  mieć różnych dostawców na ten sam produkt — potwierdzone wprost przez operatora.
  To zamyka opcję „per miasto" (mimo że `locations.city` istnieje).
- Operator będzie wyłapywał kolejne produkty-zamienniki w trakcie pracy; agent ma
  „mieć oczy otwarte" i dopisywać je tutaj, gdy się pojawią.

### Hipoteza wyjściowa (do rozbicia w `/10x-shape`, NIE rozstrzygnięcie)

Nullable kolumna na nodze lokalu (`location_product_settings`), mówiąca nie tylko
*ile*, ale i *od kogo*:
- `NULL` → pokaż produkt u **każdego** dostawcy, który go ma (obsługuje zamienniki)
- `SUP_BLUESERV` → pokaż **tylko** u Blue Service (obsługuje długopisy na Wolskiej)
- domyślnie NULL → dzisiejsze zachowanie, zmiana wstecznie zgodna

Alternatywa: osobna tabela `location_supplier_products` (czystsza modelowo,
~580 wierszy do utrzymania ręcznie).

### Bug do naprawienia razem z torem B

`supplier_products.active` jest w bazie i w modelu, ale **kod go nigdzie nie filtruje**
— `_build_orderable_items` (`supply-os-v1/app/main.py:346`) sprawdza wyłącznie
`supplier_id` i obecność progów. Jedyne użycie `.active` w całym `app/` to
`main.py:1980` (`product.active` na ekranie inwentaryzacji). Skutek: ustawienie
`active=FALSE` na `supplier_products` **nic nie robi**. Bez tego „wyłącz dostawcę dla
lokalu" będzie miało dziurę.

### Znany koszt uboczny

Test `test_captain_orderable_wola_pago_returns_18_items`
(`supply-os-v1/tests/test_main.py:119`) asertuje dokładnie 18 pozycji dla WOLA×Pago
i jawnie wymaga obecności P127, P132, P133. Tor B go zmieni (→ 15).

### Następny krok

`/10x-shape supplier-per-location` — to zmiana modelu domenowego, dotyka reguły
z PRD („jedna ścieżka od stanu magazynowego do dostawcy") oraz sekcji Data, która
dziś mówi wprost „no schema change in the baseline pilot".
