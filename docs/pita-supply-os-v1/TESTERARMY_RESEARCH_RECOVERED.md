# TesterArmy — recovered deep-research (2026-05-30)

> **Status: recovered, not fully synthesized.** A `deep-research` workflow
> (`wf_3687c963-41b`, 100 agents, ~2.9M tokens) ran Scope → Search → Fetch →
> Verify and was **aborted by `/compact` before the final synthesis step wrote
> its report**. The verified claims below were recovered from the workflow logs;
> the source URLs from the agent transcripts. Claim *headlines* are intact;
> full per-claim citations live in the workflow transcripts if we need them
> later. Treat confidence as "research-grade but not personally re-verified this
> turn." A clean re-run or direct doc read is cheap when we pick this back up.

## TL;DR for our questions

- **Can Claude connect programmatically? → Yes.** TesterArmy exposes a public
  **REST API** (api-key / Bearer auth) and an official **CLI (`ta`, npm
  `testerarmy`)** with an "agentic usage" doc aimed at exactly this — an AI
  agent creating tests, triggering runs, reading results. There is also a
  **Claude Code plugin/marketplace entry** in their repo.
- **MCP server? → Probably yes, flagged uncertain.** The adversarial verifier
  *refuted* "official MCP server" 3×, **but** the docs crawl repeatedly hit
  `https://docs.tester.army/_mcp/server` (the standard hosted-MCP path) plus an
  `agentic-usage` CLI doc. Adversarial verifiers default to "refuted" when they
  can't *confirm* from an authoritative sentence — that is not the same as
  "absent." **Action: read `docs.tester.army/_mcp/server` directly before
  concluding.**
- **Triggers → PR / deploy / manual.** PR testing via a **GitHub app**; a
  documented **Vercel integration**; webhooks; manual runs.
- **Auth in tests → Test Accounts + credentials store + agent mail inboxes.**
  Suitable for our Bearer-token-in-a-modal pattern, **with a caveat**: stored
  credentials are transmitted to third-party services (see security note).
- **It is AI-driven web (and mobile) test automation**, not human crowd-testing,
  in the product we're looking at.

## Verified claims (3-vote adversarial; ✓ = confirmed, ✗ = refuted/abstained)

| Claim (headline) | Verdict |
|---|---|
| AI-powered / AI-driven web testing platform | ✓ 3-0 |
| Public REST API, Bearer/api-key auth, CRUD | ✓ 3-0 |
| External AI agent w/ api-key can drive it programmatically | ✓ 3-0 |
| Official CLI `ta` (npm), api-key from dashboard | ✓ 3-0 / 2-0 |
| Repo includes a Claude Code plugin/marketplace entry | ✓ 3-0 |
| Runs trigger on PR/deploy (GitHub); auto PR runs from Vercel | ✓ 3-0 |
| PR testing requires installing a TesterArmy GitHub app | ✓ 3-0 |
| Test Accounts store login credentials (user/pass) | ✓ 3-0 |
| Supports HTTP Basic Auth for staging/preview | ✓ 3-0 |
| Stored credentials transmitted to third-party services | ✓ 3-0 ⚠️ |
| Disclaims warranty that tests catch all bugs | ✓ 3-0 |
| **Official MCP server** | ✗ 0-3 — **but see TL;DR; likely yes** |
| "AI generates steps from natural language" (specific wording) | ✗ abstain (couldn't confirm phrasing) |

## Sources consulted (real URLs from the crawl — re-verify on revisit)

Official docs/product:
- `https://tester.army/` · `/pricing` · `/docs/get-started/quick-start`
- `https://docs.tester.army/` · `/get-started/quick-start`
- `https://docs.tester.army/_mcp/server`  ← MCP endpoint (check this first)
- `https://docs.tester.army/openapi.json` · `/openapi.yaml`  ← API spec
- `https://docs.tester.army/cli/agentic-usage.md`  ← AI-agent driving
- `https://docs.tester.army/auth/api-keys.md` · `/auth/credentials.md` · `/auth/agent-mail-inboxes.md`
- `https://docs.tester.army/run/pull-request-testing.md`
- `https://docs.tester.army/integrations/vercel.md`  ← our deploy path
- `https://docs.tester.army/llms.txt` · `/llms-full.txt`  ← LLM-friendly docs
- API/webhook endpoints seen: `https://tester.army/api/v1/runs`, `…/api/v1/groups/webhook/`, `…/v1/webhook/`

Tooling:
- `https://github.com/tester-army/cli` · `https://www.npmjs.com/package/testerarmy`

Comparison/alternatives (for the alternatives question):
- QA Wolf "best AI testing tools 2026" roundup · Octomind MCP product page
- (Playwright / Cypress / Reflect / Checkly referenced as comparators)

## Security note (carry into any config)

Stored website credentials are transmitted to third-party services, and
TesterArmy disclaims warranty. **Do not store the real production WOLA captain
token there.** If we proceed: mint a **dedicated, low-privilege test token /
test location** so a leak can't touch real orders, and rotate it.

## Next step when we revisit (user said "jak wrócę")

1. Read `docs.tester.army/_mcp/server` + `openapi.json` + `cli/agentic-usage.md`
   directly to settle the MCP question and confirm the API surface.
2. Decide: drive via MCP, REST API, or CLI from a Claude skill — vs Playwright.
3. If proceeding: create a throwaway test token, wire 2 flows (Captain happy
   path + Manager claim→order), trigger on Vercel deploy.
