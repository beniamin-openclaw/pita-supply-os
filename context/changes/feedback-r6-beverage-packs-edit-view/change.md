# feedback-r6-beverage-packs-edit-view

**Status:** implemented (2026-07-16; DB ops wykonane + zaudytowane, FE wdrożony)
**Źródło:** feedback operatora — (1) napoje zamawiane w opakowaniach
zbiorczych (zgrzewkach), (2) edycja zamówienia Kapitana ma wyglądać jak
tworzenie zamówienia (pełna lista produktów, wypełnione pola).

## 1. Zgrzewki napojów (ops w prod Supabase — bez zmian w silniku)

Silnik już umie: `units_per_purchase_unit` + `rounding_rule` konwertują
sztuki→zgrzewki (wzorzec kartonów/worków). Zmiana to wyłącznie master data.

**Wielkości opakowań (od operatora):**
- po **24 szt**: Sprite, Cola, Cola Zero, Fanta, woda (Kropla ×2), Kinley
  oraz piwa z hurtowni CC/Eurofood (Corona, Corona 0%, Lech Free, Mythos —
  standardowa skrzynka 24; do potwierdzenia przez operatora)
- po **12 szt**: Monster, Fuzetea, Cappy (Jabłko, Pomarańcza)
- po **6 szt**: lemoniady (Lemon/Orange/Grapefruit) i towar od Filber
  (Corfu Lager/Weiss/Free)

**Logika anty-overstock (zaproponowana, wdrożona):**
1. `rounding_rule = up_for_critical` dla napojów w zgrzewkach: zgrzewka
   sugerowana dopiero gdy brakuje **ponad pół zgrzewki** (zaokrąglenie do
   najbliższej); produkty krytyczne (Cola, Cola Zero) zaokrąglają w górę
   (nigdy braku). Reguła istnieje w silniku i FE — zero zmian w kodzie.
2. `target = max` wyrównane **w dół** do wielokrotności zgrzewki
   (min 1 zgrzewka): Fanta/Sprite 36→24, Monster 16→12, Fuzetea 30→24,
   Kinley 18→24 (jedyny wzrost — 0 zgrzewek = delisting).
3. **Piwa: target = max = 1 zgrzewka** (Corona/Corona0/Lech Free/Mythos 24;
   Corfu ×3 → 6). **Wina (butelki): target = max = 2 szt** (wielkość kartonu
   nieznana — fallback od operatora): Ionos 750ml białe/czerwone, Retsina
   500ml. Ionos 2l (bag-in-box) zostają na 0 (nie stockowane; operator nie
   podał).
4. `allow_over_max_due_to_packaging = TRUE` dla napojów w zgrzewkach —
   przekroczenie MAX wynikające z pełnej zgrzewki nie wymusza reason code.
5. **Ceny przemnożone przez zgrzewkę** (`price_estimate_pln` było za szt;
   wartość zamówienia liczy qty_purchase × cena) — np. Cola 2.70→64.80.
6. `order_note = '1 zgrzewka = N szt'` na karcie Kapitana.

## 2. Edycja zamówienia Kapitana = widok tworzenia

`OrderEditPage.tsx`: zamiast tylko linii zamówienia + pickera „dodaj
produkt" → **pełna lista orderable dostawcy** (jak CaptainMP), z ilościami
z zamówienia nałożonymi na karty. Wyzerowanie ilości usuwa pozycję (PATCH
podmienia pełny zestaw linii — bez zmian w backendzie). `AddProductPicker`
usunięty z widoku Kapitana (szybkie dodanie zostaje u Menedżera). Fallback:
produkt z zamówienia spoza aktualnego orderable dalej widoczny (lineToItem);
gdy fetch orderable padnie — degradacja do starego widoku (same linie).

## Otwarte

- [ ] Potwierdzić zgrzewki piw z CC/Eurofood (Corona/Corona0/Lech Free/
      Mythos przyjęte 24) i kartony win (przyjęte 2 szt fallback)
- [ ] Bombilla (Bukat) — zostaje na szt (nie wymieniona)
- [ ] Woda 5l pracownicza (Intermlecz) — zostaje na szt (baniak, nie zgrzewka)
