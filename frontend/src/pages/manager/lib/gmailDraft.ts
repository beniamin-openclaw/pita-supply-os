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

type TFunc = (key: StringKey, vars?: Record<string, string | number>) => string;

// ---------- date helper ------------------------------------------------------

/** ISO datetime/date -> the date part only ("YYYY-MM-DD"). "" when absent.
 * Mirrors the private `isoDatePart` in lib/transport.ts (kept local here so
 * this module has no non-type dependency on transport.ts). */
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
  out.push("");
  out.push(t("manager.transport.gmailDraft.body.attachmentLine"));
  out.push("");
  out.push(t("manager.transport.email.closing"));
  out.push(t("manager.transport.email.signature"));
  return out.join("\n");
}

// ---------- Gmail API + Google Identity Services (browser-only, untested) ----

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let gisLoadPromise: Promise<void> | null = null;

/** Inject the Google Identity Services script exactly once (cached load
 * promise — a second call while the first is still loading, or after it
 * finished, reuses the same promise instead of injecting a duplicate
 * `<script>` tag). */
function loadGisScript(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services")));
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

/**
 * Request a short-lived OAuth access token (scope: gmail.compose) for the
 * CURRENT user via Google Identity Services' token-client flow — this is the
 * "sign in with your own @pitabros.pl Google account" step. Resolves with
 * the access token; rejects on a GIS/user error (e.g. the popup was closed).
 */
export async function requestGmailAccessToken(clientId: string): Promise<string> {
  await loadGisScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error("Google Identity Services failed to initialize");
  }
  return new Promise<string>((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/gmail.compose",
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "No access token returned"));
          return;
        }
        resolve(resp.access_token);
      },
    });
    tokenClient.requestAccessToken();
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
