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
