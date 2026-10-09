// Channel-aware dispatch panel (Phase G3). Branches on detail.ordering_method:
//   email  → editable subject + textarea body + "Podpis" select. Primary:
//            "Zrób draft w Gmailu" creates a VERIFIED draft in the order
//            mailbox with From = the location alias (lib/orderEmailDraft.ts),
//            then dispatches (order-email-v2). Fallback: Gmail URL built IN TS
//            from the EDITED text; 8000-char check hides "Otwórz w Gmail";
//            clicking the link ALSO fires the dispatch state-write. Copy body /
//            address.
//   portal → no email; portal link parsed from supplier_notes (never hardcoded),
//            copy-paste list, "Oznacz jako zamówione ✓" behind a two-step
//            confirm ("czy na pewno złożyłeś zamówienie w portalu?") so a
//            mis-click can't mark an order sent that was never placed.
//   phone  → number from supplier_notes (tel: link if parseable), copy list,
//            "Oznacz jako zamówione ✓".
//   manual → info note + "Oznacz jako zamówione ✓".
//   transport → NO control at all: an amber notice + a link to the Transport
//            screen. Such a supplier (Pago) is ordered only as part of a
//            Manager Transport batch. The branch must never render an e-mail
//            composer, because the Gmail link opens a prefilled compose window
//            BEFORE the dispatch API call — a server-side 409 cannot recall a
//            mail already open in the operator's browser.
//
// Dispatch payload is ALWAYS built from the current draft effective quantities
// (full line set, non-empty) by the parent. sent_method maps 1:1 from
// ordering_method for the four dispatchable channels; `transport` has no
// per-order sent_method because its branch never calls onDispatch. Dispatch is
// blocked when every effective line qty is 0.

import { useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { useT } from "../../i18n";
import { compareProductOrder } from "../../lib/productOrder";
import type { ManagerOrderDetail, ManagerOrderLineDetail, OrderingMethod } from "../../types";
import {
  type DraftMap,
  draftQty,
  isOrderEmpty,
} from "./lib/draftState";
import {
  buildEmailBody,
  buildEmailSubject,
  buildGmailComposeUrl,
  copyListQty,
  draftCc,
  fallbackCc,
} from "./lib/emailBody";
import {
  createVerifiedOrderDraft,
  describeDraftError,
  getGoogleClientId,
} from "./lib/orderEmailDraft";
import { splitRecipients } from "./lib/transport";
import { useOrderEmailSigner } from "./lib/useOrderEmailSigner";
import { SignerSelect } from "./SignerSelect";

/** Extra facts about a dispatch the parent needs for its confirmation. */
export interface DispatchOpts {
  /** Set when a verified Gmail draft was created before the dispatch — the
   *  mailbox that now holds it (order-email-v2). */
  draftMailbox?: string;
}

/** Dispatch callback: channel, the chosen e-mail signer (email channel only)
 *  and optional extras. */
export type DispatchHandler = (
  sentMethod: OrderingMethod,
  signerEmail?: string | null,
  opts?: DispatchOpts,
) => void;

interface DispatchPanelProps {
  detail: ManagerOrderDetail;
  drafts: DraftMap;
  /** True while a dispatch is in flight for this order. */
  busy: boolean;
  /** Fire the dispatch state-write with the full draft line set + sent_method. */
  onDispatch: DispatchHandler;
  /** Surface a toast (copy success/failure). */
  onToast: (msg: string, ok: boolean) => void;
  /** Reports a Gmail draft in progress so the page locks every other action
   *  (queue selection, save, release, cancel) until it settles. */
  onDraftingChange?: (drafting: boolean) => void;
}

// Best-effort phone extraction from free-text supplier_notes for a tel: link.
function parsePhone(notes: string): string | null {
  const m = notes.match(/(\+?\d[\d\s().-]{6,}\d)/);
  if (!m) return null;
  const cleaned = m[1].replace(/[^\d+]/g, "");
  return cleaned.length >= 7 ? cleaned : null;
}

// Best-effort portal-URL extraction from free-text supplier_notes. Master data
// carries the URL in the supplier's notes (no dedicated column yet); trailing
// punctuation from prose is stripped.
function parsePortalUrl(notes: string): string | null {
  const m = notes.match(/https?:\/\/[^\s)]+/);
  if (!m) return null;
  return m[0].replace(/[.,;"'\]}]+$/, "");
}

export function DispatchPanel({
  detail,
  drafts,
  busy,
  onDispatch,
  onToast,
  onDraftingChange,
}: DispatchPanelProps) {
  const { t } = useT();
  const method = detail.ordering_method;

  const empty = isOrderEmpty(drafts, detail.lines);
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

  // Plain-text list (Produkt | Ilość | kod) for portal/phone, draft qty > 0,
  // in the canonical supplier order (same as the e-mail and every screen).
  const listText = useMemo(() => {
    const rows = detail.lines
      .filter((ln) => effQty(ln) > 0)
      .sort(compareProductOrder)
      .map((ln) => {
        const code = ln.supplier_product_name || "";
        return `${ln.product_name_pl} | ${copyListQty(ln, effQty(ln))} | ${code}`.replace(/\s*\|\s*$/, "");
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
      transport: "manager.dispatch.transport",
    } as const
  )[method];

  return (
    <div className="border-t border-slate-200 p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t(titleKey)}</h3>

      {method === "email" && (
        <EmailDispatch
          detail={detail}
          effQty={effQty}
          empty={empty}
          busy={busy}
          onDispatch={onDispatch}
          onCopy={copy}
          onDraftingChange={onDraftingChange}
        />
      )}

      {method === "portal" && (
        <PortalDispatch
          detail={detail}
          listText={listText}
          copyListButton={copyListButton}
          emptyNote={emptyNote}
          busy={busy}
          empty={empty}
          onDispatch={onDispatch}
        />
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
          {/* The list is what gets picked in the warehouse (krakow-katowice-rollout:
              Katowice goods from Warsaw are one manual order). */}
          <div className="flex flex-wrap items-center gap-2">
            {markOrderedButton}
            {copyListButton}
          </div>
          {emptyNote}
        </div>
      )}

      {method === "transport" && (
        <div className="space-y-3 text-sm">
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            {t("manager.transportOnlyNote", { supplier: detail.supplier_name })}
          </p>
          <Link
            to="/manager/transport"
            className="inline-block rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {t("manager.transportOnlyLink")}
          </Link>
        </div>
      )}
    </div>
  );
}

// --- email channel ---------------------------------------------------------

interface EmailDispatchProps {
  detail: ManagerOrderDetail;
  effQty: (line: ManagerOrderLineDetail) => number;
  empty: boolean;
  busy: boolean;
  onDispatch: DispatchHandler;
  onCopy: (text: string) => void;
  onDraftingChange?: (drafting: boolean) => void;
}

function EmailDispatch({
  detail,
  effQty,
  empty,
  busy,
  onDispatch,
  onCopy,
  onDraftingChange,
}: EmailDispatchProps) {
  const { t } = useT();
  const { signer, setSignerEmail } = useOrderEmailSigner(detail.email_signers);

  // Seed subject/body from the draft on mount; the manager then edits freely.
  // DispatchPanel is keyed by order id at the parent, so a new order remounts
  // this and re-seeds. "Odśwież" re-seeds from the current draft qty on demand,
  // and so does picking another signer (the signature is in the body).
  const [subject, setSubject] = useState(() => buildEmailSubject(detail));
  const [body, setBody] = useState(() =>
    buildEmailBody(detail, effQty, signer),
  );
  const signerEmail = signer?.email ?? null;

  const to = detail.supplier_email ?? "";
  // "@" check (not bare non-empty): master data used placeholders like 'TBD'
  // as the email value — those must surface the noEmail banner, not a dead
  // recipient in a normal-looking Gmail draft. Mirrors the backend gate.
  const noEmail = !to.includes("@");

  // DW (CC) for the compose-link path — the standing office copy + the
  // location's own mailbox, one source of truth shared with the server-side
  // re-open URL (main.py `_join_cc`). The "@" gate mirrors the recipient check
  // (feedback r7) — placeholders like 'TBD' are dropped by joinCc.
  const cc = fallbackCc(detail);

  const { url, tooLong } = buildGmailComposeUrl({ to, subject, body, cc });
  const canOpenGmail = !noEmail && !empty && !tooLong;

  // Verified Gmail draft (order-email-v2): offered when the OAuth client is
  // configured and the backend named the mailbox + sender. The compose link
  // above stays as the fallback.
  const clientId = getGoogleClientId();
  const mailbox = (detail.order_mailbox ?? "").trim();
  const sender = (detail.sender_email ?? "").trim();
  const draftAvailable = Boolean(clientId && mailbox && sender);
  const ccDraft = draftCc(detail);
  // DW shown for the primary path: the draft's when available, else the link's.
  const ccShown = draftAvailable ? ccDraft : cc;
  const hasCcShown = ccShown.includes("@");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const canDraft = draftAvailable && !noEmail && !empty && !busy && !drafting;

  const handleDraft = async (): Promise<void> => {
    if (!canDraft) return;
    setDraftError(null);
    setDrafting(true);
    onDraftingChange?.(true);
    try {
      // First call of the handler — it opens the Google popup synchronously.
      await createVerifiedOrderDraft({
        clientId,
        mailbox,
        from: { name: detail.location_name, email: sender },
        to: splitRecipients(to).join(","),
        cc: ccDraft,
        subject,
        body,
      });
      // Only a verified draft marks the order sent (draft first, then dispatch).
      onDispatch("email", signerEmail, { draftMailbox: mailbox });
    } catch (e) {
      setDraftError(describeDraftError(e, t, { mailbox, sender }));
    } finally {
      setDrafting(false);
      onDraftingChange?.(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      {noEmail && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {t("manager.noEmail")}
        </p>
      )}

      {/* From — the location's send-as alias of the order mailbox. */}
      {draftAvailable && (
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">
            {t("manager.dispatch.emailFrom")}
          </span>
          <span className="font-mono text-slate-800">
            {detail.location_name} &lt;{sender}&gt;
          </span>
        </div>
      )}

      {/* To */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">{t("manager.dispatch.emailTo")}</span>
        <span className="font-mono text-slate-800">{to || "—"}</span>
      </div>

      {/* DW (CC) — the office copy that rides on every order email. Rendered only
          when configured, so an empty setting leaves the panel exactly as before. */}
      {hasCcShown && (
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">
            {t("manager.dispatch.emailCc")}
          </span>
          <span className="font-mono text-slate-800">{ccShown.split(",").join(", ")}</span>
        </div>
      )}

      <SignerSelect
        id="dispatch-signer"
        signers={detail.email_signers}
        value={signer}
        disabled={busy}
        onChange={(email) => {
          const next = setSignerEmail(email);
          setSubject(buildEmailSubject(detail));
          setBody(buildEmailBody(detail, effQty, next));
        }}
      />

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
              setBody(buildEmailBody(detail, effQty, signer));
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
        {draftAvailable && (
          <button
            type="button"
            disabled={!canDraft}
            onClick={() => void handleDraft()}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            {drafting || busy ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                {t("manager.draft.working")}
              </span>
            ) : (
              t("manager.draft.create")
            )}
          </button>
        )}
        {/* Real <a> — clicking opens Gmail AND fires the dispatch state-write.
            We do NOT preventDefault so the browser navigates the link normally;
            window.open is deliberately avoided (popup blockers). While a draft
            is being created or a dispatch is in flight it is inert (no href),
            so it cannot open a stray compose window or dispatch twice. */}
        {canOpenGmail &&
          (drafting || busy ? (
            <span
              aria-disabled="true"
              className="cursor-not-allowed rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-400"
            >
              {t("manager.openGmail")}
            </span>
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (!busy) onDispatch("email", signerEmail);
              }}
              className={
                draftAvailable
                  ? "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  : "rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              }
            >
              {t("manager.openGmail")}
            </a>
          ))}
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

      {draftError && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800"
        >
          {draftError}
        </p>
      )}
      {draftAvailable && canOpenGmail && (
        <p className="text-[11px] text-slate-500">
          {t("manager.draft.fallbackHint", { office: detail.cc_email || "—" })}
        </p>
      )}

      {empty && <p className="text-xs font-semibold text-amber-700">{t("manager.emptyOrder")}</p>}
    </div>
  );
}

// --- portal channel --------------------------------------------------------

interface PortalDispatchProps {
  detail: ManagerOrderDetail;
  listText: string;
  copyListButton: ReactNode;
  emptyNote: ReactNode;
  busy: boolean;
  empty: boolean;
  onDispatch: DispatchHandler;
}

function PortalDispatch({
  detail,
  listText,
  copyListButton,
  emptyNote,
  busy,
  empty,
  onDispatch,
}: PortalDispatchProps) {
  const { t } = useT();
  const portalUrl = parsePortalUrl(detail.supplier_notes ?? "");
  // Two-step confirm: the manager must assert the order WAS placed in the
  // portal before the state-write fires (owner request — no accidental
  // "marked sent" for an order nobody placed).
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-700">{t("manager.portalNote", { supplier: detail.supplier_name })}</p>
      <div className="flex items-center gap-2">
        {portalUrl ? (
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {t("manager.openPortal")} ↗
          </a>
        ) : (
          <span className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {t("manager.portalUrlTbd")}
          </span>
        )}
      </div>
      <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">{listText}</pre>
      {confirming ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">{t("manager.portalConfirmQ")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || empty}
              onClick={() => onDispatch("portal")}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            >
              {busy ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  {t("manager.action.working")}
                </span>
              ) : (
                t("manager.portalConfirmYes")
              )}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {t("manager.portalConfirmNo")}
            </button>
            {copyListButton}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {copyListButton}
          <button
            type="button"
            disabled={busy || empty}
            onClick={() => setConfirming(true)}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            {t("manager.markOrdered")}
          </button>
        </div>
      )}
      {emptyNote}
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
