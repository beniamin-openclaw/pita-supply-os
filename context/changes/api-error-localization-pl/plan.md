# Localize FastAPI 422 validation errors to Polish in the UI

## Overview

After `manager-queue-ux` killed the `[object Object]` 422 rendering, the error *detail* still surfaces raw English Pydantic text under the PL prefix (e.g. "Błąd wysyłania: lines: List should have at least 1 item after validation, not 0"). This change maps the **Pydantic error `type`** (+ `ctx`) of a 422 validation array to PL/EN i18n templates, localizing every error-display site at once by doing it where `ApiError.detail` is built (`apiClient`). Tier 1 = common form validations (required / min / max / list-min). Business-rule 400s (free-text English strings) stay English — Tier 2, needs backend error *codes*. Plus a small UI guard so the most common trigger (empty order) never reaches the backend.

Frontend-only. Copy lives in `src/i18n/` (AGENTS rule). Grounded 2026-06-17.

## Current State Analysis

- `apiClient.ts` `formatErrorDetail(payload, fallback)` turns a 422 `detail` array into `"<field>: <msg>"` using the **English** Pydantic `msg`; `request()` + `apiPostFormData()` throw `new ApiError(status, formatErrorDetail(payload, resp.statusText))`. Unit-tested in `apiClient.test.ts`.
- `e.detail` (that string) is consumed read-only at ~15 sites (`CaptainPage`, `ManagerPage`, `CaptainMP`, `OrderEditPage`, inventory/receipt/suggestion pages) — they display it verbatim. So localizing the string at the throw point fixes all of them.
- i18n (`src/i18n/index.ts`): `t()` is a hook (needs `<LangProvider>`); `STRINGS` + the `interpolate` rule are module-level. Language persists in `localStorage["supply_os_lang"]` via module-private `readStoredLang()` (default `pl`). `apiClient` is non-React, so it needs a **standalone** lang read + lookup.
- A FastAPI 422 entry carries `{type, loc, msg, ctx?}` — e.g. `type:"missing"`, `type:"too_short"` (`ctx.min_length`, for lists), `type:"greater_than_equal"` (`ctx.ge`), `string_too_short`, `too_long`, etc. The reported case is `type:"too_short"`, `loc:["body","lines"]`, `ctx.min_length:1`.
- The empty-order 422 is reachable: the submit button enables on `anyTouched` (any field typed), but `buildPayloadLines` drops rows without an order qty → a row with only stock typed yields 0 lines → backend 422.

## Desired End State

- A 422 *validation* error shows clean PL copy (in PL mode) — e.g. "Dodaj przynajmniej jedną pozycję do zamówienia.", "To pole jest wymagane.", "Wartość musi być ≥ 0." — at every site, with no code-change at the call sites.
- A business-rule 400 (string detail) is unchanged (English passes through; Tier 2).
- Submitting an order with 0 buildable lines is blocked at the UI with a localized message before any network call.
- EN mode yields the English equivalents; copy lives entirely in `src/i18n/`.

## What We're NOT Doing

- No backend change. Business-rule 400 messages (`captain_submit` etc.) stay free-text English — localizing them cleanly needs backend error *codes* (Tier 2, separate).
- No per-field PL dictionary beyond the handful of user-facing fields; unknown fields drop the field prefix (never surface a raw `snake_case` English field name).
- No change to the ~15 display call sites — they keep reading `e.detail`.
- No restyling of toasts/banners.

## Phase 1: Standalone localizer + i18n keys + apiClient wiring

### Changes Required

#### 1. Standalone lang reader

**File**: `frontend/src/i18n/index.ts`

**Contract**: Export `getStoredLang(): Lang` (wraps the existing `readStoredLang()`), so non-React modules can resolve the active language. No behavior change to the hook path.

#### 2. Validation-error localizer (pure)

**File**: `frontend/src/i18n/apiErrors.ts` (new)

**Contract**: `export function localizeValidationDetail(detail: unknown, lang: Lang): string | null`.
- Returns `null` unless `detail` is a non-empty **array** of objects each with a string `type` (the 422 validation shape) — so the caller falls back to the English `formatErrorDetail` for string details and unrecognized shapes.
- For each entry, derive the leaf field name from `loc` (last non-index segment, minus `body`/`query`/`path`) and map `type` (+ `ctx`) → an i18n key + vars via `STRINGS` + the shared `interpolate`:
  - `missing` / `value_error.missing` → `apiError.required`
  - `too_short` / `string_too_short` / `list_type`+min → `apiError.minItems` (vars `{min: ctx.min_length}`); special-case leaf `lines` → `apiError.orderEmpty` ("Dodaj przynajmniej jedną pozycję do zamówienia.")
  - `greater_than_equal` → `apiError.gte` (`{limit: ctx.ge}`); `greater_than` → `apiError.gt`
  - `less_than_equal` → `apiError.lte`; `less_than` → `apiError.lt`
  - `too_long` / `string_too_long` → `apiError.maxItems` (`{max: ctx.max_length}`)
  - default → `apiError.invalid`
  - Prefix a friendly PL/EN field label from a small known-field map (`lines`, `current_stock_qty_base`, `captain_final_qty_purchase`, `count_user`, `received_by`, `reason_code`, `requested_delivery_date`) when present; otherwise emit the bare type message (no raw field name).
- Join multiple entries with `; `. Pure (lang passed in), so unit-testable without `localStorage`.

#### 3. i18n keys

**File**: `frontend/src/i18n/strings.ts`

**Contract**: Add an `apiError.*` group (PL + EN): `required`, `minItems` (`{min}`), `maxItems` (`{max}`), `gte`/`gt`/`lte`/`lt` (`{limit}`), `invalid`, `orderEmpty`, and `field.<name>` labels for the known fields above (used as the `{field}` prefix). Follow the existing `STRINGS` shape.

#### 4. Wire into apiClient

**File**: `frontend/src/apiClient.ts`

**Contract**: In `request()` and `apiPostFormData()`, replace the throw with: compute `fallback = formatErrorDetail(payload, resp.statusText)`, then `throw new ApiError(resp.status, localizeValidationDetail((payload as {detail?: unknown})?.detail, getStoredLang()) ?? fallback)`. `formatErrorDetail` stays the exported English fallback (its tests unchanged).

#### 5. Unit tests

**File**: `frontend/src/i18n/apiErrors.test.ts` (new)

**Contract**: Cover `localizeValidationDetail` (lang passed explicitly): `lines` too_short→orderEmpty PL/EN; `missing`→required; `greater_than_equal` ge:0→gte; multi-entry join; unknown field → no raw English token; string detail / empty array / non-array → `null` (fallback path). Pattern: `apiClient.test.ts`.

### Success Criteria

#### Automated
- [ ] 1.1 `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run build`
- [ ] 1.2 `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run lint`
- [ ] 1.3 `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run test`

#### Manual (owner, on deploy)
- [ ] 1.4 Trigger a 422 (e.g. submit reaching the empty-lines case via API) → PL message, not English Pydantic text.

## Phase 2: UI guard — block empty-order submit before the network

### Changes Required

#### 1. Guard both order submit paths

**File**: `frontend/src/pages/captain-mp/CaptainMP.tsx`, `frontend/src/pages/captain-mp/OrderEditPage.tsx`

**Intent**: The most common 422 trigger (a row with only stock typed → 0 buildable lines) should be caught at the UI, not the backend.

**Contract**: In each `handleSubmit`, after `const payloadLines = buildPayloadLines(lines)`, if `payloadLines.length === 0` → show a localized error toast (`apiError.orderEmpty`) and `return` before calling `api.captainSubmit` / `api.captainOrderEdit`. No other behavior change.

### Success Criteria

#### Automated
- [ ] 2.1 build · 2.2 lint · 2.3 test (green)

#### Manual (owner, on deploy)
- [ ] 2.4 New order with a row that has only OBECNY STAN typed (no qty) → tap Wyślij → localized "dodaj pozycję" toast, no network 422.

## Migration Notes

None — frontend-only, additive. Revert = revert the phase commits.

## References

- Roadmap `## Parked` ("API error-message localization (PL)"); `manager-ux-feedback-backlog` memory.
- `frontend/src/apiClient.ts` (`formatErrorDetail`, `request`, `apiPostFormData`), `apiClient.test.ts`
- `frontend/src/i18n/index.ts` (`readStoredLang`, `STRINGS`, `interpolate`), `strings.ts`
- `frontend/src/pages/captain-mp/lib/buildPayloadLines.ts` (0-lines source)

## Progress

> `- [ ]` pending, `- [x]` done; append ` — <sha>` when a step lands.

### Phase 1: Localizer + i18n + apiClient wiring

#### Automated
- [ ] 1.1 build
- [ ] 1.2 lint
- [ ] 1.3 unit tests (incl. apiErrors.test.ts)

#### Manual
- [ ] 1.4 422 shows PL on prod

### Phase 2: UI empty-order guard

#### Automated
- [ ] 2.1 build
- [ ] 2.2 lint
- [ ] 2.3 unit tests

#### Manual
- [ ] 2.4 empty-order submit blocked with PL toast
