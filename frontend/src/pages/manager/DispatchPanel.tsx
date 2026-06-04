// Channel-aware dispatch panel (Phase G3). Branches on detail.ordering_method:
//   email  → editable subject + textarea body; Gmail URL built IN TS from the
//            EDITED text; 8000-char check hides "Otwórz w Gmail"; clicking the
//            link ALSO fires the dispatch state-write. Copy body / address.
//   portal → no email; placeholder portal-URL slot (never a hardcoded URL),
//            copy-paste list, "Oznacz jako zamówione ✓".
//   phone  → number from supplier_notes (tel: link if parseable), copy list,
//            "Oznacz jako zamówione ✓".
//   manual → info note + "Oznacz jako zamówione ✓".
//
// Dispatch payload is ALWAYS built from the current draft effective quantities
// (full line set, non-empty) by the parent. sent_method maps 1:1 from
// ordering_method. Dispatch is blocked when every effective line qty is 0.

import { useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { useT } from "../../i18n";
import type { ManagerOrderDetail, ManagerOrderLineDetail, OrderingMethod } from "../../types";
import {
  type DraftMap,
  draftQty,
  draftTotalValuePln,
  isOrderEmpty,
} from "./lib/draftState";
import {
  buildEmailBody,
  buildEmailSubject,
  buildGmailComposeUrl,
} from "./lib/emailBody";

interface DispatchPanelProps {
  detail: ManagerOrderDetail;
  drafts: DraftMap;
  /** True while a dispatch is in flight for this order. */
  busy: boolean;
  /** Fire the dispatch state-write with the full draft line set + sent_method. */
  onDispatch: (sentMethod: OrderingMethod) => void;
  /** Surface a toast (copy success/failure). */
  onToast: (msg: string, ok: boolean) => void;
}

// Best-effort phone extraction from free-text supplier_notes for a tel: link.
function parsePhone(notes: string): string | null {
  const m = notes.match(/(\+?\d[\d\s().-]{6,}\d)/);
  if (!m) return null;
  const cleaned = m[1].replace(/[^\d+]/g, "");
  return cleaned.length >= 7 ? cleaned : null;
}

export function DispatchPanel({ detail, drafts, busy, onDispatch, onToast }: DispatchPanelProps) {
  const { t } = useT();
  const method = detail.ordering_method;

  const empty = isOrderEmpty(drafts, detail.lines);
  const totalValuePln = draftTotalValuePln(drafts, detail.lines);
  const effQty = useMemo(
    () => (line: ManagerOrderLineDetail) => draftQty(drafts, line),
    [drafts],
  );

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      onToast(t("manager.copied"), true);
    } catch {
      onToast(t("manager.copyFailed"), false);
    }
  }

  // Plain-text list (Produkt | Ilość | kod) for portal/phone, draft qty > 0.
  const listText = useMemo(() => {
    const rows = detail.lines
      .filter((ln) => effQty(ln) > 0)
      .sort((a, b) => a.order_line_id.localeCompare(b.order_line_id))
      .map((ln) => {
        const code = ln.supplier_product_name || "";
        return `${ln.product_name_pl} | ${effQty(ln)} ${ln.purchase_unit} | ${code}`.replace(/\s*\|\s*$/, "");
      });
    return [t("manager.copyList.header"), ...rows].join("\n");
  }, [detail.lines, effQty, t]);

  const emptyNote: ReactNode = empty ? (
    <p className="mt-2 text-xs font-semibold text-amber-700">{t("manager.emptyOrder")}</p>
  ) : null;

  const markOrderedButton: ReactNode = (
    <button
      type="button"
      disabled={busy || empty}
      onClick={() => onDispatch(method)}
      className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
    >
      {busy ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          {t("manager.action.working")}
        </span>
      ) : (
        t("manager.markOrdered")
      )}
    </button>
  );

  const copyListButton: ReactNode = (
    <button
      type="button"
      onClick={() => copy(listText)}
      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      {t("manager.copyList")}
    </button>
  );

  const titleKey = (
    {
      email: "manager.dispatch.email",
      portal: "manager.dispatch.portal",
      phone: "manager.dispatch.phone",
      manual: "manager.dispatch.manual",
    } as const
  )[method];

  return (
    <div className="border-t border-slate-200 p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t(titleKey)}</h3>

      {method === "email" && (
        <EmailDispatch
          detail={detail}
          effQty={effQty}
          totalValuePln={totalValuePln}
          empty={empty}
          busy={busy}
          onDispatch={onDispatch}
          onCopy={copy}
        />
      )}

      {method === "portal" && (
        <div className="space-y-3 text-sm">
          <p className="text-slate-700">{t("manager.portalNote", { supplier: detail.supplier_name })}</p>
          {/* Portal URL is NOT in master data yet — placeholder only, no guessed URL. */}
          <div className="flex items-center gap-2">
            <span className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {t("manager.portalUrlTbd")}
            </span>
          </div>
          <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">{listText}</pre>
          <div className="flex flex-wrap items-center gap-2">
            {copyListButton}
            {markOrderedButton}
          </div>
          {emptyNote}
        </div>
      )}

      {method === "phone" && (
        <PhoneDispatch
          detail={detail}
          listText={listText}
          markOrderedButton={markOrderedButton}
          copyListButton={copyListButton}
          emptyNote={emptyNote}
        />
      )}

      {method === "manual" && (
        <div className="space-y-3 text-sm">
          <p className="text-slate-700">{t("manager.manualNote")}</p>
          <div className="flex flex-wrap items-center gap-2">{markOrderedButton}</div>
          {emptyNote}
        </div>
      )}
    </div>
  );
}

// --- email channel ---------------------------------------------------------

interface EmailDispatchProps {
  detail: ManagerOrderDetail;
  effQty: (line: ManagerOrderLineDetail) => number;
  totalValuePln: number;
  empty: boolean;
  busy: boolean;
  onDispatch: (sentMethod: OrderingMethod) => void;
  onCopy: (text: string) => void;
}

function EmailDispatch({
  detail,
  effQty,
  totalValuePln,
  empty,
  busy,
  onDispatch,
  onCopy,
}: EmailDispatchProps) {
  const { t } = useT();

  // Seed subject/body from the draft on mount; the manager then edits freely.
  // DispatchPanel is keyed by order id at the parent, so a new order remounts
  // this and re-seeds. "Odśwież" re-seeds from the current draft qty on demand.
  const [subject, setSubject] = useState(() => buildEmailSubject(detail));
  const [body, setBody] = useState(() =>
    buildEmailBody(detail, effQty, empty ? null : totalValuePln),
  );

  const to = detail.supplier_email ?? "";
  const noEmail = !to.trim();

  const { url, tooLong } = buildGmailComposeUrl({ to, subject, body });
  const canOpenGmail = !noEmail && !empty && !tooLong;

  return (
    <div className="space-y-3 text-sm">
      {noEmail && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {t("manager.noEmail")}
        </p>
      )}

      {/* To */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">{t("manager.dispatch.emailTo")}</span>
        <span className="font-mono text-slate-800">{to || "—"}</span>
      </div>

      {/* Subject (editable) */}
      <div className="flex items-center gap-2">
        <label className="w-16 shrink-0 text-xs font-semibold text-slate-500" htmlFor="dispatch-subject">
          {t("manager.dispatch.emailSubject")}
        </label>
        <input
          id="dispatch-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
      </div>

      {/* Body (editable textarea) */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-500" htmlFor="dispatch-body">
            {t("manager.dispatch.emailBody")}
          </label>
          <button
            type="button"
            onClick={() => {
              setSubject(buildEmailSubject(detail));
              setBody(buildEmailBody(detail, effQty, empty ? null : totalValuePln));
            }}
            className="text-[11px] text-blue-700 underline hover:text-blue-900"
          >
            {t("manager.refresh")}
          </button>
        </div>
        <textarea
          id="dispatch-body"
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
      </div>

      {tooLong && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {t("manager.urlTooLong")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Real <a> — clicking opens Gmail AND fires the dispatch state-write.
            We do NOT preventDefault so the browser navigates the link normally;
            window.open is deliberately avoided (popup blockers). */}
        {canOpenGmail && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (!busy) onDispatch("email");
            }}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            {t("manager.openGmail")}
          </a>
        )}
        <button
          type="button"
          onClick={() => onCopy(body)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {t("manager.copyBody")}
        </button>
        {!noEmail && (
          <button
            type="button"
            onClick={() => onCopy(to)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {t("manager.copyAddress")}
          </button>
        )}
      </div>

      {empty && <p className="text-xs font-semibold text-amber-700">{t("manager.emptyOrder")}</p>}
    </div>
  );
}

// --- phone channel ---------------------------------------------------------

interface PhoneDispatchProps {
  detail: ManagerOrderDetail;
  listText: string;
  markOrderedButton: ReactNode;
  copyListButton: ReactNode;
  emptyNote: ReactNode;
}

function PhoneDispatch({
  detail,
  listText,
  markOrderedButton,
  copyListButton,
  emptyNote,
}: PhoneDispatchProps) {
  const { t } = useT();
  const phone = parsePhone(detail.supplier_notes ?? "");

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-700">{t("manager.phoneNote", { supplier: detail.supplier_name })}</p>
      <div className="text-slate-800">
        {phone ? (
          <a href={`tel:${phone}`} className="font-semibold text-blue-700 underline hover:text-blue-900">
            ☎ {phone}
          </a>
        ) : (
          <span className="text-xs italic text-amber-700">{t("manager.phoneMissing")}</span>
        )}
      </div>
      <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">{listText}</pre>
      <div className="flex flex-wrap items-center gap-2">
        {copyListButton}
        {markOrderedButton}
      </div>
      {emptyNote}
    </div>
  );
}
