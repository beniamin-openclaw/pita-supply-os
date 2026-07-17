---
change_id: feedback-r5-drafts-statuses
status: archived
created: 2026-07-16
archived_at: 2026-07-17T06:50:43Z
updated: 2026-07-17
---

# feedback-r5-drafts-statuses

**Status:** implemented (2026-07-16; verify na prod po deploy)
**Źródło:** feedback operatora (mobile zoom, szkice, statusy po odbiorze,
stopka NIP, Blue Service email, rollout Bracka/KEN + tokeny).

## Kod (ta gałąź)

1. **Mobile zoom (inwentaryzacja):** input ilości `text-sm`→`text-[16px]`
   (iOS zoomuje inputy <16px; ekran zamówień miał już 16px) —
   `InventoryCountPage.tsx`.
2. **Szkice zamówień (root cause + fix):** przełączenie dostawcy kasowało
   pending debounce (500 ms) i czyściło stan → utrata liczb. Teraz:
   - flush szkicu przy zmianie dostawcy/unmount (ref + cleanup keyed na
     `activeSupplierId`), z neutralizacją po submit/wyczyszczeniu (żeby flush
     nie wskrzeszał skasowanego szkicu);
   - **auto-przywracanie** szkicu przy powrocie do dostawcy (overlay na świeże
     linie z master data) + baner „Przywrócono szkic z HH:MM" z „Wyczyść szkic";
   - szkic **bez terminu ważności** (usunięte 24h TTL) — żyje do submitu lub
     wyczyszczenia; puste (all-blank) zestawy nigdy nie nadpisują szkicu.
3. **Statusy po odbiorze:** pierwszy goods-receipt przenosi zamówienie
   `manager_sent → closed` (best-effort, nie blokuje potwierdzenia); kolejne
   odbiory (dostawy częściowe) dozwolone też w `closed`. Manager dostał 4.
   zakładkę **„Zakończone (odebrane)"** (kolejka + filtr); chip odbioru ⚠/✓
   działa też w tej zakładce. Sortowanie WSZYSTKICH zakładek od najnowszego.
4. **Stopka spółki w emailu (NIP):** `locations.company_name/address/nip`
   (migracja 0007, addytywna) → `Location`/`ManagerOrderDetail` → oba buildery
   (gmail_url.py + emailBody.ts, byte-identical): pod „Pozdrawiam, Pita Bros"
   dokleja spółkę + adres firmy + NIP. „Adres dostawy:" → **„ADRES DOSTAWY:"**
   (plaintext nie umie pogrubić — caps to maksimum wyróżnienia).

## Ops w prod Supabase (2026-07-16)

- SUP_BLUESERV email → m.filipiuk@blueservice.com.pl (Pago nadal TBD).
- BRACKA + KEN: aktywowane, adresy dostawy (KEN bez kodu pocztowego — do
  uzupełnienia), po 138 wierszy `location_product_settings` (kopia WOLA;
  rollback = DELETE po location_id).
- Migracja `0007_add_location_company_fields` + backfill spółek:
  WOLA→Pita Bros sp. z o.o. (9522100633), BRACKA→Pita Bros Centrum (5223314413),
  KEN→Pita Bros KEN (5223241275).

## Tokeny (rotacja + nowe lokalizacje)

Nowe `SUPPLY_OS_CAPTAIN_TOKENS` wygenerowane i przekazane operatorowi w czacie
(Railway env — ustawia operator). Stary token WOLA przestanie działać po
podmianie (kapitan wpisze nowy kod).

## Weryfikacja

- BE: ruff czysty, pytest 423 passed (nowe: receipt→closed, closed-receivable,
  concurrent-safe, stopka NIP).
- FE: eslint czysty, vitest 85 passed (nowe: stopka NIP ×2), build OK.
- DB: lokalizacje + settings audytowane selectami po zapisie.

## Otwarte

- [ ] Kod pocztowy KEN (Al. KEN 21, Warszawa — jaki kod?)
- [ ] Pago email (TBD)
- [ ] Promo Beer 0,33/0,5 — dostawca?
- [ ] Corfu Weiss/Free — potwierdzić, że Filber (Lager potwierdzony)
- [ ] Blue Service katalog: 14 brakujących pozycji + korekty nazw/cen
      (Cif vs Tenzi, 12 rolek) — decyzje operatora
- [ ] Test F1: multi-adres w polu „Do" przy 1. zamówieniu Eurofood
