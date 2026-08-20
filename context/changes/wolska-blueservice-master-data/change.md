---
change_id: wolska-blueservice-master-data
title: WOLA — 9 nowych pozycji Blue Service + progi dla tacek papierowych (tor A)
status: implementing
created: 2026-08-20
updated: 2026-08-20
archived_at: null
---

## Notes

Zgłoszenie Tushara (2026-08-20) dotyczące katalogu dla Wolskiej. Arkusz źródłowy
„Wolska stock":
https://docs.google.com/spreadsheets/d/1-PWvSF_CxKwPo7ofd9ClY3IA8bkHf9i4IxkulkeCci8/edit?gid=0#gid=0

**Weryfikacja arkusza: Tushar UZUPEŁNIŁ.** Wszystkie 13 pozycji jest w sekcji
`Chemia`, każda z min/max. Nie usunął trzech pozycji z sekcji `Biurowe` — ale to
poprawne: produkt zostaje w inwentaryzacji lokalu, zmienia się tylko dostawca.

### Podział na tory (decyzja operatora, 2026-08-20)

Zgłoszenie rozpadło się na dwie różne rzeczy:

- **Tor A (ten lane)** — 10 z 13 pozycji, całkowicie niezależnych od architektury:
  9 nowych produktów + próg dla WOLA przy istniejącym P143. Czysto addytywne,
  bez zmiany schematu, bez ryzyka dla Bracki i Norblina.
- **Tor B** — [[supplier-per-location]]. Zostają 3 pozycje biurowe (zszywki,
  markery, długopis); są zablokowane, bo *są* problemem architektonicznym:
  `supplier_products` nie ma wymiaru lokalizacji.

Sens podziału: Tushar dostaje 10 z 13 pozycji od razu, a decyzja architektoniczna
nie zapada pod presją.

### Ustalenia z researchu

- 3 pozycje „do usunięcia z Pago" to **te same produkty** co 3 z listy Blue Service
  (`Markery`→`Marker czarny Pentel`, `Zszywki do zszywacza`→`Zszywki 24/6`,
  `Długopisy`→`Długopis`). To przepięcie dostawcy, nie usuń+dodaj. → tor B
- `Tacki papierowe 14x25` = istniejące **P143** (Blue Service, dodane przy
  Norblinie). WOLA po prostu nie ma dla niego wiersza progów.
- W prod: **0 wierszy `order_lines`** dla SP_PAGO_P127/P132/P133 oraz dla P143 —
  żadna z tych operacji nie niszczy historii.
- Blue Service ma w prod prawdziwy e-mail (`m.filipiuk@blueservice.com.pl`),
  więc wysyłka zamówienia zadziała.
- **Dryf seed↔prod:** seed ma dla WOLA 134 wiersze, prod 141 — brakuje P135–P141
  (Bombilla, Corfu ×3, AGROS, KAWA, LIPTON) z lane'ów r6/r7. Zastane; domykane
  w fazie 2 tego planu, bo dotyczy tego samego pliku.
