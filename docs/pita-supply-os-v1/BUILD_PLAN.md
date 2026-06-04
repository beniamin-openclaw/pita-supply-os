# Build Plan — Pita Bros Supply OS v0

How we go from mockup + seed data → working web app pilot at Wola in ~2 weeks.

## Architecture

```
                  ┌─────────────────────────┐
                  │     Wola Captain        │
                  │      (phone)            │
                  └───────────┬─────────────┘
                              │ HTTPS
                              ▼
              ┌───────────────────────────────┐
              │   React frontend              │
              │   (Magic Patterns generated)  │
              │   Vercel or Cloudflare Pages  │
              └──────────────┬────────────────┘
                             │ /api/*
                             ▼
              ┌───────────────────────────────┐
              │   FastAPI backend             │
              │   supply-os-v1/app/           │
              │   Railway                     │
              └──────────────┬────────────────┘
                             │
            ┌────────────────┼────────────────────┐
            ▼                ▼                    ▼
    ┌──────────────┐  ┌─────────────┐    ┌─────────────────┐
    │ Google Sheet │  │   PostHog   │    │  Gmail (drafts) │
    │ (data layer) │  │ (analytics) │    │   via OAuth     │
    └──────────────┘  └─────────────┘    └─────────────────┘
                             ▲
                             │ HTTPS
                  ┌─────────────────────────┐
                  │   Manager / Office      │
                  │      (laptop)           │
                  └─────────────────────────┘
```

**Data layer choice:** Google Sheets for v0. No Postgres. Reasons: every
agent in the Pita Bros stack can already read Sheets via Drive MCP, the
data volume is tiny (~1k rows/year for v0), and any team member can hand-
fix data in the Sheet without booting the app.

**Switch to Postgres** if/when: row count > 100k, multi-tenant needs,
sub-second latency, or schema migrations get painful. Phase 3 candidate.

---

## Repo layout

```
supply-os-v1/                     # the app code (this slice scaffolded)
├── README.md
├── pyproject.toml
├── Procfile                      # Railway start
├── railway.json                  # Railway config
├── .env.example
├── app/
│   ├── __init__.py
│   ├── main.py                   # FastAPI app, routes
│   ├── config.py                 # env vars
│   ├── models.py                 # Pydantic — matches DATA_MODEL.md
│   ├── seed_loader.py            # reads docs/pita-supply-os-v1/seed/
│   ├── sheets.py                 # Google Sheets adapter (stub in v0)
│   └── suggestion.py             # the suggestion engine
└── tests/
    └── test_suggestion.py

docs/pita-supply-os-v1/           # the design / data home (already exists)
├── README.md
├── BRIEF.md
├── DATA_MODEL.md
├── DESIGN_HANDOFF.md             # ← drives Magic Patterns prompts
├── BUILD_PLAN.md                 # ← this file
├── WOLA_CAPTAIN_BRIEFING.md
├── MIN_MAX_ANALYSIS.md
├── PREMIUM_SERVICES_FIT.md
├── CATEGORIES_AND_UNITS.md
├── MANAGER_DASHBOARD_SPEC.md
├── SHEETS_SCHEMA.md
├── ROADMAP.md
├── mockups/
│   ├── captain_submit_v0.html
│   ├── captain_submit_v0_pre_critique_2026-05-22.html
│   ├── manager_dashboard_v0.html
│   └── manager_dashboard_v0_pre_critique_2026-05-22.html
└── seed/                          # the canonical seed data
    ├── _categories.csv
    ├── locations.csv
    ├── location_product_settings.csv
    ├── products.csv
    ├── suppliers.csv
    └── supplier_products.csv

frontend/                          # frontend repo (Magic Patterns output)
                                   # ← created in Step 2 below; lives in the same
                                   #    Pita Bros monorepo or as a sibling repo,
                                   #    user decision
```

---

## Step 1 — Run the backend locally

The scaffold under `supply-os-v1/` is ready.

```sh
cd supply-os-v1
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Hit:

- http://localhost:8000/health
- http://localhost:8000/api/products
- http://localhost:8000/api/captain/orderable?location_id=WOLA&supplier_id=SUP_PAGO

Run tests:

```sh
pytest
```

---

## Step 2 — Generate the frontend with Magic Patterns

Use the two prompts in [DESIGN_HANDOFF.md](DESIGN_HANDOFF.md#magic-patterns-prompt--captain-submit)
and [DESIGN_HANDOFF.md](DESIGN_HANDOFF.md#magic-patterns-prompt--manager-dashboard).

Workflow:

1. Open Magic Patterns. New project: **Pita Bros Supply OS — Captain Submit**.
2. Paste the Captain Submit prompt.
3. Iterate visually until it matches the HTML mockup at
   [mockups/captain_submit_v0.html](mockups/captain_submit_v0.html).
4. Export as Next.js or Vite + React + TypeScript.
5. Drop into `frontend/captain/`.
6. Wire the API base URL to `process.env.NEXT_PUBLIC_API_URL` (or
   `import.meta.env.VITE_API_URL` if Vite). Default in `.env.local`:
   `http://localhost:8000`.
7. Repeat for **Manager Dashboard** in `frontend/manager/`.

Optionally: one app with two routes (`/captain` and `/manager`) instead
of two apps. Use Next.js App Router. Recommend a single app for v0 —
simpler deploy.

---

## Step 3 — Wire the frontend to the backend

The Captain screen needs three endpoints:

- `GET /api/captain/orderable?location_id=...&supplier_id=...` — products
  + settings for the order screen.
- `POST /api/captain/suggest` — compute one suggestion (or compute
  client-side using the formula; both supported).
- `POST /api/captain/submit` (Step 4 below) — submit the finalized order.

The Manager screen needs two:

- `GET /api/manager/queue?status=captain_submitted&location_id=...`
- `POST /api/manager/dispatch/{order_id}` (Step 4 below) — finalize and
  return Gmail draft body.

---

## Step 4 — Sheets adapter and write paths

The v0 scaffold reads from seed CSVs. Wire it to a real Google Sheet:

1. Create the Google Sheet (one-time):
   - Drive → New Sheet: `Pita Bros Supply OS — Wola Pilot`.
   - Add 9 tabs per [SHEETS_SCHEMA.md](SHEETS_SCHEMA.md).
   - Paste headers from the schema.
   - Paste seed rows from `docs/pita-supply-os-v1/seed/*.csv`.
   - Share **Editor** access with the Google service account email.
2. Create the GCP service account (one-time):
   - GCP project → IAM → Service Accounts → New.
   - Enable Sheets API + Drive API on the project.
   - Generate JSON key → save securely.
3. Implement `supply-os-v1/app/sheets.py`:
   - Open Sheet via `gspread.service_account_from_dict(json)`.
   - Read tab → list of model instances.
   - Write `orders` + `order_lines` on Captain submit (append rows).
   - Update `orders.status` etc. on Manager dispatch.
4. Toggle backend via `SUPPLY_OS_DATA_BACKEND=sheet`.

---

## Step 5 — Auth

v0: **per-location shared code** stored as env var on Railway. Captain
opens `https://supply.pitabros.pl/captain?location=WOLA&code=XYZ`. Code
verified server-side; on success, a session cookie is set.

Phase 1.5: **magic-link via Resend** or simple Google sign-in restricted
to Pita Bros domain.

---

## Step 6 — Deploy to Railway

1. `railway login`
2. `railway init` inside `supply-os-v1/`
3. `railway up`
4. Set env vars in Railway dashboard:
   - `SUPPLY_OS_ENV=prod`
   - `SUPPLY_OS_DATA_BACKEND=sheet`
   - `GOOGLE_SHEET_ID=...`
   - `GOOGLE_SERVICE_ACCOUNT_JSON=...` (paste full JSON)
   - `POSTHOG_API_KEY=...`
   - `POSTHOG_HOST=https://eu.i.posthog.com`
   - `CORS_ALLOW_ORIGINS=https://supply.pitabros.pl,https://...`
5. Add a custom domain: `api.supply.pitabros.pl` (or whatever).
6. Push frontend to Vercel: `vercel` from `frontend/` directory. Add env
   `NEXT_PUBLIC_API_URL=https://api.supply.pitabros.pl`. Domain
   `supply.pitabros.pl`.

---

## Step 7 — PostHog instrumentation

Install PostHog client in the frontend:

```sh
npm install posthog-js
```

Init in `frontend/app/providers.tsx`:

```ts
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: 'https://eu.i.posthog.com',
  person_profiles: 'identified_only',
});
```

Track these v0 events (the success-metric set):

| Event name | Properties | When |
|---|---|---|
| `captain.session_started` | `location`, `supplier` | Captain opens screen |
| `captain.stock_entered` | `product_id`, `value` | Each stock input blur |
| `captain.order_submitted` | `lines_count`, `deviation_count`, `reasons_captured`, `time_to_submit_seconds` | Captain clicks Submit |
| `manager.queue_opened` | `pending_count` | Manager opens dashboard |
| `manager.order_reviewed` | `order_id`, `lines_count`, `manager_changes` | Manager opens order detail |
| `manager.order_sent` | `order_id`, `time_to_send_seconds`, `manager_changes` | Manager clicks Send |
| `system.suggestion_overridden` | `product_id`, `delta_pct`, `reason_code` | Each Captain override |

The four headline numbers we'll look at after 4 cycles:

1. Median **time-to-submit** for Captain (target < 10 min).
2. Median **time-to-send** for Manager (target < 10 min, baseline 30–60).
3. **% lines where final = suggestion** (trust signal).
4. **% deviations with reason captured** (data-asset signal).

---

## Step 8 — Send action (Gmail draft)

For v0, the Manager Dashboard's Send button calls:

```
POST /api/manager/dispatch/{order_id}
```

This endpoint:

1. Validates: no `block` rows, all manager_finals confirmed.
2. Writes back to Sheet: `manager_*` fields, `status='manager_sent'`,
   `sent_method='gmail_draft'`, `sent_at=...`.
3. Returns a Gmail compose URL:

```
https://mail.google.com/mail/?view=cm&fs=1&to=orders@supplier-a.example
&su=Order+from+Pita+Bros+Wola+—+2026-05-23
&body=...URL-encoded plain-text body...
```

Frontend opens this URL in a new tab. The Manager hits Send in Gmail
themselves.

Phase 1.5: replace with the Gmail API + a "Send now" button that posts the
message via the Manager's OAuth-granted account.

---

## Step 9 — Pilot

After Wola Captain briefing ([WOLA_CAPTAIN_BRIEFING.md](WOLA_CAPTAIN_BRIEFING.md)):

1. Lock master data in the Sheet.
2. Captain submits 1 Pago order using the live system (training run, no
   real send).
3. If clean → real first order goes through next ordering day.
4. 4 cycles run.
5. Review with Captain + Manager + Owner against the four headline numbers.
6. Decide: extend / expand / stop.

---

## Phase 1.5 enhancements (in order of value)

1. **Sheets adapter** complete + Captain submit writes orders for real.
2. **Magic-link auth** replaces shared code.
3. **Wispr Flow** voice stock entry — Captain says "Halloumi dwa pięć" → 2.5 kg fills in.
4. **Gumloop** automation: when status flips to `manager_sent`, post to office Slack.
5. **Second supplier** (Bukat) added — proves multi-supplier consolidation.

---

## Effort and timeline (rough)

| Step | Owner | Time |
|---|---|---|
| 1. Run backend locally | dev | 30 min |
| 2. Magic Patterns generate UI | dev | 1 day per screen |
| 3. Wire frontend ↔ backend | dev | 1 day |
| 4. Sheets adapter | dev | 1 day |
| 5. Auth | dev | 0.5 day |
| 6. Deploy Railway + Vercel | dev | 0.5 day |
| 7. PostHog instrumentation | dev | 0.5 day |
| 8. Gmail draft URL | dev | 0.5 day |
| Wola Captain briefing | Ben + Captain | 0.5 day |
| Master data lock | Ben + Captain | 0.5 day |
| Training run + first real cycle | Captain + Manager | 1 week |
| **Total elapsed to first real cycle** | | **~2 weeks** |

---

## Risks

| Risk | Mitigation |
|---|---|
| Magic Patterns output doesn't match the HTML mockups closely enough | Iterate with screenshots; fall back to hand-writing components if needed |
| Google Sheets latency on Sheet write (typically 500–1500 ms) | Optimistic UI on client; queue writes; show "Submitting…" |
| Service account JSON leaks | Store in Railway secrets only; rotate quarterly |
| Captain finds the screen too slow vs paper | Time them early; if >15 min per order, simplify or defer |
| Manager wants more features mid-pilot | Hold the line; everything else is Phase 1.5+ in [ROADMAP.md](ROADMAP.md) |
