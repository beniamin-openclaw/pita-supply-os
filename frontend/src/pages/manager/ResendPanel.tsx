// Post-send "dosyłka" (top-up) panel (week2-feedback-quantities Phase 6).
// Rendered on a manager_sent order that is still editable (no receipt, not a
// Transport member). It never dispatches — the order is already sent — it only
// rebuilds the supplier message from the CURRENT effective quantities:
//   email          → Gmail compose link, subject "Dosyłka — Zamówienie {loc}"
//                    (same body builder as the original dispatch).
//   portal/phone/manual → the plain-text list + copy button (no Gmail link).
// While the draft is dirty the link/list is hidden behind a "save first" note so
// the e-mail never disagrees with what was persisted (and logged).

import { useMemo } from "react";

import { useT } from "../../i18n";
import type { ManagerOrderDetail, ManagerOrderLineDetail } from "../../types";
import { type DraftMap, draftQty } from "./lib/draftState";
import {
  buildEmailBody,
  buildGmailComposeUrl,
  buildResendSubject,
  joinCc,
} from "./lib/emailBody";

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
  const body = useMemo(() => buildEmailBody(detail, effQty), [detail, effQty]);
  const cc = joinCc(detail.cc_email, detail.location_email);
  const { url, tooLong } = buildGmailComposeUrl({
    to,
    subject: buildResendSubject(detail),
    body,
    cc,
  });
  const canOpenGmail = isEmail && !noEmail && !tooLong && !dirty;

  // Plain-text list (Produkt | Ilość | kod), qty > 0 — mirrors DispatchPanel.
  const listText = useMemo(() => {
    const rows = detail.lines
      .filter((ln) => effQty(ln) > 0)
      .sort((a, b) => a.order_line_id.localeCompare(b.order_line_id))
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
      {!isEmail && !dirty && (
        <pre className="mt-2 overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
          {listText}
        </pre>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
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
    </div>
  );
}
