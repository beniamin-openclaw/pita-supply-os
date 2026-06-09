---
change_id: gr-01
title: Goods receiving — Captain confirms delivery, uploads WZ photo, triggers auto-email
status: planned
created: 2026-06-09
updated: 2026-06-09
archived_at: null
---

## Notes

GR-01 — pełny zakres (brief do nowej sesji)
Flow:

```
Kapitan zatwierdza dostawę w Supply OS:
  - ilości dostarczone per linia (vs. zamówione)
  - 📷 zdjęcie(a) WZ-ki — wgrane do aplikacji, dołączone do orderu
      ↓
Email automatyczny:
  → officebropb@gmail.com (docelowo GoStock)
  → beniamin@pitabros.pl (testy)
  Zawiera: tabela zamówione/dostarczone, rozbieżności, WZ foto w załączniku
      ↓
Osoba ręcznie tworzy PO w GoStock (bo GoStock nie ma tych orderów jeszcze)
```

Kluczowe decyzje architektoniczne dla nowej sesji:

1. Photo storage — gdzie lądują zdjęcia WZ? Opcje: Google Drive (folder per order, aligns z istniejącym Google infra), Supabase storage (jak pojawi się S-10), base64 w Sheets (tymczasowo). To decyduje o MVP vs. docelowym stacku.
2. ML/WZ processing — to przyszłość, ale storage musi być zaprojektowany tak, żeby to umożliwić. → Roadmap research item, nie blokuje GR-01.
3. Telegram discrepancy alerts — faza 2, też roadmap.

Zaznacz to w roadmapie zanim otworzysz nową sesję:

```
GR-01: Goods Receiving — Captain confirms delivery, WZ photo attached to order,
email to GoStock accountant.
Emails: officebropb@gmail.com (prod), beniamin@pitabros.pl (test)
Research items: WZ photo storage (Drive vs. Supabase), Telegram bot, ML processing pipeline.
```
