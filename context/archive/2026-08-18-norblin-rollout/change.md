---
change_id: norblin-rollout
title: Rollout lokalu Norblin — nowy lokal, min/max z CSV, token Captain
status: archived
created: 2026-08-18
updated: 2026-08-18
archived_at: 2026-08-18T18:35:00Z
---

> **Otwarte po archiwizacji** (Faza 4, krok operatora): dopisanie pary
> `NORBLIN:<token>` w Railway → Variables → `SUPPLY_OS_CAPTAIN_TOKENS` oraz smoke GET
> w prod tokenem Norblina. Kod i dane są wdrożone (PR #20, merge `ee62eea`);
> do czasu ustawienia tokena kapitan Norblina nie zaloguje się. Follow-upy w
> `rollout-notes.md`.

## Notes

Trzeci punkt w rolloucie (etap „+2 lokalizacje" z PRD, po WOLA i BRACKA). Źródło danych:
`Norblin - Inwentaryzacja  - Norblin Min Max.csv` (111 wierszy, dostarczony przez operatora
2026-08-18). Cel: kapitan Norblina loguje się i składa zamówienia z pełną funkcjonalnością.

### Stan zastany w prod (Supabase `lpzhphufjwrndfogkfub`, sprawdzony 2026-08-18)

Kluczowa różnica wobec Bracki: **NORBLIN w ogóle nie istnieje**.

- `locations` ma 6 wierszy (WOLA, BRACKA, KEN aktywne; BROWARY, KAMIENICA, KULINARNA
  nieaktywne z adresem `TBD`). **Brak NORBLIN** → potrzebny INSERT lokalu, nie UPDATE kopii.
- `location_product_settings`: WOLA 141, BRACKA 141, KEN 138. **NORBLIN 0 wierszy**
  → potrzebny pełny INSERT, nie podmiana progów w istniejącej kopii.
- Dane spółki (`docs/pita-supply-os-v1/COMPANY_ENTITIES.md:20`): Norblin =
  `Pita Bros sp. z o.o.`, NIP `9522100633`, `ul. Żelazna 51/53, 00-841 Warszawa`.
- Katalog: 141 produktów (P001–P141), 10 dostawców. `Falafel` = P020 u `SUP_KUCHNIE`
  („Kuchnie Świata") — nazwa dostawcy z arkusza zgadza się z systemem, pułapka odpada.

### Kod — zweryfikowany, nie założony

Frontend i backend są już multi-lokalowe (dorobek `bracka-rollout`): brak hardkodu
lokalizacji w ścieżce produkcyjnej, `manager_queue` traktuje `location_id` jako filtr
opcjonalny (`limit=50`, clamp 1..200), `location_name` joinowany, parser
`SUPPLY_OS_CAPTAIN_TOKENS` przyjmuje dowolną liczbę par `LOCATION:token`
(`supply-os-v1/app/auth.py:37`). **Zero zmian w kodzie produkcyjnym.**

Do poprawy tylko liczniki w testach seeda (`supply-os-v1/tests/test_main.py`): liczba
lokalizacji 6→7, liczba produktów 141→142.

Zastane, poza zakresem: `frontend/src/pages/DebugPage.tsx:29` ma `location_id=WOLA`
(strona diagnostyczna poza flow), `frontend/src/pages/captain-mp/CaptainMP.tsx:35`
ma `PILOT_SUPPLIER_ID = "SUP_BUKAT"` jako domyślnie wybranego dostawcę — dla Norblina
nieszkodliwe, bo arkusz ma 13 pozycji Bukata.

### Dopasowanie CSV → katalog (zapytaniem, nie ręcznie)

111 wierszy = 102 z min/max + 9 produkcji własnej z pustym min/max.
Join po znormalizowanej nazwie (`lower` + zwinięcie białych znaków) + 2 aliasy
(`Rucola 100 gr`→P007, `Rolki do kasy 80/80`→P129):

- **98** wierszy dopasowanych → **98 różnych** `product_id` (0 kolizji, 0 duplikatów)
- **4** niedopasowane: `Tacki papierowe`, `Kubeczki papierowe`, `Bifteki burgers`,
  `Rolki do kasy 57/50`
- **34** produkty w systemie nieobecne w arkuszu

### Decyzje operatora (2026-08-18)

1. **Produkcja własna** (P029–P037, w arkuszu bez min/max): progi WOLA **powiększone
   o ~25%**, zaokrąglone do 0,1 — *nie* kopia 1:1. Follow-up: zweryfikować po pierwszym
   tygodniu.
2. **34 produkty spoza arkusza** → `min/max/target = 0` (reguła z Bracki: arkusz jest
   deklaracją operatora). Świadomy koszt: przy policzonym stanie zamówienie takiej pozycji
   wymusza kod powodu.
3. **Rolki `57/50`** → **nowy produkt** zgodnie z arkuszem („tak jak w arkuszu jest,
   nie kopiuj z Woli"): P142 `Rolki do kasy 57 na 50` (Pago), NORBLIN 5/40.
   P129 `80 na 80` = 3/20 z arkusza; P128 i P130 → 0/0/0 (nie ma ich w arkuszu Norblina).
4. **Tacki papierowe / Kubeczki papierowe / Bifteki burgers** → pomijamy (follow-up),
   tak jak przy Bracce. Brak jednostki zakupu, szt./opak. i ceny — zgadywanie trafiłoby
   do maila do dostawcy.
