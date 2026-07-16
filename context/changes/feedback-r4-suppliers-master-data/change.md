# feedback-r4-suppliers-master-data

**Status:** in-progress (ops applied 2026-07-16; code on branch; rollout pending)
**Źródło:** feedback operatora po zamówieniach Intermlecz / Blue Service / Coca Cola / Bukat (2026-07) + CSV „Wolska stock" z nowymi min/max.

## Root cause połowy feedbacku

`suppliers.email = 'TBD'` u 8/10 dostawców → Gmail otwierał się bez działającego
adresata; zamówienie Blue Service oznaczone `manager_sent` nigdy nie dotarło
(Marek potwierdził brak). Kod traktował 'TBD' jako poprawny email.

## Ops wykonane w prod Supabase (MCP, 2026-07-16)

1. **Emaile dostawców:**
   - SUP_INTERMLECZ → `handel@intermlecz.pl`
   - SUP_EUROFOOD → `zamowienia@gogastro.com.pl,msuchocka@eurofoodsgastro.pl,msuchocka@gogastro.com.pl`
   - SUP_FILBER → `wyspypiwne@filber.pl`
   - SUP_KUCHNIE → `zamowienie@kuchnieswiata.com.pl,b2b@kuchnieswiata.com.pl`
   - SUP_BLUESERV / SUP_PAGO: nadal `TBD` (adresy nie dostarczone)
2. **Jednostki:**
   - Frytki Aviko (P021) i z batatów (P022): inventory `kg`→`szt` (worki), `units_per_purchase_unit`→1, order_note z wagą worka
   - Gąbka do naczyń (P121): `szt`→`opak`
   - Worki na śmiecie 60/120/160L (P124-126): `opak`→`szt`
   - Liść Laurowy (P054): `kg`→`opak` 80 g; Ziele Angielskie (P055): `opak` 500 g;
     Sól (P057) / Pieprz (P058) w saszetkach: `opak` 400 g — wszystkie upp=1 + order_note
   - Feta blok (P014): purchase_unit `blok`→`szt` (1 szt = 2 kg, order_note)
3. **Min/max WOLA** z CSV „Wolska stock" — ~92 pozycje zaktualizowane
   (pełny diff stary→nowy w transkrypcie sesji; stare wartości = rollback).
   Wiersze z pustym min/max w CSV → 0/0 (decyzja: „zostawić puste"):
   P060, P062 (Ionos 2l), P099, P105, P109, P110, P113, P115, P131, P132, P133, P025.
4. **target = max** dla wszystkich 135 pozycji WOLA (decyzja: sugestia dobija do MAX;
   naprawia „Cola liczy do min").
5. **Bombilla:** nowy produkt P135 (Napoje, szt) + SP_BUKAT_P135 (8 PLN) +
   WOLA__P135 (min 2 / max 10).
6. **Coca Cola:** portal URL w `suppliers.notes`: https://cchbcshop.com/websitePL/login

## Zmiana kodowa (ta gałąź)

`DispatchPanel.tsx` — kanał portal: link „Otwórz portal dostawcy" parsowany
z `supplier_notes` (bez hardcodu) + dwustopniowe potwierdzenie przed „Oznacz
jako zamówione" („Czy na pewno złożyłeś już to zamówienie w portalu?").
Nowe klucze i18n: `manager.portalConfirmQ/Yes/No`.

## Otwarte

- [ ] **Blue Service:** brak emaila + załącznik z Excelem nie dotarł (rekonsyliacja „many things not visible")
- [ ] **Pago:** email nadal TBD
- [ ] **Stopka emaila z NIP:** potrzebne dane 2 spółek (nazwa, adres, NIP) + mapowanie
      lokal→spółka (WOLA / BRACKA / KEN). Plaintext Gmail nie umie pogrubić —
      adres dostawy będzie wyróżniony wierszem „ADRES DOSTAWY:" (caps)
- [ ] **Rollout BRACKA + KEN:** adresy dostawy, tokeny Captain (Railway env),
      kopia location_product_settings z WOLA + korekta per lokal
- [ ] **Corfu Lager/Weiss/Free + Promo Beer 0,33/0,5** (w CSV, brak w systemie) —
      który dostawca? (Filber/Eurofood?)
- [ ] Rekomendacja: Liść Laurowy / Ziele Angielskie min/max 0.5/0.5 opak → 1/1;
      Cukier w saszetkach (P056) nadal w kg — potraktować jak sól/pieprz?
