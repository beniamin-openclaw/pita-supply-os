// LocalStorage-based token management for Captain and Manager.
// Tokens are shared per-role per-location (Captain) or globally (Manager).
// Pure functions — no React hooks here; UI calls these directly.

export type Role = "captain" | "manager";

const KEY = {
  captain: "supply_os_captain_token",
  manager: "supply_os_manager_token",
} as const;

export function getToken(role: Role): string | null {
  try {
    return localStorage.getItem(KEY[role]);
  } catch {
    return null;
  }
}

export function setToken(role: Role, token: string): void {
  try {
    localStorage.setItem(KEY[role], token);
  } catch {
    // ignore — private mode browsers may block
  }
}

export function clearToken(role: Role): void {
  try {
    localStorage.removeItem(KEY[role]);
  } catch {
    // ignore
  }
}

/**
 * Clean a token typed/pasted by a user.
 *
 * Common paste shapes we recover from:
 *   "SUPPLY_OS_MANAGER_TOKEN=abc123"     -> "abc123"
 *   "SUPPLY_OS_CAPTAIN_TOKENS=WOLA:abc"  -> "abc"
 *   "WOLA:abc123"                        -> "abc123"
 *   "  WOLA:abc123  \n"                  -> "abc123"
 *   '"WOLA:abc123"'                      -> "abc123"
 *
 * Why we strip `LOCATION:` prefix even though Captain tokens are *stored*
 * in the `.env` with it: the backend's `_parse_captain_tokens` parses
 * `LOCATION:token` into a `{LOCATION → token}` map and then compares only
 * the token value against the Bearer header. So the `WOLA:` part is server-
 * side metadata, never sent over the wire. Operators copy-pasting from
 * `.env` would otherwise have a confusing 401 on every request.
 *
 * Returns the cleaned token, or empty string if nothing usable was provided.
 */
export function sanitizeTokenInput(raw: string): string {
  let s = raw.trim();
  // Strip env-key prefix (e.g. user pasted whole `grep` output line)
  const eq = s.indexOf("=");
  if (eq > 0 && /^[A-Z_][A-Z0-9_]*$/i.test(s.slice(0, eq))) {
    s = s.slice(eq + 1).trim();
  }
  // Strip surrounding quotes
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  // Strip `LOCATION:` prefix (Captain tokens). Location codes are uppercase
  // ASCII identifiers (WOLA, BRACKA, PIASKI…); hex token values never contain
  // a `:`, so detection is unambiguous.
  const colon = s.indexOf(":");
  if (colon > 0 && /^[A-Z][A-Z0-9_]*$/.test(s.slice(0, colon))) {
    s = s.slice(colon + 1).trim();
  }
  return s;
}

// Draft persistence (Captain only) -------------------------------------------

const DRAFT_PREFIX = "supply_os_captain_draft_";

export interface CaptainDraft<T = unknown> {
  supplier_id: string;
  saved_at: string; // ISO datetime
  state: T;
}

export function saveDraft<T>(supplier_id: string, state: T): void {
  try {
    const draft: CaptainDraft<T> = {
      supplier_id,
      saved_at: new Date().toISOString(),
      state,
    };
    localStorage.setItem(DRAFT_PREFIX + supplier_id, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function loadDraft<T>(supplier_id: string): CaptainDraft<T> | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + supplier_id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CaptainDraft<T>;
    // Discard drafts older than 24h
    const age_h = (Date.now() - new Date(parsed.saved_at).getTime()) / 3.6e6;
    if (age_h > 24) {
      clearDraft(supplier_id);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(supplier_id: string): void {
  try {
    localStorage.removeItem(DRAFT_PREFIX + supplier_id);
  } catch {
    // ignore
  }
}
