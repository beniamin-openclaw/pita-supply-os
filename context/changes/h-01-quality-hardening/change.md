---
change_id: h-01-quality-hardening
title: "Quality hardening (parallel-safe): backend lockfile, CI proof, thicker ruff"
status: implementing
created: 2026-06-23
updated: 2026-06-23
archived_at: null
---

## Notes

Parallel-safe subset of roadmap **H-01 (quality-hardening)**. Touches ONLY
tooling/CI/config, never product code, so it can run alongside the in-flight
change `demo-blocker-decimals-save` (branch `claude/exciting-curie-e20933`).

**In scope:**
1. **Backend dependency lockfile** for `supply-os-v1` — none today; `pyproject.toml`
   + `requirements.txt` use `>=` ranges. Railpack installs from `requirements.txt`,
   so the lock mechanism must keep that working (decision pip-tools vs uv to be
   justified in plan). Closes `health-check.md` Fix #3.
2. **Harden the product CI gate.** Grounding finding: `ci.yml` ALREADY runs
   `supply-os-v1` ruff+pytest (+ a real-Postgres integration job) and `frontend`
   build+lint+vitest — the `lessons.md` "quality-gate.yml ran sibling tooling" gap
   is already closed (that file no longer exists in this repo). So this narrows to
   (a) proving the gate green and (b) wiring the backend job to install from the new
   lockfile for byte-reproducible builds.
3. **Thicker ruff ruleset** for `supply-os-v1`, limited to rule families that pass
   cleanly with NO product-code changes (real code fixes deferred). Closes
   `health-check.md` Fix #5 (and #6 formatter, to assess).

**Deferred (out of scope — collides with demo-blocker):** TypeScript `strict` in
`tsconfig.app.json` + mypy/pyright in CI. They would light up type errors in files
the demo-blocker is editing. Record as a deferred phase to run AFTER
`demo-blocker-decimals-save` merges to `main`. This change therefore delivers a
*partial* H-01; the deferred phase completes it.

**Hard constraints:**
- Do NOT edit the demo-blocker's in-flight product files: `ProductCard.tsx`,
  `components/DecimalInput.tsx`, `lib/number.ts`, `lib/compute.ts`,
  `lib/buildPayloadLines.ts`, `InventoryCountPage.tsx`, `ReceiptLineCard.tsx`,
  `ReceiveDeliveryPage.tsx`, `manager/OrderLineTable.tsx`, `captain-mp/types.ts`;
  nor `context/changes/demo-blocker-decimals-save/`.
- No secrets in commits (only `.env.example`).
- All backend persistence stays behind `_choose_backend()`.
- Toolchain: Homebrew node (`PATH=/opt/homebrew/bin:$PATH`) for frontend; backend
  via `/opt/homebrew/bin/python3 -m ruff|pytest`. conftest forces seed backend +
  blanks creds — must not break.

Refs: `health-check.md` Fix #3 (lockfile), #5 (ruff), #6 (formatter); roadmap H-01.
