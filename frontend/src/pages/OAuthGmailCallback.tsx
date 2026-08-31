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
import { OAUTH_BROADCAST_CHANNEL, parseOAuthCallbackHash } from "./manager/lib/gmailDraft";

export function OAuthGmailCallback() {
  const { t } = useT();
  // Lazy initializers: the hash/opener are read ONCE, on the first render —
  // not recomputed on re-render, and not a setState-in-effect (which would
  // trigger an avoidable cascading render, see react-hooks/set-state-in-effect).
  const [parsed] = useState(() => parseOAuthCallbackHash(window.location.hash));
  const [hasOpener] = useState(() => Boolean(window.opener));

  useEffect(() => {
    const payload = {
      type: "supplyos-gmail-token",
      accessToken: parsed.accessToken,
      state: parsed.state,
      error: parsed.error,
    };
    // PRIMARY channel (v5.6.1): BroadcastChannel — accounts.google.com's COOP
    // headers SEVER window.opener once the popup passes through Google's
    // domain (live-diagnosed on prod: this page rendered its no-opener branch
    // in the real flow), so opener.postMessage alone never arrives. The
    // broadcast is same-origin scoped and immune to that.
    try {
      const channel = new BroadcastChannel(OAUTH_BROADCAST_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    } catch {
      // BroadcastChannel unavailable — the opener path below still tries.
    }
    const opener = window.opener as Window | null;
    if (opener) {
      opener.postMessage(payload, window.location.origin);
    }
    // Only auto-close when this really is a result page (token or error in
    // the fragment) — never a bare direct visit. Some browsers refuse to
    // close a window they didn't script-open; the fallback text covers that.
    if (parsed.accessToken || parsed.error) {
      window.close();
    }
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
