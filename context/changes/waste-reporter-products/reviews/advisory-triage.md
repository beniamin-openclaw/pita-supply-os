# Hosted advisory review triage

The DeepSeek advisory on PR 85 returned PASS but explicitly reviewed a truncated diff. It is not a substitute for the two complete independent reviews or real E2E.

- Request-derived response helpers: retain the small UI-state helpers. They do not independently prove server contract behavior; the real authenticated browser/Postgres save, exact SQL snapshots, by-batch recovery and UI CSV provide that evidence. Separate response-mismatch tests reject changed reporter/source fields. No application defect was demonstrated by this advisory.
- Duplicate client/server message text: retain separate keys within the existing error-code mapping convention. Both current translations agree; no new abstraction is justified.
- Absolute private evidence paths: retain explicit provenance, label artifacts private/machine-local, and do not present them as shared CI evidence. User instructions require absolute local file references. No secrets or production personal report contents are included.
- Compressed documentation spacing: rewritten the concrete operator release proposal in readable English without changing scope, approval, facts or recovery decisions. Stable completed plan criteria and reviewer-authored provenance remain unchanged.
- No full backup and rollback reader limitation: made approval's coverage of the stated limitation explicit in the release proposal. Keep transactional DDL/row fingerprints and a data-preserving forward patch or pre-waste feature withdrawal. No automatic destructive rollback or unsolicited backup process added.

These are advisory triage decisions under the user's autonomous E2E authorization. Production remains unmodified; exact migration/application approval is still required by AGENTS.
