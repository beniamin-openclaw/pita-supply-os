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

import type { StringKey } from "../../../i18n/strings";
import {
  buildMimeMessage,
  clearGmailTokenCache,
  createGmailDraft,
  deleteGmailDraft,
  getGmailDraftFrom,
  getGmailProfileEmail,
  GmailAuthExpiredError,
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

/**
 * Create the draft and verify mailbox + sender. MUST be the first call of the
 * click handler: it opens the Google popup synchronously (before any await),
 * or the browser blocks it.
 */
export async function createVerifiedOrderDraft(
  args: VerifiedOrderDraftArgs,
): Promise<{ draftId: string }> {
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
  const mime = buildMimeMessage({
    from: args.from,
    to: args.to,
    cc: args.cc || undefined,
    subject: args.subject,
    bodyText: args.body,
    attachments: [],
  });
  const { id } = await createGmailDraft(token, toBase64Url(mime));
  const stored = addressFromHeader(await getGmailDraftFrom(token, id));
  if (!sameAddress(stored, args.from.email)) {
    // Best effort: a failed delete must not hide the real problem.
    await deleteGmailDraft(token, id).catch(() => undefined);
    throw new SenderRewrittenError(stored);
  }
  return { draftId: id };
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
