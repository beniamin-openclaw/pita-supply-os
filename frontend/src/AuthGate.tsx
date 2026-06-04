// Wraps a page; shows a token-entry modal when no token is set in localStorage
// for the given role. Listens for AUTH_INVALID_EVENT and re-opens the modal.
// Labels/hints come from the i18n hook based on `role`.

import { useEffect, useState, type ReactNode } from "react";
import { AUTH_INVALID_EVENT, validateToken } from "./apiClient";
import { getToken, sanitizeTokenInput, setToken, type Role } from "./auth";
import { useT } from "./i18n";

interface AuthGateProps {
  role: Role;
  children: ReactNode;
}

export function AuthGate({ role, children }: AuthGateProps) {
  const { t } = useT();
  const [token, setLocalToken] = useState<string | null>(() => getToken(role));
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const label = role === "captain" ? t("auth.captainLabel") : t("auth.managerLabel");
  const hint = role === "captain" ? t("auth.captainHint") : t("auth.managerHint");

  useEffect(() => {
    const onInvalid = (e: Event) => {
      const ce = e as CustomEvent<{ role: Role }>;
      if (ce.detail.role === role) {
        setLocalToken(null);
        setError(t("auth.invalidToken"));
      }
    };
    window.addEventListener(AUTH_INVALID_EVENT, onInvalid);
    return () => window.removeEventListener(AUTH_INVALID_EVENT, onInvalid);
  }, [role, t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = sanitizeTokenInput(input);
    if (!cleaned) {
      setError(t("auth.emptyCode"));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await validateToken(cleaned);
    setBusy(false);
    if (!result.ok) {
      if (result.status === 401) {
        setError(t("auth.invalidTokenBackend"));
      } else if (result.status === 0) {
        setError(t("auth.networkError", { detail: result.detail }));
      } else {
        setError(t("auth.backendError", { status: result.status, detail: result.detail }));
      }
      return;
    }
    setToken(role, cleaned);
    setLocalToken(cleaned);
    setInput("");
  }

  if (token) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl mx-4"
      >
        <h1 className="text-lg font-semibold text-slate-900">{label}</h1>
        {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
        <input
          type="password"
          autoFocus
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("auth.placeholder")}
          disabled={busy}
          className="mt-4 w-full rounded border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-400"
        />
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded bg-blue-700 px-4 py-2 text-base font-medium text-white hover:bg-blue-800 active:bg-blue-900 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          {busy ? t("auth.submitting") : t("auth.submit")}
        </button>
        <p className="mt-3 text-xs text-slate-500">{t("auth.persistence")}</p>
      </form>
    </div>
  );
}
