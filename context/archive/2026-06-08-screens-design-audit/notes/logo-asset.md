# Logo asset (for Phase 3 — AuthGate logo animation)

**Real logo SVG provided by owner (2026-06-08):**

```
/Users/ben/Library/Mobile Documents/com~apple~CloudDocs/Marketing Pita Bros/Logo/pita bros  blue1/pita bros  blue1.svg
```

- Phase 3 builds the AuthGate draw-on animation on a **placeholder** first; swap this real SVG in when implementing.
- iCloud path — copy the file into the repo (e.g. `frontend/src/assets/`) during implementation so the build doesn't depend on an iCloud mount.
- Filename has double spaces (`pita bros  blue1`) — quote the path.
- Draw-on uses `stroke-dasharray`/`stroke-dashoffset`; the SVG must expose path strokes (a filled-only logo may need a stroke variant or a fade+scale fallback).
