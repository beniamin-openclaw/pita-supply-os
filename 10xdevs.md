# 10xDevs 3.0 — workspace setup

**Katalog roboczy:** `JARVIS V2/10xDEVS` (osobny workspace, poza Jarvis Codex)  
**Kurs:** 10xdevs3  
**Narzędzie:** Cursor (`--tool cursor` → artefakty w `.cursor/`)

---

## Lokalizacja

Folder kursu stoi obok `JARVIS-CODEX/`, nie wewnątrz niego — czysty workspace Cursor bez reguł operacyjnych Jarvisa.

---

## Wymagania

- Node 20+
- Zainstalowane globalnie: `@przeprogramowani/10x-cli` (komenda: `10x`)
- Konto na Circle (email użyty przy `10x auth`)

---

## Szybki start

```bash
cd "/Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS"

10x auth          # logowanie magic link (email z Circle)
10x doctor        # diagnostyka środowiska
10x list          # lista modułów i lekcji
10x get m1l1 --tool cursor   # pobranie / odświeżenie lekcji 1 (Moduł 1)
```

---

## Prework (przed / obok kursu)

- Prework na **Circle** i **platforma.przeprogramowani.pl**
- Lekcja CLI `m0l1` to tylko powitanie — treść preworku jest na platformach

---

## Moduły kursu

| Moduł | Tytuł | Status |
|-------|-------|--------|
| m0 | Prework | unlocked |
| m1 | Agentic Environment | unlocked (start tutaj) |
| m2 | 10xDevs Workflow | unlocked |
| m3 | AI Development Quality & Maintenance | unlocked |
| m4 | Large Scale & Legacy Projects | locked |
| m5 | AI-Native Teamwork | locked |

### Moduł 1 — lekcje

- **m1l1** — Bootstrap: od pomysłu do PRD (`/10x-init` → `/10x-shape` → `/10x-prd`)
- **m1l2** — Tech stack (`/10x-tech-stack-selector` / `/10x-stack-assess`)
- **m1l3** — Bootstrap projektu (`/10x-bootstrapper` / `/10x-health-check`)
- **m1l4** — AGENTS.md, reguły, feedback loops
- **m1l5** — Infra research i pierwszy deploy

---

## Ostatni stan (2026-06-03)

- Workspace: `/Users/ben/Desktop/Jarvis/JARVIS V2/10xDEVS`
- Cleanup: usunięto `.claude/` (stary Claude Code), pusty `AGENTS.md`, duplikat `CLAUDE.md`, `.DS_Store`
- Aktywne artefakty: tylko `.cursor/` (m1l1, Cursor)
- CLI: `10x/1.6.1` — warto zaktualizować: `npm install -g @przeprogramowani/10x-cli`
- Auth: sprawdź `10x doctor` (sesja mogła wygasnąć → `10x auth`)

---

## Następny krok

W Cursorze (Open Folder → `10xDEVS`):

1. `/10x-init`
2. `/10x-shape`
3. `/10x-prd`
