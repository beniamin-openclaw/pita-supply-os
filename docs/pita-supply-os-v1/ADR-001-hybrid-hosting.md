# ADR-001: Hybrid hosting for Pita Bros Supply OS v0

**Status:** Accepted
**Date:** 2026-05-22
**Deciders:** Ben (CFO/CTO/co-owner)

## Context

Pita Bros Supply OS v0 needs to be reachable from a Captain's phone in the
Wola kitchen and from a Manager's laptop in the office. The project sits
on top of three existing infrastructure assets:

1. **DigitalOcean droplet** (`46.101.213.61`, `openclaw-gateway-1`) — already
   runs Pita Bros production: OpenClaw Telegram bot, delivery monitoring
   (Pyszne/UberEats/Bolt/Forum), Postgres, Streamlit dashboards, Caddy
   reverse proxy. 1 GB RAM, 1 CPU, 65% disk used.
2. **Mac Mini** (local) — runs personal/local automation (Gmail labels —
   retired, mail-to-Trello — retired, personal brief). No public access.
3. **Google Workspace** — Sheets, Gmail, Drive — already integrated via
   MCP and used across the project.

User constraints:
- Production OpenClaw on the droplet must keep running without disruption.
- User's primary domain is not exposed in chat → URLs must work without
  user revealing it.
- Pilot at Wola is 1 supplier, ~18 products, 4 ordering cycles — small
  load (≪ 1 req/s sustained).
- Premium services available: Railway, Vercel, Lovable, Supabase, etc.
- Auth must be real (not "trust the network"), but doesn't need full
  OAuth in v0.

Forces at play:
- **Tempo vs. control.** Railway-only is fastest to ship. Droplet-only
  keeps everything in-house. Hybrid trades a little setup time for the
  best long-term fit.
- **Resource discipline.** The droplet is tight on RAM. Anything we add
  must be memory-budgeted explicitly.
- **Brand surface.** Captain sees the URL on their phone every ordering
  day. An ugly URL signals "this isn't real software." But user
  isn't ready to commit a real subdomain yet.

## Decision

Adopt **Hybrid C**:
- **Frontend** on **Vercel** (free tier, global CDN). React SPA generated
  by Magic Patterns from the prompts in [DESIGN_HANDOFF.md](DESIGN_HANDOFF.md).
- **Backend** on the **droplet**, as a new systemd-managed FastAPI service
  (`jarvis-supply-os.service`) listening on `127.0.0.1:8001`. Routed
  through the existing Caddy via a new server block. Memory-bounded.
- **Data** in **Google Sheets** (Phase 1.5; v0 ships with seed CSVs and
  read-only API while we collect Wola Captain validation data).
- **Auth** via **Bearer tokens** (per-location for Captain, shared for
  Manager) — already implemented in `supply-os-v1/app/auth.py`.
- **External URL** via **nip.io** subdomain: `supply.46-101-213-61.nip.io`
  — Caddy + Let's Encrypt issue HTTPS automatically. Phase 1.5 we migrate
  to user's real subdomain.

## Options Considered

### Option A — Railway + Vercel

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost (v0) | ~$5/mo backend (~$60/yr) |
| Scalability | High (Railway scales horizontally) |
| Team familiarity | New service for Pita Bros |
| Time to first deploy | 30 minutes |
| Data location | Data in Sheets, app in Railway |

**Pros:** Fastest path. Zero infrastructure work. Automatic HTTPS.
Self-service env vars. Logs in dashboard. CI/CD trivial.

**Cons:** Adds a third hosting bill. Adds another vendor dependency.
Production logs leave Pita Bros. Doesn't match the "in-house production"
culture (GoStock on Pita Bros boxes, OpenClaw on droplet).

### Option B — Droplet all-in-one

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost (v0) | $0 incremental (existing droplet) |
| Scalability | Limited (1 GB RAM, 1 CPU) |
| Team familiarity | High (existing OpenClaw deploys use the same patterns) |
| Time to first deploy | ~2-3 hours including Caddy + systemd + frontend serving |
| Data location | All in-house |

**Pros:** Zero added cost. Single ops surface. Matches existing patterns
(systemd unit + Caddy block per service). Data + app + reverse proxy
under one operator.

**Cons:** Captain frontend served from the same tiny box that runs
delivery monitoring; cache misses or large bundle = slow first paint on
mobile. CDN absence shows on phone networks. Forces us to build static
asset serving + invalidation. Frontend deploys become "rsync + nginx
reload."

### Option C — Hybrid (chosen)

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost (v0) | $0 incremental (Vercel free, droplet existing) |
| Scalability | Frontend infinite (Vercel global edge); backend bounded but adequate |
| Team familiarity | High on backend side; new on Vercel side (one-off setup) |
| Time to first deploy | ~1.5 hours backend + ~1 hour Vercel setup |
| Data location | App + data in-house; static frontend on Vercel CDN |

**Pros:** Best frontend performance for Captain on mobile (Vercel CDN
beats anything we'd self-host). Backend + data stay in Pita Bros
infrastructure. Matches existing deploy patterns on the droplet. Free at
this scale.

**Cons:** Two deploy surfaces to manage. Vercel adds one vendor for the
frontend layer (low-risk: it's just static files).

## Trade-off Analysis

The decisive factor is **frontend speed on a Captain's phone**, not cost.
A Captain entering 18 stock counts in a wet kitchen with one hand needs
the screen to load in <2 seconds on a 4G connection in central Warsaw.
Self-hosting from a 1-CPU droplet doesn't deliver that; Vercel does.

The second decisive factor is **production continuity**. The droplet's
OpenClaw runs 24/7 monitoring delivery platforms. Anything we add must
stay strictly within its memory budget (200 MB hard limit on Supply OS)
and routing config (one extra Caddy block, no changes to existing
blocks). The hybrid approach lets us add the backend without touching
existing Caddy routes for OpenClaw.

Railway-only (Option A) was the fastest path but loses the in-house
production posture that Pita Bros has built. Migration story from
Railway to droplet later would re-do half this work. Option C does it
right the first time.

## Consequences

**Becomes easier:**
- Frontend deploys: `vercel` from a git push. No box maintenance.
- Frontend rollback: one click in Vercel.
- Multi-region performance for Captain: CDN gives Wola the same speed as
  if Captain were in Lisbon or Tallinn (relevant for future locations).
- Backend introspection: same `journalctl`, same `systemctl status`,
  same logging patterns the team already uses for OpenClaw.

**Becomes harder:**
- Frontend ↔ backend wiring needs explicit CORS config + env var
  (`NEXT_PUBLIC_API_URL`). One-time setup, then it's fine.
- Two deploys to coordinate when changing API shape: bump backend, then
  frontend. Not hard, but a discipline thing.
- nip.io subdomain isn't pretty — users see `supply.46-101-213-61.nip.io`
  in the URL bar. Acceptable for v0 internal pilot; replace in Phase 1.5.

**Will need to revisit:**
- When pilot grows beyond Wola, the droplet's 1 GB RAM may need to
  become 2 GB. Decision triggered by: `MemoryMax=200M` hit consistently,
  OR sustained swap > 1.5 GB.
- When Phase 2 adds receiving + WZ photos: Sheets won't hold image
  blobs; either move data to Supabase or add a separate Drive/S3 for
  files.
- Domain migration: when user is ready to expose a subdomain,
  swap one line in Caddyfile + one DNS A record. <5 min change.

## Action Items

1. [x] Snapshot droplet (`pre-supply-os-deploy-2026-05-22`) — user
       confirmed done.
2. [x] Approve nip.io subdomain for v0 — user confirmed.
3. [ ] Run pre-deploy probes (see [PRE_DEPLOY_REVIEW.md](PRE_DEPLOY_REVIEW.md)):
       verify `host.docker.internal` resolves inside Caddy, verify port
       8001 free, verify free RAM ≥ 200 MB after our service.
4. [ ] Execute Steps 1–6 of [DROPLET_DEPLOY_RUNBOOK.md](DROPLET_DEPLOY_RUNBOOK.md).
5. [ ] Magic Patterns → React build → Vercel deploy → wire
       `NEXT_PUBLIC_API_URL=https://supply.46-101-213-61.nip.io`.
6. [ ] Add CORS origin to droplet `.env` once Vercel URL is final.
7. [ ] Phase 1.5: implement write endpoints + Sheets adapter (separate
       slice).

## Related

- [BRIEF.md](BRIEF.md) — what we're building and why.
- [DATA_MODEL.md](DATA_MODEL.md) — 7-table schema.
- [DROPLET_DEPLOY_RUNBOOK.md](DROPLET_DEPLOY_RUNBOOK.md) — execution steps.
- [PRE_DEPLOY_REVIEW.md](PRE_DEPLOY_REVIEW.md) — gaps found in this review.
- [PREMIUM_SERVICES_FIT.md](PREMIUM_SERVICES_FIT.md) — why Vercel + Railway
  alternatives, why Supabase deferred to Phase 2.
- [REMOTE_RUNTIME_STATE.md](../../docs/REMOTE_RUNTIME_STATE.md) — droplet
  recon findings.
