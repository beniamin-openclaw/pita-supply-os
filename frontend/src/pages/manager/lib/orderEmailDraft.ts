// Verified Gmail draft for the per-order supplier e-mail (order-email-v2).
//
// The draft must land in the order mailbox (biuro@) with From = the location's
// send-as alias. Gmail gives no error for either failure: a draft simply lands
// in whichever account signed in, and a From that is not a send-as alias of
// that account is silently replaced by the primary address. So this flow
// VERIFIES both, within the gmail.compose scope:
//   1. token (popup pre-selecting the mailbox; reused ~50 min),
//   2. users.getProfile must be the mailbox — else no draft at all; only a
//      token that passed this check is remembered for reuse,
//   3. drafts.create,
//   4. drafts.get From must be the alias — else the draft is deleted.
// Only a verified draft is returned; the caller dispatches after that. The app
// never sends — the manager sends the draft from Gmail.
//
// transport-v2 splits the flow in two so the Transport send panel can take the
// token FIRST (inside the click gesture, before finalize/PDF work) and create
// one or more drafts with it later: acquireVerifiedGmailToken (steps 1-2) and
// createVerifiedDraftWithToken (steps 3-4, with optional PDF attachments).
// createVerifiedOrderDraft composes the two and keeps its old contract.

import type { StringKey } from "../../../i18n/strings";
import {
  buildMimeMessage,
  clearGmailTokenCache,
  createGmailDraft,
  deleteGmailDraft,
  getGmailDraftFrom,
  getGmailProfileEmail,
  GmailAuthExpiredError,
  type MimeAttachment,
  type MimeFrom,
  rememberGmailToken,
  requestGmailAccessToken,
  toBase64Url,
} from "./gmailDraft";

type TFunc = (key: StringKey, vars?: Record<string, string | number>) => string;

/** OAuth client id (Vercel env). Empty -> the draft button is not offered. */
export function getGoogleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";
}

/** Signed into another account than the order mailbox. No draft was created. */
export class WrongMailboxError extends Error {
  readonly actual: string;
  constructor(actual: string) {
    super(`wrong_mailbox:${actual}`);
    this.name = "WrongMailboxError";
    this.actual = actual;
  }
}

/** Gmail replaced the requested From (alias not set up). Draft deleted. */
export class SenderRewrittenError extends Error {
  readonly actual: string;
  constructor(actual: string) {
    super(`sender_rewritten:${actual}`);
    this.name = "SenderRewrittenError";
    this.actual = actual;
  }
}

/** Bare address out of a From header: `"Name" <a@b>` -> "a@b". */
export function addressFromHeader(header: string): string {
  const m = /<([^>]+)>/.exec(header);
  return (m ? m[1] : header).trim();
}

function sameAddress(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export interface VerifiedOrderDraftArgs {
  clientId: string;
  /** The mailbox the draft must be created in (order_mailbox, biuro@). */
  mailbox: string;
  from: MimeFrom;
  to: string;
  cc: string;
  subject: string;
  body: string;
}

export interface VerifiedGmailTokenArgs {
  clientId: string;
  /** The mailbox the token must belong to (order_mailbox, biuro@). */
  mailbox: string;
}

/**
 * Steps 1-2: a Gmail token for `mailbox`, verified via users.getProfile.
 * Pre-selects the mailbox in the popup and reuses a cached token (~50 min).
 * A token for another account is never kept: the cache entry is cleared and
 * WrongMailboxError is thrown (no draft can be created with it). Only a
 * token that passed the check is remembered.
 *
 * MUST be the first call of the click handler: it opens the Google popup
 * synchronously (before any await), or the browser blocks it.
 */
export async function acquireVerifiedGmailToken(args: VerifiedGmailTokenArgs): Promise<string> {
  const token = await requestGmailAccessToken(args.clientId, {
    loginHint: args.mailbox,
    reuse: true,
  });
  const actual = await getGmailProfileEmail(token);
  if (!sameAddress(actual, args.mailbox)) {
    // Never keep a token for the wrong account under the mailbox's key.
    clearGmailTokenCache(args.mailbox);
    throw new WrongMailboxError(actual);
  }
  rememberGmailToken(args.mailbox, token);
  return token;
}

export interface VerifiedDraftArgs {
  /** Required sender; the stored draft's From must match it. */
  from: MimeFrom;
  to: string;
  /** Comma-joined Cc; omitted/empty -> no Cc header. */
  cc?: string;
  subject: string;
  body: string;
  /** e.g. the Transport order / driver-list PDF. */
  attachments?: MimeAttachment[];
}

/**
 * Steps 3-4 with a token from acquireVerifiedGmailToken: create the draft,
 * then read its From back — Gmail silently replaces a From that is not a
 * send-as alias of the mailbox, so a mismatch deletes the draft (best
 * effort) and throws SenderRewrittenError. A 401 surfaces as
 * GmailAuthExpiredError (the token cache is already cleared).
 */
export async function createVerifiedDraftWithToken(
  token: string,
  args: VerifiedDraftArgs,
): Promise<{ id: string; messageId: string }> {
  const mime = buildMimeMessage({
    from: args.from,
    to: args.to,
    cc: args.cc || undefined,
    subject: args.subject,
    bodyText: args.body,
    attachments: args.attachments ?? [],
  });
  const { id, messageId } = await createGmailDraft(token, toBase64Url(mime));
  const stored = addressFromHeader(await getGmailDraftFrom(token, id));
  if (!sameAddress(stored, args.from.email)) {
    // Best effort: a failed delete must not hide the real problem.
    await deleteGmailDraft(token, id).catch(() => undefined);
    throw new SenderRewrittenError(stored);
  }
  return { id, messageId };
}

/**
 * Create the draft and verify mailbox + sender (acquireVerifiedGmailToken +
 * createVerifiedDraftWithToken). MUST be the first call of the click
 * handler: it opens the Google popup synchronously (before any await), or
 * the browser blocks it.
 */
export async function createVerifiedOrderDraft(
  args: VerifiedOrderDraftArgs,
): Promise<{ draftId: string; messageId: string }> {
  const token = await acquireVerifiedGmailToken({ clientId: args.clientId, mailbox: args.mailbox });
  const { id, messageId } = await createVerifiedDraftWithToken(token, {
    from: args.from,
    to: args.to,
    cc: args.cc,
    subject: args.subject,
    body: args.body,
  });
  return { draftId: id, messageId };
}

/** Polish/English message for a failed draft, naming what to do next. */
export function describeDraftError(
  e: unknown,
  t: TFunc,
  ctx: { mailbox: string; sender: string },
): string {
  if (e instanceof WrongMailboxError) {
    return t("manager.draft.errWrongMailbox", { actual: e.actual || "?", mailbox: ctx.mailbox });
  }
  if (e instanceof SenderRewrittenError) {
    return t("manager.draft.errSenderRewritten", {
      sender: ctx.sender,
      actual: e.actual || "?",
      mailbox: ctx.mailbox,
    });
  }
  if (e instanceof GmailAuthExpiredError) return t("manager.draft.errSessionExpired");
  const msg = e instanceof Error && e.message ? e.message : String(e);
  if (msg === "popup_blocked") return t("manager.draft.errPopupBlocked");
  // Raw English messages from requestGmailAccessToken (shared with Transport).
  if (msg === "Google sign-in timed out") return t("manager.draft.errSignInTimeout");
  if (msg === "No access token returned" || msg === "access_denied") {
    return t("manager.draft.errNoToken");
  }
  return t("manager.draft.errGeneric", { detail: msg });
}

/** Gmail Drafts folder of a given account. */
export function gmailDraftsUrl(mailbox: string): string {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(mailbox)}#drafts`;
}

/**
 * Open ONE draft (supplier-email-v21 WP3): set to false to fall back to the
 * Drafts folder everywhere if the live check on biuro@ shows the single-draft
 * link misbehaving (it opens the list or an empty compose window).
 */
export const OPEN_SINGLE_DRAFT = true;

/**
 * The draft itself in the Gmail UI of `mailbox`: the drafts view with the
 * compose window of the draft's `message.id` (the form API-created drafts are
 * opened with, community-documented; Google publishes no URL contract). An
 * empty id, or OPEN_SINGLE_DRAFT off, gives the Drafts folder. The id belongs
 * to the draft as created — once the draft is edited in Gmail its message id
 * changes and the link may open the list instead, which is still a safe
 * landing.
 */
export function gmailDraftOpenUrl(mailbox: string, messageId: string | null | undefined): string {
  const id = (messageId ?? "").trim();
  if (!OPEN_SINGLE_DRAFT || !id) return gmailDraftsUrl(mailbox);
  return `${gmailDraftsUrl(mailbox)}?compose=${encodeURIComponent(id)}`;
}

/** A per-order draft sent this session (supplier-email-v21 WP3): where it
 *  lives, its link, and whether the browser let the page open it. */
export interface DraftedOrder {
  mailbox: string;
  url: string;
  /** false = the tab was blocked (or never tried): the order shows a
   *  persistent "not sent yet — Otwórz szkic" call to action. */
  opened: boolean;
}

/**
 * Try to open `url` in a new tab; true when the browser allowed it. Called
 * after several awaits, so a popup blocker usually stops it on the first send
 * after a page load (the Google sign-in popup used up the click). Opened
 * WITHOUT "noopener" because with it window.open always returns null and a
 * block could not be told from success; the opener is cut right away.
 */
export function openDraftTab(url: string): boolean {
  try {
    const tab = window.open(url, "_blank");
    if (!tab) return false;
    try {
      tab.opener = null;
    } catch {
      // cross-origin already — nothing to cut
    }
    return true;
  } catch {
    return false;
  }
}
