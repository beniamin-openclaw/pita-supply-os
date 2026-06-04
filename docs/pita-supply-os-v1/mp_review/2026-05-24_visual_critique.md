# MP Captain UI — Visual & UX Critique

Date: 2026-05-24
Source: Magic Patterns generated zip (id `ea09d61c-8332-47a4-b619-4c1bb324afec`)
Reviewer: general-purpose sub-agent (Claude)
Files reviewed: `/tmp/mp_captain/src/src/{pages,components,lib}/*`

## 1. Visual hierarchy

**[HIGH] CRITICAL pill is too small to be "scream-loud."** `text-[10px]` + `px-2 py-0.5` on `bg-red-100` against red-100 wash makes it almost a whisper next to the title. Spec calls it "CRITICAL pill" — at-a-glance, a Captain under time pressure needs to see this from across the kitchen.
- **Fix:** bump to `text-xs font-extrabold tracking-widest px-2.5 py-1`, use solid `bg-red-600 text-white` (matching `block` token `#b3261e`), and add a leading `!` glyph or `AlertOctagon` icon. Move it to a fixed top-right anchor so it's never wrapped under the title.

**[HIGH] Tag pill color clashes with left-border vocabulary.** Spec token table (line 64-67) defines specific hex pairs (`state-block: #b3261e on #fde7e7`). MP uses Tailwind `red-100` / `red-800` which are close but not matched. More importantly, the pill is a low-contrast `text-xs` murmur at the bottom of the card — yet it carries the entire reason-status meaning ("powód podany" vs. "wymagany powód"). It should be the **dominant** signal, not the smallest.
- **Fix:** raise pill to `text-sm font-semibold`, use the spec hex pairs, and place it directly under the title row, not under the inputs.

**[MEDIUM] 4-state vocabulary works but lacks the "wash" half.** Spec says each state is "left border + soft wash → white." MP only colors the 4 px left border; the card body stays white. From thumb-distance the cards are visually indistinguishable until the eye finds the tiny pill.
- **Fix:** add a `bg-{color}-50/40` wash on the whole card (or at least on the header strip), matching `#fde7e7` / `#fff8e1` / `#fdf0e0` / `#e8f5e9` from spec.

**[LOW] Suggested cell is too quiet.** The dashed grey middle column reads as "disabled" rather than "this is the system's recommendation." A Captain may not realize that's the reference value the deviation is measured against.
- **Fix:** label it `SUGESTIA SYSTEMU` (full word) and tint its background a soft blue (`bg-blue-50`) so it visually anchors the row as the canonical number.

## 2. Mobile UX

**[HIGH] Numeric inputs are short.** `py-2` on a `text-[16px]` input lands around ~38–40 px tall — below the 44 px touch-target floor that the spec explicitly mandates.
- **Fix:** `py-3` (≈48 px) on both inputs.

**[MEDIUM] Header pill row will wrap on iPhone SE.** Three `px-2.5 py-1` pills + emoji at `text-xs` plus a long location name + 8-char token will wrap. Wrapping in the sticky header eats vertical space the product list needs.
- **Fix:** truncate token to 4 chars, drop the `📍`/`👤`/`📅` emoji (or replace with lucide-react icons that scale better), and let the row scroll-x instead of wrap.

**[MEDIUM] SupplierPicker chips: 32 px tall.** `px-4 py-2` + `text-sm` ≈ 36–38 px, again under 44 px. Mobile chips that are also a primary nav target should be `py-3`.

**[LOW] No haptic / visual feedback on submit.** A "Submit" tap in a noisy kitchen needs strong feedback. Currently only the text changes to "Wysyłanie..." with no spinner.
- **Fix:** add a `Loader2` spinner and disable the entire bar visually, not just opacity.

**[NOTE] iOS zoom prevention is correctly handled** — inputs are `text-[16px]`. Good.

## 3. Cognitive load

**[HIGH] "Brakuje X kg" math hint is microscopic and italic.** `text-[9px] italic` is unreadable in a kitchen with steam on the screen. Spec example was `"need 27 kg → 6 kartony"` — that's a *teaching* moment for the Captain ("here's why I suggest 6"). At 9 px it's hidden.
- **Fix:** `text-xs` (not 9 px), drop italics, and use the spec format with arrow: `27 kg → 6 kartony`.

**[MEDIUM] Reason picker shows comment field for *every* reason as "Optional."** Spec says comment is only required for `OTHER`; MP shows it for all 7 codes after selection. This adds friction where spec wanted none.
- **Fix:** show comment field only when `OTHER` is selected (or hide behind a "Dodaj komentarz" disclosure for other codes).

**[LOW] "Drobna korekta" yellow state has no quantitative hint.** Captain sees yellow + "Drobna korekta" but doesn't know if she's at +3% or +18%. Spec model is "info: 5–20%, no reason needed" — show the % so she can self-correct toward green if she wants.
- **Fix:** include `+12%` in the yellow pill copy.

## 4. Microcopy (Polish)

**[BLOCKER] Sticky action bar is in English.** `"6 lines · 2 deviations · 1 reasons"`, `"Fix red cards to submit"`, `"Ready to submit"`, `"Draft"`, `"Submit"` — all English. This is the *primary CTA area*. Spec explicitly says Polish UI.
- **Fix:** `"6 pozycji · 2 odchylenia · 1 powód"`, `"Popraw czerwone karty"`, `"Gotowe do wysyłki"`, `"Szkic"`, `"Wyślij"`.

**[BLOCKER] Empty-stock confirmation is in English.** `"Stock is at target / No order needed today"`.
- **Fix:** `"Stan magazynowy zgodny z targetem"` / `"Dzisiaj nie trzeba zamawiać"`.

**[HIGH] ContextStrip: `"3 days delivery"` is English.** Polish should be `"3 dni dostawy"` or `"dostawa: 3 dni"`.

**[HIGH] Cutoff display likely English-leaning.** Spec example `"⏰ Submit by today 14:00"` — should be `"⏰ Wyślij do dziś 14:00"`.

**[HIGH] `window.confirm("Resume draft from ...")` is English.** Plus `window.confirm` is a hideous native modal — use an in-app banner per spec.

**[MEDIUM] "Critical" pill says English `Critical`.** Should be `KRYTYCZNY` or `WAŻNY`.

## 5. Error / empty / loading

**[MEDIUM] No 401 handling visible in Captain.tsx.** Spec line 263: "On any 401, clear localStorage and re-show the modal." MP's `apiClient.ts` does dispatch the event, but `Captain.tsx` doesn't re-mount AuthModal. (Our integration replaces with AuthGate which handles this.)

**[MEDIUM] "All zero" empty state only renders when *every* line has both inputs filled.** Fragile guard.

**[LOW] Skeleton card doesn't include left border accent.** Layout shift when real cards load.

**[LOW] No error boundary.** A render crash in one ProductCard kills the whole list.

## 6. Spec compliance

**[MEDIUM] Supplier picker `lineCounts` mocked to 5 for non-active suppliers** (`Captain.tsx:213`). Will show every supplier including ones with no products. Real bug.

**[MEDIUM] ContextStrip cutoff: always red.** Spec implies urgency-based color (< 1h red, < 6h orange).

**[LOW] Reason `OTHER` validation half-done.** Picker labels "Wymagany" but doesn't block submit if empty.

## 7. Visual polish

**[MEDIUM] Inconsistent corner radii.** Cards `rounded-xl`, inputs `rounded-lg`, pills `rounded` or `rounded-full`. Pick a scale.

**[MEDIUM] No micro-animations.** Card border-color transition on state change is instant.

**[MEDIUM] `border-l-4` + `border border-gray-200` creates visible seam.**

**[LOW] Hamburger menu in Header is a no-op button.**

## Top 5 fixes ranked

1. Translate StickyActionBar + empty state to Polish (BLOCKER, 15 min).
2. CRITICAL pill: make it the loudest element on the card (HIGH, 10 min).
3. Bump input + chip heights to ≥44 px (HIGH, 10 min).
4. Add card-body wash matching 4-state vocabulary (HIGH, 30 min).
5. Fix supplier picker: stop mocking lineCounts (MEDIUM, 30 min).
