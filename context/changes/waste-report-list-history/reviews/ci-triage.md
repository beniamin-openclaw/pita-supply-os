# PR CI and advisory review triage

PR84 initial head `1227333`: backend and real-Postgres jobs passed; frontend jobs in runs41928193520/41928249972 failed on a retry test. Root and a separate fix agent confirmed the test queried an already-rendered disabled button before the save finalizer cleared busy. Await enabled before clicking, including analogous readback/new-entry controls. No application change, assertion removal or timeout increase. Focused14 and full1330tests pass after the correction; final PR checks remain the remote merge gate.

The AI action completed successfully but its comment6644120606 returned advisory **FAIL**. The action explicitly reported that the diff exceeded its size cap and only the head was reviewed. This is not a complete application review or a human sign-off. Disposition:

- Application absent from supplied diff: the actual PR contains backend/frontend changes; the review input was truncated to alphabetically earlier context files. Preserve the complete PR and separate full-diff plan/safety reviews rather than claiming the advisory approved unseen code.
- Schema ahead of application: explicit migration-only approval and verified additive transaction are recorded. Keep both tables/data if merge is deferred/rejected. Read-only Railway deployment history confirms the old successful build still uses main `02a0930`; no application release was inferred.
- Unbounded calibration DP: accepted and fixed. GCD-normalized arithmetic supports only the exact reviewed tile systems, rejects unsupported systems and uses no quantity-sized array/loop. Eight tests include a safe red→green enormous reachable value. All private30report/17product aggregates match exactly after recomputation.
- Absolute private evidence paths: retained as local audit pointers, without source payloads, source IDs, access-bearing URLs or credentials. They are environment details, not portable evidence or externally accessible links.
- Approvals recorded by the branch author: the two actual reviewers were separate read-only subagents, with private reports and independently executed35/20tests. No external-human/GitHub-account approval is claimed. Ben remains the merge decision owner.

No AI workflow, review threshold or CI gate was changed to obtain a pass. A later advisory on a capped diff may retain coverage limitations; assess new actionable findings against the whole source. Product CI must pass for the final head before handoff.
