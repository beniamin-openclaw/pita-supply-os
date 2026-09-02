// Per-role name suggestions for free-text attribution fields ("kto zamawia" /
// "kto odebrał" / "kto liczył"). No accounts, no server round-trip (the v0
// two-token model has no per-person identity) — just a small localStorage list
// of previously-typed names per role, wired into an HTML <datalist> so a
// returning Captain/Manager sees names after typing a couple of letters.
//
// Every localStorage access is wrapped in try/catch, mirroring auth.ts: a
// private-mode browser or a full quota must degrade to "no suggestions yet",
// never break the form that calls this.

export type NameSuggestionRole = "ordered_by" | "received_by" | "count_user";

const STORAGE_PREFIX = "supply_os_name_suggestions_";
const MAX_NAMES = 10;

function storageKey(role: NameSuggestionRole): string {
  return `${STORAGE_PREFIX}${role}`;
}

/**
 * Previously used names for `role`, most-recently-used first. Returns `[]` on
 * anything unexpected — no entry yet, private-mode/storage failure, or
 * corrupt/foreign JSON — never throws.
 */
export function getNameSuggestions(role: NameSuggestionRole): string[] {
  try {
    const raw = localStorage.getItem(storageKey(role));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/**
 * Records `name` as used for `role`: moves it to the front if already present
 * (case-insensitive match, so "Ala" and "ala" collapse to one entry keeping
 * the latest casing), then caps the list at `MAX_NAMES` most-recent names.
 * A blank/whitespace-only name is ignored. Never throws.
 */
export function addNameSuggestion(role: NameSuggestionRole, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    const existing = getNameSuggestions(role);
    const deduped = existing.filter((n) => n.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...deduped].slice(0, MAX_NAMES);
    localStorage.setItem(storageKey(role), JSON.stringify(next));
  } catch {
    // ignore — private mode / quota exceeded / disabled storage
  }
}
