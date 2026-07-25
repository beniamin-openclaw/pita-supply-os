# Model Council Report

## Verdict and one-sentence rationale
`INCOMPLETE_COUNCIL` — Required roles or diversity invariants failed; approval is blocked.

## Original and final SHA-256 integrity result
result=PASS
before=`bebbd6f44cb863a983ee31a506dbb7b2d575b2274818b9e794602e0902f2f4df`
after=`bebbd6f44cb863a983ee31a506dbb7b2d575b2274818b9e794602e0902f2f4df`

## Grounding report
plan_sha256=`bebbd6f44cb863a983ee31a506dbb7b2d575b2274818b9e794602e0902f2f4df`
grounded_findings=0
required_role_failures=['architecture_feasibility:malformed', 'adversarial_risk:empty', 'diversity:insufficient_exact_reviewers', 'diversity:missing_independent_judge']

## Accepted findings
None

## Rejected or CANNOT_VERIFY findings
None

## Hardened-plan changelog
Hardened copy: `plan-council-hardened.md`
Findings considered: 0

## Dissent log
None

## Auto-answer ledger
Not enabled

## Owner questions
None

## Runner/model evidence and failures
- architecture_feasibility round=1 status=malformed model=claude-opus-4-8 error=malformed
- adversarial_risk round=1 status=empty model=gemini-3.6-flash-high error=empty

## Paid fallback disclosures
None

## Preflight status
NEEDS_CONFIRMATION

## Recommended next step
Do not implement automatically. Treat council output as advisory and require an explicit owner execution decision.

## Snapshot evidence
snapshot_sha256=`9e024a8f3828f818862515d5e3354b639a9e82faa464761a97c20a04db1ff31e`

## Diversity evidence
{"chairman_provider_family": "anthropic", "exact_models": [], "independent_judge": false, "judge": null, "reviewer_identities": ["exact:claude-opus-4-8", "exact:gemini-3.6-flash-high"], "valid_exact_reviewers": 0, "valid_reviewer_roles": []}

## Usage evidence
- adversarial_risk: model=gemini-3.6-flash-high route=subscription_quota tokens(raw/cache/out)=None/None/None cost=None source=CANNOT_VERIFY
- architecture_feasibility: model=claude-opus-4-8 route=subscription_quota tokens(raw/cache/out)=None/None/None cost=None source=CANNOT_VERIFY
