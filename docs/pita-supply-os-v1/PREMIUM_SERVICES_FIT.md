# Premium Services — Fit for Pita Bros Supply OS v1

Of the services you have premium access to via Lenny's newsletter, here is
which to actually use for v0 and which to defer or skip. The principle:
prefer services that save **build time** over services that add **process
overhead**.

---

## ✅ Use for the v0 build (the actual product)

### Magic Patterns — UI generation from prompts
**Use it.** Feed it the Captain Submit + Manager Dashboard mockups + the
seed CSVs and have it generate the working React/HTML components. Expected
gain: 1–2 days of UI build collapsed to a few hours of prompt iteration.
Where it falls short: the suggestion-calculation logic and Sheet
integration — those we write ourselves.

### Railway — backend hosting
**Use it.** Host a small FastAPI app + Postgres (or even no Postgres if we
go Sheet-only). Beats Mac Mini + Cloudflare Tunnel for speed-to-launch:
no firewall rules, automatic HTTPS, env vars in UI, deploys in 60 seconds.
Move back to Mac Mini in Phase 2 if we want everything in-house.

### Replit — fallback if Railway resists
**Alternative.** Use if Railway feels heavy. Replit is all-in-one (editor +
host + db) and good for prototype-grade apps with one user. Less polished
for production traffic.

### Warp — terminal
**Use it (already do).** Day-to-day dev tool.

### Wispr Flow (Flow) — voice dictation
**Use in Phase 1.5.** Big idea for kitchen UX: Captain says "Halloumi
dwa i pół" → app fills 2.5 kg in the Halloumi stock field. Hands stay
clean, count goes faster. Pilot with one Captain after v0 stabilizes.

---

## ✅ Use for v0 operations (measure + automate)

### PostHog — product analytics
**Use it from day one.** Instrument:
- Captain submit time (start of stock entry → submit)
- Manager dispatch time (open queue → click Send)
- % of orders with all reasons captured
- Adoption: orders submitted per Captain per week
- Drop-off: orders started but not submitted

Adoption is the v0 success metric. PostHog is the cheapest, most honest
way to measure it. Self-hostable too if you want full data control later.

### Gumloop — workflow automation
**Use in Phase 1.5.** Two strong fits:
1. **Gmail-draft → send polish.** After Manager clicks Send, Gumloop can
   take the draft, format the table, attach a PDF copy, BCC the office.
2. **Sheet sync watchdog.** Watch the Google Sheet for `manager_sent`
   status changes and post a Slack notification to the office channel.

Don't use Gumloop until v0 manual flow is proven — automation on a broken
flow just hides the problem.

### Happy Scribe — meeting notes / transcription
**Use it for Captain interviews + pilot retros.** When you sit with the
Wola Captain to validate the Wzór min/max, Happy Scribe captures the
audio and transcribes Polish well (Granola handled Polish poorly — Happy
Scribe replaces it for this project's needs). Claude can ingest the
transcript later (paste as markdown into a session).

---

## ✅ Use for project management (lightweight)

### Linear — issue tracking
**Use it once we start building.** Migrate the open decisions from
README.md to a Linear project. Single-user Linear is fine; it gets useful
when Manager Bro / Office Bro join as collaborators.

### ChatPRD — formal PRD generation
**Use it if/when you need a polished spec for a stakeholder.** Our
[BRIEF.md](BRIEF.md) is the working spec; ChatPRD can produce a board-
or investor-friendly version on demand. Don't use it as the day-to-day
source of truth — repo docs are.

---

## 🔶 Defer to Phase 2+

### Factory — autonomous coding agent
**Defer.** Could help with bigger refactors / multi-file work in Phase 2.
For v0, Claude + Magic Patterns is enough.

### Mobbin — design pattern library
**Browse, don't workflow-block.** Useful when designing new screens (e.g.,
the Receiving / WZ screen in Phase 2). Not needed for v0.

### Notion — docs / wiki
**Skip for repo-based docs.** Our docs live in the repo (`docs/pita-supply-os-v1/`)
and are agent-readable. Notion would duplicate. Only switch if the team
needs a less-technical surface for non-coders.

### Manus — autonomous research agent
**Defer.** Could help with Phase 4 market/competitor research (price
variance vs market, supplier alternative analysis). Not v0.

### Framer — design + landing pages
**Defer.** If we want a public-facing "what is Supply OS at Pita Bros"
page for staff onboarding / recruitment, Framer is the right tool.
Not the app itself — interactivity is limited compared to a real React
build.

---

## ❌ Not a fit for v0

### Intercom — customer messaging
**Skip.** We're not building a customer-facing product. If we add an
in-app "report a problem" channel for Captains in Phase 2, revisit — but
even then, a Slack webhook is simpler.

---

## Recommended v0 stack — concrete picks

If you want one paragraph to take to the team:

> **Build:** Magic Patterns generates the UI from the mockups + seed CSVs.
> Backend is FastAPI on Railway, reads/writes a single Google Sheet via
> service account (no Postgres needed for v0). Frontend on Vercel or
> Cloudflare Pages, free tier. **Measure:** PostHog instrumented from day
> one, four core events (submit started / submitted / dispatched / sent).
> **Coordinate:** Linear for tasks once the build starts, Happy Scribe for
> Captain interviews + pilot retros (Polish transcription quality).
> **Defer:** voice input (Wispr Flow Phase 1.5),
> workflow automation (Gumloop Phase 1.5), everything else until v0
> proves out.

---

## Service-to-phase map

| Service        | Phase | Role                                  |
|----------------|-------|---------------------------------------|
| Magic Patterns | 1     | UI generation (Captain + Manager screens) |
| Railway        | 1     | Backend hosting                       |
| PostHog        | 1     | Adoption + usage instrumentation      |
| Linear         | 1     | Task tracking once team > 1           |
| Happy Scribe   | 1     | Captain interview + pilot retro transcripts (Polish) |
| Warp           | 1     | Dev terminal                          |
| ChatPRD        | 1 (ad hoc) | Stakeholder-facing PRD            |
| Wispr Flow     | 1.5   | Voice-driven stock entry pilot        |
| Gumloop        | 1.5   | Gmail draft polish + Slack sync       |
| Mobbin         | 2     | Design ref for Receiving / WZ screens |
| Framer         | 2     | Staff-facing landing / onboarding     |
| Factory        | 2     | Multi-file refactors                  |
| Manus          | 4     | Supplier market research              |
| Notion         | —     | Skip — repo-based docs cover this     |
| Intercom       | —     | Not a fit                             |
| Replit         | 1 (fallback) | If Railway resists              |
