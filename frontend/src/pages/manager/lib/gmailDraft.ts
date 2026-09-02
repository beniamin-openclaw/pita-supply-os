// "Zrob draft w Gmailu" (Manager Transport, v4) — creates a real Gmail DRAFT
// (never sends) in the mailbox of WHOEVER clicks the button: the operator
// authorizes once via Google OAuth (gmail.compose scope, Google Identity
// Services token client), then the app POSTs a MIME message to the Gmail API
// drafts endpoint. The resulting draft lands in THEIR Drafts folder — the app
// itself never touches SMTP or any mailbox directly.
//
// Recipe recovered from the legacy Google Apps Script (two separate drafts
// per Transport batch):
//   1. PAGO order draft — recipients = the supplier's distribution list
//      (suppliers.email, already comma/semicolon-splittable via
//      splitRecipients in lib/transport.ts); attachment = the Pago order PDF.
//   2. DRIVER draft — recipients = the operator-configured driver-recipients
//      config (`_meta.transport_driver_recipients`, via
//      `api.transportDraftConfig()`); attachment = the driver-list PDF.
//
// This module is split into MIME/base64 mechanics (pure, unit-tested) and
// two thin browser-only wrappers (requestGmailAccessToken, createGmailDraft)
// that are deliberately NOT unit-tested (they need a live GIS script + a
// network call — see the task's test scope).

import type { StringKey } from "../../../i18n/strings";
import type { TransportBatchDetail } from "../../../types";
// Deliberate exception to this module's usual zero-coupling-with-transport.ts
// stance (see `isoDatePart` below): the ad-hoc off-catalogue items block MUST
// be the SAME function both here and in transport.ts's buildTransportEmailBody
// call, not two independently-maintained copies — that exact "both builders"
// drift (migration 0013 patched one and not the other) is the bug this fixes
// (training-feedback-0901 F1).
import { buildExtraItemsSupplierBlock } from "./transport";

type TFunc = (key: StringKey, vars?: Record<string, string | number>) => string;

// ---------- date helper ------------------------------------------------------

/** ISO datetime/date -> the date part only ("YYYY-MM-DD"). "" when absent.
 * Mirrors the private `isoDatePart` in lib/transport.ts — kept as an
 * independent one-line copy rather than imported, unlike
 * `buildExtraItemsSupplierBlock` above (see that import's comment for why
 * THAT one specifically must be shared, not duplicated). */
function isoDatePart(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ---------- base64 / MIME primitives -----------------------------------------

/** UTF-8 string -> standard (non-url-safe) base64, via TextEncoder + btoa on
 * the resulting binary string. Used for the MIME body part's
 * Content-Transfer-Encoding: base64 payload and for RFC 2047 subject
 * encoding — NOT for the final `raw` field (see `toBase64Url`). */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Wrap a base64 string at 76 chars/line (RFC 2045 §6.8), CRLF-joined — MIME
 * convention; Gmail accepts unwrapped base64 too, but wrapping keeps the raw
 * message closer to what a real mail client would produce. */
function wrapBase64(b64: string): string {
  const out: string[] = [];
  for (let i = 0; i < b64.length; i += 76) out.push(b64.slice(i, i + 76));
  return out.join("\r\n");
}

/** RFC 2047 "encoded-word" subject: ASCII passes through unchanged; anything
 * with a non-ASCII byte becomes `=?UTF-8?B?<base64>?=`. */
function encodeSubjectHeader(subject: string): string {
  // eslint-disable-next-line no-control-regex -- ASCII range check, not a control-char strip
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${utf8ToBase64(subject)}?=`;
}

export interface MimeAttachment {
  filename: string;
  base64: string; // already base64-encoded content (e.g. a PDF's raw bytes)
  mimeType: string;
}

export interface BuildMimeMessageOptions {
  to: string;
  subject: string;
  bodyText: string;
  attachments: MimeAttachment[];
  // Deterministic boundary — NEVER Math.random() (keeps output reproducible
  // for tests and for anyone diffing a generated message). Defaults to a
  // fixed literal; callers combining several messages in one batch context
  // can pass a distinct value if ever needed.
  boundary?: string;
}

/** Build an RFC 2822 multipart/mixed MIME message: a UTF-8 text/plain body
 * part (base64) followed by one application/pdf attachment part per entry in
 * `attachments`. Returns the raw MIME source as a string — NOT base64url
 * encoded yet (see `toBase64Url` for the Gmail API `raw` field). */
export function buildMimeMessage(opts: BuildMimeMessageOptions): string {
  const boundary = opts.boundary ?? "pitabros-mime-boundary";
  const lines: string[] = [];

  lines.push(`To: ${opts.to}`);
  lines.push(`Subject: ${encodeSubjectHeader(opts.subject)}`);
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push("");
  lines.push(`--${boundary}`);
  lines.push('Content-Type: text/plain; charset="utf-8"');
  lines.push("Content-Transfer-Encoding: base64");
  lines.push("");
  lines.push(wrapBase64(utf8ToBase64(opts.bodyText)));

  for (const att of opts.attachments) {
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
    lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(wrapBase64(att.base64));
  }

  lines.push(`--${boundary}--`);
  lines.push("");

  return lines.join("\r\n");
}

/** UTF-8 string -> base64url (RFC 4648 §5: `+`→`-`, `/`→`_`, `=` padding
 * stripped) — the encoding the Gmail API's `drafts.create` expects for its
 * `message.raw` field. Applied to the FULL MIME source from
 * `buildMimeMessage`, not to any individual part. */
export function toBase64Url(mime: string): string {
  const bytes = new TextEncoder().encode(mime);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// ---------- draft email content (subject + body) -----------------------------

/**
 * PAGO order draft — subject + body per the legacy Apps Script recipe.
 * Subject is a fixed ASCII template (deliberately no Polish diacritics,
 * matching the legacy script verbatim): "Zlecenie odbioru wlasnego - {label}
 * - {date}". The body is short plain text and — per the no-location-leak
 * invariant the rest of this codebase enforces for supplier-facing text
 * (see lib/transport.ts's header comment) — never mentions per-location
 * quantities; those live only in the attached PDF's own no-location-data
 * contract (buildTransportPagoPrintDoc).
 */
export function buildPagoDraftEmail(
  detail: TransportBatchDetail,
  displayLabel: string,
  t: TFunc,
): { subject: string; bodyText: string } {
  const date = detail.pickup_date ?? isoDatePart(detail.created);
  const subject = `Zlecenie odbioru wlasnego - ${displayLabel} - ${date}`;
  return { subject, bodyText: buildDraftBody(detail, displayLabel, date, t) };
}

/**
 * DRIVER draft — subject + body per the legacy Apps Script recipe. Subject:
 * "Transport / odbior i rozwoz - {label} - {date}" (same fixed-ASCII-template
 * discipline as the Pago draft). Body mirrors the Pago draft's shape; the
 * per-location detail lives in the attached driver-list PDF, not the email
 * text.
 */
export function buildDriverDraftEmail(
  detail: TransportBatchDetail,
  displayLabel: string,
  t: TFunc,
): { subject: string; bodyText: string } {
  const date = detail.pickup_date ?? isoDatePart(detail.created);
  const subject = `Transport / odbior i rozwoz - ${displayLabel} - ${date}`;
  return { subject, bodyText: buildDraftBody(detail, displayLabel, date, t) };
}

function buildDraftBody(
  detail: TransportBatchDetail,
  displayLabel: string,
  date: string,
  t: TFunc,
): string {
  const out: string[] = [];
  out.push(t("manager.transport.email.greeting"));
  out.push("");
  out.push(t("manager.transport.gmailDraft.body.transportLine", { label: displayLabel }));
  if (date) {
    out.push(
      detail.pickup_time
        ? t("manager.transport.gmailDraft.body.pickupLineWithTime", {
            date,
            time: detail.pickup_time,
          })
        : t("manager.transport.gmailDraft.body.pickupLine", { date }),
    );
  }
  if (detail.driver) {
    out.push(t("manager.transport.gmailDraft.body.driverLine", { driver: detail.driver }));
  }
  if (detail.vehicle) {
    out.push(t("manager.transport.gmailDraft.body.vehicleLine", { vehicle: detail.vehicle }));
  }
  // Ad-hoc off-catalogue items (training-feedback-0901 F1) — this is the body
  // of the Gmail draft that actually reaches the supplier/driver, so it uses
  // the SAME buildExtraItemsSupplierBlock as transport.ts's
  // buildTransportEmailBody (verbatim, never de-duplicated, no location
  // attribution) rather than a second, driftable copy.
  const extraItemsBlock = buildExtraItemsSupplierBlock(detail.orders, t);
  if (extraItemsBlock.length > 0) {
    out.push("");
    out.push(...extraItemsBlock);
  }
  out.push("");
  out.push(t("manager.transport.gmailDraft.body.attachmentLine"));
  out.push("");
  out.push(t("manager.transport.email.closing"));
  out.push(t("manager.transport.email.signature"));
  return out.join("\n");
}

// ---------- Gmail API + classic OAuth 2.0 implicit-grant popup (browser-only) ----
//
// v5.5 (live-repro fix): Google Identity Services' token-client popup was
// dying silently in the operator's Chrome — the popup closed itself at the
// account-chooser stage and neither `callback` nor `error_callback` ever
// fired (a GIS/FedCM/third-party-cookie relay failure class we cannot fix
// from here). Replaced with the classic OAuth 2.0 implicit-grant popup: we
// open Google's own consent URL directly (no GIS script, no relay), Google
// redirects the popup to OUR SAME-ORIGIN callback page
// (`/oauth/gmail-callback`, see `OAuthGmailCallback.tsx`), and that page
// posts the token back to this window via `postMessage` — a same-origin
// channel that cannot silently drop messages the way the GIS popup did.

/** Cryptographically random hex nonce, used as the OAuth `state` param so a
 * stray `message` event (or a stale popup from a previous click) can never
 * be mistaken for this request's callback. */
function generateOAuthState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface GmailAuthUrlOptions {
  clientId: string;
  redirectUri: string;
  state: string;
}

/** Build the Google OAuth 2.0 implicit-grant consent URL
 * (`response_type=token`) for the `gmail.compose` scope. Pure + unit-tested.
 * `prompt=select_account` mirrors the GIS flow's account chooser;
 * `include_granted_scopes=true` lets a returning user skip re-consenting to
 * scopes already granted elsewhere in the app. */
export function buildGmailAuthUrl(opts: GmailAuthUrlOptions): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "token",
    scope: "https://www.googleapis.com/auth/gmail.compose",
    include_granted_scopes: "true",
    prompt: "select_account",
    state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface ParsedOAuthCallback {
  accessToken?: string;
  state?: string;
  error?: string;
}

/** Parse the URL fragment Google redirects the popup back with
 * (`#access_token=...&state=...` on success, `#error=...&error_description=...`
 * on failure/denial). Pure + unit-tested — the leading `#` is optional so
 * callers can pass `window.location.hash` or its already-stripped value. */
export function parseOAuthCallbackHash(hash: string): ParsedOAuthCallback {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const out: ParsedOAuthCallback = {};
  const accessToken = params.get("access_token");
  if (accessToken) out.accessToken = accessToken;
  const state = params.get("state");
  if (state) out.state = state;
  const error = params.get("error_description") || params.get("error");
  if (error) out.error = error;
  return out;
}

const OAUTH_MESSAGE_TYPE = "supplyos-gmail-token";

/** Same-origin broadcast channel the callback page reports back on (v5.6.1).
 * PRIMARY channel — NOT a fallback: accounts.google.com serves COOP headers
 * that SEVER the popup's `window.opener` once the popup navigates through
 * Google's domain (live-diagnosed: the callback page rendered its no-opener
 * branch on prod), so `opener.postMessage` never arrives. BroadcastChannel
 * is scoped to our origin and survives the severed opener. */
export const OAUTH_BROADCAST_CHANNEL = "supplyos-gmail-oauth";

export interface GmailTokenMessage {
  type: string;
  accessToken?: string;
  state?: string;
  error?: string;
}

/**
 * Request a short-lived OAuth access token (scope: gmail.compose) for the
 * CURRENT user via a classic OAuth 2.0 implicit-grant popup — this is the
 * "sign in with your own @pitabros.pl Google account" step. Resolves with
 * the access token; rejects on a Google/user error, a blocked popup, or the
 * popup being closed before completion.
 */
export async function requestGmailAccessToken(clientId: string): Promise<string> {
  const state = generateOAuthState();
  const redirectUri = `${window.location.origin}/oauth/gmail-callback`;
  const url = buildGmailAuthUrl({ clientId, redirectUri, state });

  const popup = window.open(url, "supplyos-gmail-auth", "popup,width=520,height=680");
  if (!popup) {
    throw new Error("popup_blocked");
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const channel = new BroadcastChannel(OAUTH_BROADCAST_CHANNEL);

    const cleanup = (): void => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      channel.close();
    };
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const handlePayload = (data: GmailTokenMessage | null | undefined): void => {
      if (!data || data.type !== OAUTH_MESSAGE_TYPE) return;
      // Ignore a message for a different (e.g. stale, previous-click) request.
      if (data.state !== state) return;
      if (data.error || !data.accessToken) {
        settle(() => reject(new Error(data.error || "No access token returned")));
        return;
      }
      const token = data.accessToken;
      settle(() => resolve(token));
    };

    // PRIMARY: BroadcastChannel — same-origin by construction, immune to the
    // COOP opener-severing described at OAUTH_BROADCAST_CHANNEL.
    channel.onmessage = (event: MessageEvent): void => {
      handlePayload(event.data as GmailTokenMessage | null | undefined);
    };

    // Secondary: opener postMessage, for browsers/paths where the opener
    // link survives. Same-origin only.
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) return;
      handlePayload(event.data as GmailTokenMessage | null | undefined);
    };
    window.addEventListener("message", onMessage);

    // Deliberately NO `popup.closed` poll (v5.6.1): under Google's COOP
    // severance the WindowProxy misreports `closed === true` while the flow
    // is still in progress, which made the old poll reject spuriously —
    // and a late-but-valid BroadcastChannel token would then be discarded.
    // A user who really closes the popup simply waits out the deadline
    // below (or clicks the button again).

    // Safety net: no signal at all within the deadline (slow login/consent,
    // popup closed by the user, or a silently stuck window).
    const timeoutId = window.setTimeout(
      () => settle(() => reject(new Error("Google sign-in timed out"))),
      90_000,
    );
  });
}

/**
 * Create a Gmail DRAFT (never sends) via the Gmail API, in the mailbox that
 * authorized `accessToken`. `rawBase64Url` is the full MIME message from
 * `buildMimeMessage` + `toBase64Url`.
 */
export async function createGmailDraft(
  accessToken: string,
  rawBase64Url: string,
): Promise<{ id: string }> {
  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { raw: rawBase64Url } }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`Gmail API error ${resp.status}: ${text}`);
  }
  const data = (await resp.json()) as { id: string };
  return data;
}
