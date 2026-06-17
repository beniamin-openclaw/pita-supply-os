// Localize a FastAPI 422 validation `detail` array to PL/EN copy, keyed by the
// Pydantic error `type` (+ `ctx`). Pure (language passed in) so it is unit-
// testable without a provider; apiClient calls it with getStoredLang().
//
// Tier 1: common form validations (required / min / max / list-min). Anything
// not a recognized validation-array shape → returns null so the caller falls
// back to the English formatErrorDetail (business-rule 400s stay English).

import { STRINGS, interpolateTemplate, type Lang, type StringKey } from "./index";

interface ValidationEntry {
  type?: unknown;
  loc?: unknown;
  ctx?: Record<string, unknown>;
}

function str(key: StringKey, lang: Lang, vars?: Record<string, string | number>): string {
  const entry = STRINGS[key];
  if (!entry) return String(key);
  return interpolateTemplate(entry[lang], vars);
}

/** Last meaningful field name in a Pydantic `loc` path: the last string segment
 *  that isn't an array index or a body/query/path wrapper. */
function leafField(loc: unknown): string | null {
  if (!Array.isArray(loc)) return null;
  for (let i = loc.length - 1; i >= 0; i--) {
    const seg = loc[i];
    if (typeof seg === "string" && seg !== "body" && seg !== "query" && seg !== "path") {
      return seg;
    }
  }
  return null;
}

function num(ctx: Record<string, unknown> | undefined, ...keys: string[]): number | undefined {
  if (!ctx) return undefined;
  for (const k of keys) {
    const v = ctx[k];
    if (typeof v === "number") return v;
  }
  return undefined;
}

/** Map one 422 entry's `type` (+ ctx) to a localized message (no field prefix). */
function typeMessage(type: string, ctx: Record<string, unknown> | undefined, lang: Lang): string {
  switch (type) {
    case "missing":
    case "value_error.missing":
      return str("apiError.required", lang);
    case "too_short":
    case "string_too_short":
    case "list_type":
      return str("apiError.minItems", lang, { min: num(ctx, "min_length") ?? 1 });
    case "too_long":
    case "string_too_long":
      return str("apiError.maxItems", lang, { max: num(ctx, "max_length") ?? 0 });
    case "greater_than_equal":
      return str("apiError.gte", lang, { limit: num(ctx, "ge") ?? 0 });
    case "greater_than":
      return str("apiError.gt", lang, { limit: num(ctx, "gt") ?? 0 });
    case "less_than_equal":
      return str("apiError.lte", lang, { limit: num(ctx, "le") ?? 0 });
    case "less_than":
      return str("apiError.lt", lang, { limit: num(ctx, "lt") ?? 0 });
    default:
      // Unrecognized type → generic localized message (never leak raw English).
      return str("apiError.invalid", lang);
  }
}

function localizeEntry(entry: ValidationEntry, lang: Lang): string | null {
  const type = typeof entry.type === "string" ? entry.type : null;
  if (!type) return null;
  const field = leafField(entry.loc);
  const ctx = (entry.ctx && typeof entry.ctx === "object") ? entry.ctx : undefined;

  // Most common case: an order/list submitted with no items → a full sentence.
  if (field === "lines" && (type === "too_short" || type === "missing")) {
    return str("apiError.orderEmpty", lang);
  }

  const message = typeMessage(type, ctx, lang);

  // Prefix a friendly field label only when we have copy for it; otherwise emit
  // the bare message (never a raw snake_case English field name).
  if (field) {
    const labelKey = `apiError.field.${field}` as StringKey;
    if (STRINGS[labelKey]) {
      return str("apiError.withField", lang, { field: str(labelKey, lang), message });
    }
  }
  return message;
}

/**
 * Localize a FastAPI 422 `detail`. Returns a PL/EN string for a recognized
 * validation-array shape, or `null` (string details, empty/garbage arrays,
 * non-arrays) so the caller keeps the English fallback.
 */
export function localizeValidationDetail(detail: unknown, lang: Lang): string | null {
  if (!Array.isArray(detail) || detail.length === 0) return null;
  const parts: string[] = [];
  for (const item of detail) {
    if (!item || typeof item !== "object") continue;
    const msg = localizeEntry(item as ValidationEntry, lang);
    if (msg) parts.push(msg);
  }
  if (parts.length === 0) return null;
  // De-dup identical messages (e.g. several lines each "Order qty required").
  return [...new Set(parts)].join("; ");
}
