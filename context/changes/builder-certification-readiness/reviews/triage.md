# Triage of impl-review findings — 2026-09-13

Source: `reviews/impl-review.md` (verdict SHIP-WITH-FIXES, no HIGH). Fix commit: `bd72a5b`.

| # | Sev | Finding | Outcome |
|---|-----|---------|---------|
| F1 | MED | `ci-cd-code-review/reviews/` empty, step 4.6 unticked | **Fixed** — `ci-cd-code-review/reviews/impl-review.md` written, 4.6 ticked, change status `impl_reviewed` |
| F2 | MED | `AGENTS.md:35` "no host preference set yet" | **Fixed** — hosting decided, pointer to infrastructure.md |
| F3 | MED | README archive count 45 vs 54 | **Fixed** — 54 |
| F4 | MED | `max_tokens 4000` shared with reasoning → truncation risk | **Fixed** — 16 000 + `reasoning.exclude` + `finish_reason` check + test |
| F5 | LOW | `--paginate --jq` one id per page | **Fixed** — `--slurp` |
| F6 | LOW | test-plan: word count, code symbol in guidance, wrong constant name, no `interview Q<n>` | **Partially fixed** — symbol removed, constants corrected. Word count kept: the mandated tables (risk map, response guidance, stack, gates) exceed the 300–600 guideline by construction. `interview Q<n>` not used: the operator's answers were decisions (finance out of scope, minimal scope), cited as "interview 2026-09-12" in §7 — inventing numbered interview questions would be fabrication. |
| F7 | LOW | health-check item numbering; roadmap says lessons has 7 entries | **Fixed** |
| F8 | LOW | port 8901 vs 8931; README silent on ai-review.yml; eBiuro key not blanked | **Fixed** port note + eBiuro blank. README mention of `ai-review.yml`: **dismissed** — README describes the product CI; the advisory workflow is documented in its change folder and the PR, and the Champion form points there. |
| F9 | LOW | `.gitignore` ignores all of `analysis/` (plan said `raw/`); `supplier-per-location` → `blocked` unrecorded | **Recorded here** — both deliberate: the whole analysis folder holds confidential purchase data; `blocked` reflects the operator decision the lane waits on. |
