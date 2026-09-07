---
change_id: finance-invoice-reconciliation
title: Raport przyjęć dla finansów + kojarzenie faktur z dostawami (Symfonia eBiuro / KSeF)
status: implemented
created: 2026-09-06
updated: 2026-09-07
archived_at: null
---

## Notes

Operator ask (2026-09-06): auto-wysyłka raportu przyjętych dostaw do finansów ze zdjęciem dowodu
zakupu i eksportem, stały arkusz do ręcznego rozliczania faktur, reguły fakturowania per dostawca
i codzienne kojarzenie faktur z zakupami + raport niezgodności.

Stan: MVP ZAIMPLEMENTOWANE (2026-09-07) — operator wybrał opcję 3 (kojarzenie z eBiuro) jako
demo dla finansów na KEN: moduł Manager "Faktury vs dostawy" (`/manager/finance`), migracja 0017,
pilot KEN. Przebieg: plan → niezależny review (Opus, READY-WITH-FIXES, plan-review.md) → implementacja →
niezależny impl-review (SHIP-WITH-FIXES, 13 uwag, wszystkie istotne wdrożone — implementation-notes.md)
→ testy (738 unit + 22 integracyjne na lokalnym Postgresie, ruff, lint, build) → e2e w przeglądarce
z fałszywym backendem → prod: migracja 0017 + NIP-y + 27 faktur KEN z eBiuro.

Discovery (opcje 1–5, pytania na call z finansami) w `discovery-2026-09-06.md` pozostaje aktualne —
feedback z rozmowy z finansami wciąż do dopisania (sekcja 6).

## Deploy (2026-09-07 ~11:15, zweryfikowane na prod)
- PR #28 zmergowany do main (`e00bc8e`). Railway: `/openapi.json` zawiera 6 tras
  `/api/manager/finance/*`, `/health` ok, overview bez tokenu → 401. Vercel: bundle `index-6yHd66qe`
  zawiera `/manager/finance`.
- Dane prod: migracja 0017, 8 NIP-ów dostawców, KEN company_nip, 27 dokumentów / 194 pozycji eBiuro.
- Do zrobienia ręcznie (Ben): zmienne eBiuro na Railway (patrz implementation-notes.md) — bez nich
  "Odśwież z eBiuro" i "Otwórz PDF" odpowiadają 503 z czytelnym komunikatem; panel działa na
  zasianym zrzucie. Test na żywo: `/manager/finance`, KEN, 30 dni.
