// Public callback page for the classic OAuth 2.0 implicit-grant popup flow
// (v5.5 — replaces Google Identity Services; see
// pages/manager/lib/gmailDraft.ts's requestGmailAccessToken for why).
//
// Google redirects the popup HERE after the user picks an account (or
// errors/denies), carrying the result in the URL fragment
// (#access_token=...&state=... on success, #error=...&error_description=...
// on failure). This page reads that fragment and hands it back to the
// window that opened the popup via `postMessage` (same-origin — a channel
// that cannot silently vanish the way the old GIS relay did), then closes
// itself.
//
// Route: /oauth/gmail-callback — registered as a PUBLIC route in App.tsx
// (no AuthGate). Google redirects here before the app has had any chance to
// authenticate; the page carries no app data and needs none.

import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { parseOAuthCallbackHash } from "./manager/lib/gmailDraft";

export function OAuthGmailCallback() {
  const { t } = useT();
  // Lazy initializers: the hash/opener are read ONCE, on the first render —
  // not recomputed on re-render, and not a setState-in-effect (which would
  // trigger an avoidable cascading render, see react-hooks/set-state-in-effect).
  const [parsed] = useState(() => parseOAuthCallbackHash(window.location.hash));
  const [hasOpener] = useState(() => Boolean(window.opener));

  useEffect(() => {
    const opener = window.opener as Window | null;
    if (!opener) return;
    opener.postMessage(
      {
        type: "supplyos-gmail-token",
        accessToken: parsed.accessToken,
        state: parsed.state,
        error: parsed.error,
      },
      window.location.origin,
    );
    // Some browsers refuse to close a window not opened by script the same
    // tick, or the user has "ask before closing" settings — the rendered
    // fallback text below covers that case.
    window.close();
  }, [parsed]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-sm text-slate-700">
        {hasOpener
          ? t("oauth.gmailCallback.closeWindow")
          : parsed.error
            ? t("oauth.gmailCallback.errorPrefix", { detail: parsed.error })
            : t("oauth.gmailCallback.noOpener")}
      </p>
    </div>
  );
}
