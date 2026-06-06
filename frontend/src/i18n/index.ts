// Lightweight i18n — Polish + English, manual switcher only (no auto-detection).
// Default: pl. Persisted to localStorage. Plural-aware helpers for nouns that
// inflect in Polish (linia/linie/linii, odchylenie/odchylenia/odchyleń, etc.).
//
// Usage:
//   const { t, lang, setLang, tPlural, formatDateTime } = useT();
//   t("card.critical")                           → "KRYTYCZNY" (pl) / "CRITICAL" (en)
//   t("toast.submitError", { detail: "..." })    → "Błąd wysyłania: ..."
//   tPlural("sticky.summary", "lines", 3)        → "3 pozycje"

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STRINGS, type StringKey } from "./strings";

export type Lang = "pl" | "en";

const LANG_KEY = "supply_os_lang";
const DEFAULT_LANG: Lang = "pl";

function readStoredLang(): Lang {
  try {
    const raw = localStorage.getItem(LANG_KEY);
    if (raw === "en" || raw === "pl") return raw;
  } catch {
    /* private mode etc. */
  }
  return DEFAULT_LANG;
}

function persistLang(l: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* ignore */
  }
}

// ---- Plural form selection -------------------------------------------------

/** Polish: 1 / 2-4 (except 12-14) / else.
 *  English: 1 / else. */
function pluralKey(n: number, lang: Lang): "one" | "few" | "many" {
  if (lang === "en") return n === 1 ? "one" : "many";
  if (n === 1) return "one";
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
  return "many";
}

// ---- Variable interpolation ------------------------------------------------

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

// ---- Context ---------------------------------------------------------------

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  /** Plural-aware lookup. Given a key prefix like "sticky.summary" and a noun
   *  family ("lines"|"deviations"|"reasons"), picks `.one|.few|.many` based on n
   *  and interpolates `{n}` with the count. */
  tPlural: (
    prefix: string,
    noun: string,
    n: number,
    extraVars?: Record<string, string | number>,
  ) => string;
  /** Format a Date or ISO timestamp respecting current language locale. */
  formatDateTime: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

export interface LangProviderProps {
  children: ReactNode;
}

export function LangProvider({ children }: LangProviderProps) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    persistLang(l);
  }, []);

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => {
      const entry = STRINGS[key];
      if (!entry) {
        if (import.meta.env.MODE === "development") {
          console.warn(`[i18n] missing key: ${key}`);
        }
        return String(key);
      }
      return interpolate(entry[lang], vars);
    },
    [lang],
  );

  const tPlural = useCallback(
    (prefix: string, noun: string, n: number, extraVars?: Record<string, string | number>) => {
      const form = pluralKey(n, lang);
      const key = `${prefix}.${form}.${noun}` as StringKey;
      // Fallback: if .few doesn't exist for English (some entries skip it), try .many.
      const fallback = `${prefix}.many.${noun}` as StringKey;
      const entry = (STRINGS as Record<string, { pl: string; en: string } | undefined>)[key] ??
        STRINGS[fallback];
      if (!entry) {
        if (import.meta.env.MODE === "development") {
          console.warn(`[i18n] missing plural key: ${prefix}.${form}.${noun}`);
        }
        return `${n} ${noun}`;
      }
      return interpolate(entry[lang], { n, ...extraVars });
    },
    [lang],
  );

  const formatDateTime = useCallback(
    (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) => {
      const date = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
      const locale = lang === "en" ? "en-GB" : "pl-PL";
      // Caller must pass an explicit options object — we never mix `dateStyle`
      // with individual field options like `weekday` (Intl.DateTimeFormat
      // throws RangeError on that conflict). Default below is "short date + short time".
      const finalOpts: Intl.DateTimeFormatOptions = opts ?? {
        dateStyle: "short",
        timeStyle: "short",
      };
      return new Intl.DateTimeFormat(locale, {
        timeZone: "Europe/Warsaw",
        ...finalOpts,
      }).format(date);
    },
    [lang],
  );

  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, t, tPlural, formatDateTime }),
    [lang, setLang, t, tPlural, formatDateTime],
  );

  return createElement(LangContext.Provider, { value }, children);
}

export function useT(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useT must be used inside a <LangProvider>");
  }
  return ctx;
}

export { STRINGS };
export type { StringKey };
