# Follow-ups (deferred, owner-approved)

## AuthGate logo reveal not visibly playing (deferred 2026-06-08)

Owner reviewed the preview: logo size now good, but the fade+scale reveal did not
visibly play. Agreed to ship Phase 3 and refine the animation later.

**Likely causes (one or both):**
1. **Reviewer's OS "Reduce Motion" is ON** — then no-animation is the *correct*
   behavior (the global `prefers-reduced-motion` reset collapses it; satisfies
   plan SC 3.4). Verify the reviewer's setting before treating it as a bug.
2. **Async image load race** — the logo is a 57 KB `<img src>` (Logo.tsx). The CSS
   `.logo-reveal` animation starts on mount, but the SVG paints only after it
   finishes loading; if load > 0.9s the animation runs on an unpainted element and
   is never seen.

**Fix options for later:**
- Start the reveal on the image's `onLoad` (add the `logo-reveal` class only once
  loaded), OR
- Inline the SVG (paints immediately — but ~57 KB in the JS bundle), OR
- `<link rel="preload" as="image">` the logo so it's cached before the modal mounts.
Recommended: `onLoad`-gated reveal (cheapest, keeps the asset external).

**Status:** plan SC 3.3 / 3.4 left unchecked (unverified) pending this refinement.
Logo size + brand button + backdrop + copy (3.5) are confirmed.
