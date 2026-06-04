# Finish Plan — Supply OS v0 do pilota

**Stan na 2026-05-23 08:40:** backend FastAPI działa na dropletcie z prawdziwymi tokenami, dostępny tylko z sieci wewnętrznej `172.18.0.1:8001`. Public exposure NIE jest jeszcze wpięte. Frontend NIE istnieje. Pisanie do Sheet NIE jest jeszcze zaimplementowane.

**Definicja "pilot ready":** Wola Captain wchodzi na URL z telefonu → wpisuje swój kod → wpisuje stany magazynowe 6 produktów Pago → akceptuje sugestie systemu → klika Submit → Manager w biurze widzi to w dashboardzie → klika Send → otwiera się Gmail draft z gotowym zamówieniem do Pago → Manager wysyła z Gmail → status order'a aktualizuje się.

---

## 7 faz, 5 dni do pilota, 4 tygodnie pilota

```
TODAY
 │
 ├──── Phase A ──── Public HTTPS exposure (Caddy gateway extension)  ~30 min, 30s downtime
 │     ▲
 │     │ Bundle
 │     ▼
 ├──── Phase B ──── Caddy cert persistence (data volume)            ~5 min, bundled with A
 │
DAY 2
 │
 ├──── Phase C ──── Write endpoints + Sheets adapter                ~1 day
 │     │            • Provision Google Sheet from seed CSVs (Ben)
 │     │            • Create GCP service account, share Sheet (Ben)
 │     │            • Implement app/sheets.py with gspread (Claude)
 │     │            • POST /api/captain/submit (Claude)
 │     │            • POST /api/manager/dispatch (Claude)
 │     │            • Tests + deploy + curl validation (Claude)
 │     │
 │     │   ─── parallel ────────────────────────────────────
 │     │
 │     ├── Phase E ── Wola Captain session                          ~1 h (30 min + 30 min)
 │              • Run WOLA_CAPTAIN_BRIEFING.md
 │              • Refresh min/max, unit conversions, supplier email
 │              • Update Sheet with real numbers
 │
DAY 3-5
 │
 ├──── Phase D ──── Frontend gen + Vercel deploy                    ~1-2 days
 │     │            • Update Magic Patterns prompts (Authorization header) (Claude)
 │     │            • Magic Patterns generate Captain Submit + Manager Dashboard (Ben)
 │     │            • Wire fetch → https://supply.46-101-213-61.nip.io (Claude/Ben)
 │     │            • Deploy to Vercel (Ben)
 │     │            • Update CORS_ALLOW_ORIGINS on droplet (Claude)
 │     │            • E2E QA from Ben'a telefonu (Ben)
 │
WEEK 2 - 5
 │
 ├──── Phase F ──── Pilot — 4 ordering cycles                       ~4 weeks
 │              • Captain submits weekly
 │              • Manager dispatches via Gmail draft
 │              • PostHog adoption metrics tracked
 │              • Issues logged in WORKLOG
 │
END WEEK 5
 │
 └──── Phase G ──── Retro + decision                                ~1 h meeting
                    • Czy extend Wola pilot?
                    • Drugi supplier (Bukat)? KEN? Browary?
                    • Phase 2 (receiving + WZ)? Lovable+Supabase pivot?
```

---

## Phase A — Public HTTPS exposure (TODAY)

**Owner:** Claude execute, Ben observe.
**Scope of change:** trwała edycja `/opt/pitabros/docker-compose.yml` + `/opt/pitabros/Caddyfile` + recreate gateway container.
**Downtime:** ~30s na port-80 Caddy routes (heatmap broken anyway, basicauth dashboardy, delivery_public).
**Nie dotyka:** OpenClaw Telegram agent (systemd), delivery monitoring (cron), Postgres data, Streamlit container data, link-brief worker.

### Steps

1. Edit `/opt/pitabros/docker-compose.yml`:
   - Add `- "443:443"` to `gateway.ports`
   - Add `- caddy_data:/data` + `- caddy_config:/config` to `gateway.volumes`
   - Add `caddy_data:` + `caddy_config:` to top-level `volumes:`
2. Edit `/opt/pitabros/Caddyfile`:
   - Append new server block for `supply.46-101-213-61.nip.io` → reverse_proxy 172.18.0.1:8001
3. `docker compose config` — validate full YAML
4. `docker exec pitabros-gateway-1 caddy validate --config /etc/caddy/Caddyfile`
5. `cd /opt/pitabros && docker compose up -d gateway` — recreate only gateway
6. Wait ~30s for Caddy to issue Let's Encrypt cert via HTTP-01
7. External smoke tests (z mojego laptopa):
   - `curl -s https://supply.46-101-213-61.nip.io/health` → 200 + minimal JSON
   - `curl -i https://supply.46-101-213-61.nip.io/api/products` → 401
   - `curl -H "Authorization: Bearer <CAPTAIN_TOKEN>" https://supply.46-101-213-61.nip.io/api/captain/orderable?supplier_id=SUP_PAGO` → 200 + 6 items
   - `curl -H "Authorization: Bearer <MANAGER_TOKEN>" https://supply.46-101-213-61.nip.io/health/internal` → 200 + diagnostic JSON

### Definition of done

`https://supply.46-101-213-61.nip.io` zwraca prawdziwy HTTPS z Let's Encrypt certem, auth gating działa public-side, wszystkie poprzednie Caddy routes (heatmap zostaje 502, dashboardy z basicauth, delivery_public) działają jak przed.

### Rollback (jeśli coś się popsuje)

```sh
cp /opt/pitabros/docker-compose.yml.bak.pre_supply_os_2026-05-23 /opt/pitabros/docker-compose.yml
cp /opt/pitabros/Caddyfile.bak.pre_supply_os_2026-05-23 /opt/pitabros/Caddyfile
cd /opt/pitabros && docker compose up -d gateway
```

---

## Phase B — Cert persistence (TODAY, bundle z A)

**Owner:** Claude.
**Effort:** 5 min, bundled with Phase A recreate.

### Problem

Caddy w obecnej konfiguracji NIE persystuje wystawionych certyfikatów Let's Encrypt. Każdy restart kontenera = re-issue. Ratelimitów LE jest ~50 certs/week per registered domain. nip.io to JEDEN registered domain shared globalnie — możemy hit rate limit jeśli będziemy często restartować.

### Fix (zintegrowane z Phase A)

W docker-compose.yml dodaję dwa named volumes do gateway:
```yaml
volumes:
  - ./Caddyfile:/etc/caddy/Caddyfile
  - caddy_data:/data
  - caddy_config:/config

# i na końcu pliku:
volumes:
  caddy_data:
  caddy_config:
```

### Definition of done

Po restarcie gateway, `docker exec pitabros-gateway-1 ls /data/caddy/certificates/acme*/supply.46-101-213-61.nip.io/` pokazuje pliki `.crt` i `.key`. Następny restart NIE re-issueuje.

---

## Phase C — Write endpoints + Sheets adapter (DAY 2)

**Owner:** Ben provisions GCP + Sheet (one-time), Claude implements code + deploys.
**Effort:** Ben ~30 min + Claude ~4-6 h + deploy ~30 min.

### Ben's setup (~30 min, one-time)

1. **Provision Google Sheet:**
   - W Drive → New Sheet → name: `Pita Bros Supply OS — Wola Pilot`
   - Lokalizacja: Drive → Pita Bros → Supply OS / (utwórz)
   - 9 zakładek per [SHEETS_SCHEMA.md](SHEETS_SCHEMA.md): products, suppliers, locations, supplier_products, location_product_settings, orders, order_lines, _meta, _reason_codes
   - Wklej headers z [SHEETS_SCHEMA.md](SHEETS_SCHEMA.md)
   - Pre-fill _meta i _reason_codes per schema
   - Pre-fill 5 master-data zakładek z `seed/*.csv` (copy-paste)
   - Zostaw orders + order_lines puste
   - Pobierz Sheet ID z URL: `https://docs.google.com/spreadsheets/d/<TO>/edit`
2. **GCP service account:**
   - GCP Console → IAM → Service Accounts → New
   - Name: `pita-supply-os-sa`
   - Enable Sheets API + Drive API w projekcie
   - Generate JSON key → save bezpiecznie
3. **Share Sheet z service account:**
   - Skopiuj email service-accounta (kończy się `@<project>.iam.gserviceaccount.com`)
   - W Sheet: Share → Add this email → Editor
4. **Ping Claude'a "ready"** + przekaż Sheet ID + service account JSON do droplet `.env`:
   - SSH do droplet
   - `nano /opt/pitabros/supply-os/.env`
   - `SUPPLY_OS_GOOGLE_SHEET_ID=<Sheet ID>`
   - `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON=<paste single-line JSON>`
   - Save, exit. NIE restartuj jeszcze — Claude przelaczy backend po deploy code.

### Claude's implementation (~4-6 h)

1. **`app/sheets.py`** — pełna implementacja (obecnie stub):
   - `_client()` — gspread auth
   - `_sheet()` — open by sheet_id
   - `load_*` functions — replace seed_loader gdy `data_backend=sheet`
   - `append_order(order)` — write to `orders` tab
   - `append_order_lines(lines)` — write to `order_lines` tab
   - `update_order_status(order_id, **kwargs)` — update existing row
   - Caching z TTL ~60s dla read paths (Sheets API latency)
2. **`POST /api/captain/submit`** — Captain finalizes order:
   - Pydantic request: location_id (from auth), supplier_id, lines[{product_id, current_stock, captain_final_qty_purchase, reason_code, comment}]
   - Validates: all critical-or-deviation lines have reason
   - Computes: suggested qty, deltas, status='captain_submitted'
   - Writes: 1 order row + N order_line rows to Sheet
   - Returns: order_id + summary
3. **`POST /api/manager/dispatch`** — Manager finalizes + creates Gmail URL:
   - Pydantic request: order_id, manager_finals[{order_line_id, manager_final_qty_purchase, manager_comment}]
   - Validates: no blocking rows, all reasons captured
   - Writes: update order_lines (manager_final_*), update order (status='manager_sent', manager_sent_at, manager_user)
   - Returns: gmail_compose_url (pre-filled with `mailto:` style query params)
4. **Tests:**
   - Mock gspread (no real Sheet calls in CI)
   - Test submit happy path
   - Test submit blocked by missing reason
   - Test dispatch happy path
   - Test dispatch concurrency (order already sent)
5. **Deploy:**
   - rsync code to /opt/pitabros/supply-os/
   - `pip install --upgrade gspread google-auth` (already in pyproject)
   - `systemctl restart jarvis-supply-os`
   - Switch `SUPPLY_OS_DATA_BACKEND=sheet` in .env
   - Smoke test from droplet: curl submit + check Sheet has new row
6. **External smoke:** curl submit + verify Sheet write from laptop with Captain token

### Definition of done

Z laptopa: `curl -X POST -H "Authorization: Bearer <C>" -d '<json>' https://supply.46-101-213-61.nip.io/api/captain/submit` → nowy wiersz w `orders` tab + N wierszy w `order_lines` tab Sheeta. Następny curl `/api/manager/queue` z Manager token → ten order pojawia się w kolejce.

---

## Phase D — Frontend gen + Vercel deploy (DAY 3-5)

**Owner:** Ben (Magic Patterns iteruje), Claude (wires + deploys).
**Effort:** ~1-2 dni.

### Steps

1. **Update Magic Patterns prompts** w DESIGN_HANDOFF.md (Claude, 30 min):
   - Add Authorization header pattern: każdy request wysyła `Bearer <token>` z localStorage
   - Add "first visit code entry screen": gdy localStorage pusty, pokaż screen "Wpisz kod miejsca"
   - Add API base URL via `import.meta.env.VITE_API_URL`
2. **Magic Patterns generuje UI** (Ben, ~2-4 h):
   - Wklej Captain Submit prompt → iteruj wizualnie → eksportuj jako Vite + React + TypeScript
   - Wklej Manager Dashboard prompt → iteruj → eksportuj
   - Zapisz oba w jednej kodzie React (jedna aplikacja, dwa routes: `/captain` i `/manager`)
   - Albo dwie osobne aplikacje (decyzja Bena)
3. **Wire fetch → backend** (Claude lub Ben, ~1-2 h):
   - Konfiguracja `import.meta.env.VITE_API_URL`
   - LocalStorage token entry flow
   - Error handling (401 → re-prompt for code)
   - Toast on submit / dispatch
4. **Vercel deploy** (Ben, ~30 min):
   - `vercel` z katalogu frontend
   - Connect to GitHub (lub upload zip)
   - Env var: `VITE_API_URL=https://supply.46-101-213-61.nip.io`
   - Deploy → URL `<app>.vercel.app`
5. **CORS update na dropletcie** (Claude, 5 min):
   - SSH, nano /opt/pitabros/supply-os/.env
   - `SUPPLY_OS_CORS_ALLOW_ORIGINS=https://<app>.vercel.app`
   - `systemctl restart jarvis-supply-os`
6. **E2E QA** (Ben, ~30 min):
   - Otwórz `https://<app>.vercel.app` na telefonie
   - Wpisz Captain WOLA code → zapisuje w localStorage
   - Wybierz Pago → widzisz 6 produktów + min/max
   - Wpisz current_stock → suggestion auto-calculates
   - Override 1-2 lines, captures reason
   - Submit → toast "submitted"
   - Otwórz na laptopie z Manager code → Manager Dashboard → widzi nowy order → review → Send → Gmail draft otwiera w nowej karcie

### Definition of done

Captain telefon + Manager laptop → pełna pętla bez bugów. Order trafia do Sheeta, Gmail draft otwiera się prefilled.

---

## Phase E — Wola Captain session (DAY 2-5, gdziekolwiek pasuje)

**Owner:** Ben + Wola Captain (+ Happy Scribe transcript — Polish-quality).
**Effort:** 30 min meeting + 30 min Sheet update.

Już mamy [WOLA_CAPTAIN_BRIEFING.md](WOLA_CAPTAIN_BRIEFING.md) — 8 sekcji, decyzje-do-locka. Output: validated min/max + unit conversions + Pago email/cutoff/address w Sheecie (zaktualizowane przez Bena post-meeting).

Kluczowe pytania do Captaina (powtórka z briefing):
- A1-A6: czy Wzór min/max nadal aktualne? Souvlaki Kurczak ma być 12 czy 53 kg? Halloumi 9 czy 72 kg?
- B: weryfikacja unit conversions
- C: Pago email + cutoff + delivery address
- D-G: workflow validation, edge cases

**Definition of done:** Sheet zawiera real-world min/max dla wszystkich 18 Pago products oraz email + cutoff + adres delivery.

---

## Phase F — Pilot — 4 cycles (WEEK 2-5)

**Owner:** Wola Captain submits + Manager dispatches; Ben monitors.

### Co dzieje się co cykl

1. **Captain ordering day** (np. wtorek):
   - Captain otwiera URL na telefonie
   - Wpisuje current stock (~5-10 min)
   - Akceptuje sugestie / overrides z reasons
   - Submituje
2. **Manager dispatch** (ten sam dzień, przed 16:00 cutoff Pago):
   - Manager loguje się
   - Review queue
   - Adjust if needed
   - Click Send → Gmail draft otwiera się
   - Manager pushes Send w Gmailu
3. **Delivery + reconciliation** (poza scope v0):
   - WZ photo + final accept = Phase 2, nie tutaj
   - W v0: po prostu Captain potwierdza otrzymanie w Telegramie / WhatsAppie

### Metryki (PostHog gdy będzie wireowane w Phase 1.5)

| Metryka | Target |
|---|---|
| Time-to-submit (Captain start → submit) | < 10 min |
| Time-to-dispatch (Manager open queue → click send) | < 10 min |
| % lines where final = suggestion | ≥ 90% |
| % deviations with reason captured | ≥ 95% |
| Stockouts on v0 products | 0 |
| Captain satisfaction (1-5) | ≥ 4 |
| Manager satisfaction (1-5) | ≥ 4 |

### Definition of done

4 cycles ukończone, metryki w arkuszu, retro meeting umówiony.

---

## Phase G — Retro + decision (END WEEK 5)

**Owner:** Ben + Captain + Manager + Owner.
**Effort:** 1 h meeting.

### Inputs

- PostHog metrics (lub manual jeśli PostHog nie wireowany)
- Captain interview ("co działało, co nie, gdzie był ból")
- Manager interview (time saved? proces lepszy?)
- Order audit (kolumny: suggestion vs final vs reason)

### Decyzje

1. **Extend Wola pilot?** Tak → kolejny cykl 4 tygodni, doszlifowane. Nie → zwija.
2. **Drugi supplier?** Bukat (fresh produce, 14 SKUs, daily cadence) jest naturalnym kandydatem.
3. **Druga lokalizacja?** KEN / Browary / Bracka?
4. **Phase 2 modules?** Receiving + WZ + discrepancies?
5. **Tech pivot?** Lovable + Supabase vs continue z FastAPI + Sheets?

### Definition of done

Decyzje zapisane jako ADR-002 w docs/pita-supply-os-v1/.

---

## Co kogo blokuje

| Phase | Blokuje | Blokowana przez |
|---|---|---|
| A (Caddy) | D (frontend wymaga public URL) | — (gotowe do start) |
| B (cert volume) | bundled with A | A |
| C (writes + Sheets) | F (pilot wymaga write paths) | Ben provisions GCP + Sheet |
| D (frontend) | F (pilot wymaga UI) | A (public URL) + opcjonalnie E (real data dla testu) |
| E (Captain session) | F (pilot wymaga real min/max) | Ben umawia z Captainem |
| F (pilot) | G (retro wymaga data z pilotu) | C + D + E wszystkie done |
| G (retro) | Phase 2 decision | F |

---

## Co dzieje się TODAY (faza A+B)

Pre-zatwierdzone (Ben: "nie ma problemu wyłączyć na chwilę dropleta"). Lecę z:

1. Edit docker-compose.yml + Caddyfile (+ caddy_data volume)
2. Validate
3. `docker compose up -d gateway`
4. Czekam na Let's Encrypt cert
5. External smoke test
6. Raport per Phase A + B definition-of-done

**Po fazie A+B:** zatrzymuję się. Wyniki + następny krok = Phase C provisioning po Twojej stronie (~30 min Ben'a Sheet + GCP).
