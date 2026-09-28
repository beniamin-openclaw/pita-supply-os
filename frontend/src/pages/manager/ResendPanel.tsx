// Post-send "dosyłka" (top-up) panel (week2-feedback-quantities Phase 6).
// Rendered on a manager_sent order that is still editable (no receipt, not a
// Transport member). It never dispatches — the order is already sent — it only
// rebuilds the supplier message from the CURRENT effective quantities:
//   email          → "Zrób draft w Gmailu" (verified draft in the order
//                    mailbox, order-email-v2) + the Gmail compose link as a
//                    fallback; subject "Dosyłka — Zamówienie {loc}" (same body
//                    builder + signer as the original dispatch).
//   portal/phone/manual → the plain-text list + copy button (no Gmail link).
// While the draft is dirty the link/list is hidden behind a "save first" note so
// the e-mail never disagrees with what was persisted (and logged).

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { useT } from "../../i18n";
import { compareProductOrder } from "../../lib/productOrder";
import type { ManagerOrderDetail, ManagerOrderLineDetail } from "../../types";
import { type DraftMap, draftQty } from "./lib/draftState";
import {
  buildEmailBody,
  buildGmailComposeUrl,
  buildResendSubject,
  draftCc,
  fallbackCc,
} from "./lib/emailBody";
import {
  createVerifiedOrderDraft,
  describeDraftError,
  getGoogleClientId,
  gmailDraftsUrl,
} from "./lib/orderEmailDraft";
import { splitRecipients } from "./lib/transport";
import { useOrderEmailSigner } from "./lib/useOrderEmailSigner";
import { SignerSelect } from "./SignerSelect";

interface ResendPanelProps {
  detail: ManagerOrderDetail;
  drafts: DraftMap;
  /** Unsaved edits exist — hide the link until the manager saves. */
  dirty: boolean;
  onToast: (msg: string, ok: boolean) => void;
}

export function ResendPanel({ detail, drafts, dirty, onToast }: ResendPanelProps) {
  const { t } = useT();
  const effQty = useMemo(
    () => (line: ManagerOrderLineDetail) => draftQty(drafts, line),
    [drafts],
  );

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      onToast(t("manager.copied"), true);
    } catch {
      onToast(t("manager.copyFailed"), false);
    }
  }

  const isEmail = detail.ordering_method === "email";
  const to = detail.supplier_email ?? "";
  const noEmail = !to.includes("@");
  const { signer, setSignerEmail } = useOrderEmailSigner(detail.email_signers);
  const body = useMemo(
    () => buildEmailBody(detail, effQty, signer),
    [detail, effQty, signer],
  );
  const cc = fallbackCc(detail);
  const subject = buildResendSubject(detail);
  const { url, tooLong } = buildGmailComposeUrl({ to, subject, body, cc });

  // Verified Gmail draft for the dosyłka (order-email-v2 D10) — same checks as
  // the dispatch panel, but it NEVER dispatches: the order is already sent.
  const clientId = getGoogleClientId();
  const mailbox = (detail.order_mailbox ?? "").trim();
  const sender = (detail.sender_email ?? "").trim();
  const draftAvailable = isEmail && Boolean(clientId && mailbox && sender);
  const [drafting, setDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const canDraft = draftAvailable && !noEmail && !dirty && !drafting;
  const canOpenGmail = isEmail && !noEmail && !tooLong && !dirty && !drafting;

  const handleDraft = async (): Promise<void> => {
    if (!canDraft) return;
    setDraftResult(null);
    setDrafting(true);
    try {
      // First call of the handler — it opens the Google popup synchronously.
      await createVerifiedOrderDraft({
        clientId,
        mailbox,
        from: { name: detail.location_name, email: sender },
        to: splitRecipients(to).join(","),
        cc: draftCc(detail),
        subject,
        body,
      });
      setDraftResult({ ok: true, msg: t("manager.draft.doneResend", { mailbox }) });
    } catch (e) {
      setDraftResult({ ok: false, msg: describeDraftError(e, t, { mailbox, sender }) });
    } finally {
      setDrafting(false);
    }
  };

  // Plain-text list (Produkt | Ilość | kod), qty > 0 — mirrors DispatchPanel
  // (canonical supplier order).
  const listText = useMemo(() => {
    const rows = detail.lines
      .filter((ln) => effQty(ln) > 0)
      .sort(compareProductOrder)
      .map((ln) => {
        const code = ln.supplier_product_name || "";
        return `${ln.product_name_pl} | ${effQty(ln)} ${ln.purchase_unit} | ${code}`.replace(
          /\s*\|\s*$/,
          "",
        );
      });
    return [t("manager.copyList.header"), ...rows].join("\n");
  }, [detail.lines, effQty, t]);

  return (
    <div className="border-t border-slate-200 p-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        {t("manager.resend.title")}
      </h3>
      <p className="text-xs text-slate-600">{t("manager.resend.note")}</p>
      {dirty && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {t("manager.resend.unsaved")}
        </p>
      )}
      {isEmail && noEmail && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {t("manager.noEmail")}
        </p>
      )}
      {isEmail && tooLong && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {t("manager.urlTooLong")}
        </p>
      )}
      {isEmail && !dirty && (
        <div className="mt-2">
          <SignerSelect
            id="resend-signer"
            signers={detail.email_signers}
            value={signer}
            onChange={setSignerEmail}
          />
        </div>
      )}
      {!isEmail && !dirty && (
        <pre className="mt-2 overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
          {listText}
        </pre>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {draftAvailable && !dirty && (
          <button
            type="button"
            disabled={!canDraft}
            onClick={() => void handleDraft()}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            {drafting ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                {t("manager.draft.working")}
              </span>
            ) : (
              t("manager.draft.create")
            )}
          </button>
        )}
        {canOpenGmail && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            {t("manager.resend.openGmail")}
          </a>
        )}
        {isEmail && !dirty && (
          <button
            type="button"
            onClick={() => copy(body)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {t("manager.copyBody")}
          </button>
        )}
        {!isEmail && !dirty && (
          <button
            type="button"
            onClick={() => copy(listText)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {t("manager.copyList")}
          </button>
        )}
      </div>
      {draftResult && (
        <p
          role={draftResult.ok ? "status" : "alert"}
          className={
            draftResult.ok
              ? "mt-2 rounded border border-green-300 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800"
              : "mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800"
          }
        >
          {draftResult.msg}{" "}
          {draftResult.ok && (
            <a
              href={gmailDraftsUrl(mailbox)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {t("manager.draft.openDrafts")}
            </a>
          )}
        </p>
      )}
    </div>
  );
}
