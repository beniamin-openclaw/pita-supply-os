# ken-browary-master-data — dziennik operacji

Data: 2026-08-31 · Projekt Supabase: `lpzhphufjwrndfogkfub`
Powód: szkolenie wprowadzające 4 lokali (Wolska, Bracka, KEN, Browary) 01-09 o 9:00.
Źródła: `KEN - stock quantity - Inwentaryzacja - Wzór.csv` (138 wierszy),
`Browary - STOCK COUNT - Inwentaryzacja - MIN MAX.csv` (120 wierszy).

## Stan przed zmianą

| Lokal | wierszy | z max>0 | uwaga |
|---|---|---|---|
| KEN | 138 | 126 | **126 progów identycznych co do wartości z WOLA** (kopia, 0 różnic) |
| BROWARY | 114 | **0** | wszystko 0/0/0 → sugestia zawsze 0; `active=false` |

Backup: `_lps_backup_20260831` (KEN 138 + BROWARY 114 = 252 wiersze).

## Wykonane

| Krok | Operacja | Wynik |
|---|---|---|
| 0 | `_lps_backup_20260831` | 252 wiersze |
| 1 | Upsert progów KEN (`on conflict (location_id, product_id)`) | 134 dopasowane z arkusza |
| 2 | Upsert progów BROWARY | 119 dopasowanych z arkusza |
| 3 | `locations.BROWARY.active = true` | 1 wiersz |

Stan końcowy: **KEN 142 wiersze / 132 z max** · **BROWARY 119 wierszy / 107 z max**.
Kontrole zerowe: `min > max` = 0 · `target <> max` = 0 · sieroty FK = 0 · duplikaty = 0.

## Reguły mapowania

Join po znormalizowanej nazwie (`lower` + zwinięcie białych znaków). Aliasy:
`Oliwa z Oliwek Extra Virgin 1L`→`Oliwa z Oliwek 1L`, `Rucola 100 gr`→`Rucola 125 gr` (P007).

- **KEN, brak wartości w arkuszu → wartość z WOLA** (decyzja operatora 2026-08-31).
  Stosowane per pole (`coalesce(arkusz, WOLA, 0)`), więc np. Czosnek min=0,1 z arkusza
  + max z Woli. 8 pozycji spoza arkusza KEN zostało na ustawieniach Woli.
- **BROWARY, brak wartości → 0/0.** Arkusz Browarów jawnie używa `0` jako „nie zamawiamy",
  więc puste pole czytamy tak samo, a nie jako brak danych.
- `target = max` (reguła z Bracki/Norblina).

## Decyzje przy rozjeździe jednostek

Arkusze liczą w kg to, co katalog liczy w szt/opak — 23 pozycje na KEN, 18 na Browarach.
Większość to różnica etykiety bez wpływu na rząd wielkości (worki, koperty, gąbki,
saszetki, liść laurowy) i weszła 1:1, tak jak przy Norblinie.

**Trzy pozycje wstrzymano** — tam jednostka zmienia rząd wielkości, więc wpisano
wartość z WOLA zamiast liczby z arkusza:

| Pozycja | Arkusz | Katalog | Wpisano |
|---|---|---|---|
| Halloumi (KEN) | 2/5 **kg** | szt | 24/72 (WOLA) |
| Halloumi (Browary) | 4,8/14,4 **kg** | szt | 24/72 (WOLA) |
| Gyros 15 KG (Browary) | 3/8 **szt** (= opakowań po 15 kg) | kg | 2/10 (WOLA) |

**Pominięto całkiem:**
- KEN `Gyros wieprzowy 15 kg` + `Gyros kurczak 15 kg` — dwa wiersze arkusza, jeden
  produkt w katalogu (`Gyros 15 KG`). Nie sumowano bez decyzji; P024 został na 2/10 z Woli.
- KEN `Gyros wieprz/kurcz (ścięty + nieścięty)` — oba puste w arkuszu; P037 na 1/3 z Woli.
- BROWARY `Rolki do kasy 57 na 80` — brak takiego rozmiaru w katalogu (są 57×20, 57×30,
  57×50, 80×80). Prawdopodobna literówka; nie zgadywano.
- BROWARY `Olej Rzepakowy 5 L` — max w arkuszu wpisany jako `5L` (tekst). Przyjęto 2/5.

## Rollback

```sql
delete from location_product_settings where location_id in ('KEN','BROWARY');
insert into location_product_settings select * from _lps_backup_20260831;
update locations set active = false where location_id = 'BROWARY';
```

## Do zrobienia przez operatora

- [ ] **BROWARY: `delivery_address` = `TBD`, `company_name`/`company_nip` puste.**
      Te pola trafiają wprost do maila do dostawcy (`gmail_url._format_delivery_address`).
      **Uzupełnić przed pierwszym dispatchem z Browarów.**
- [ ] Potwierdzić 3 wstrzymane pozycje (Halloumi ×2, Gyros 15 KG) — ile sztuk/kg naprawdę.
- [ ] KEN: rozstrzygnąć gyros wieprzowy vs kurczak — czy katalog ma je rozdzielić na 2 SKU.
- [ ] BROWARY: rozmiar rolki „57 na 80".
- [ ] Wyeksportować progi KEN/BROWARY do seeda (rozjazd seed ↔ prod rośnie).
- [ ] Rotacja tokenów — otwarte od `feedback-r4`.
