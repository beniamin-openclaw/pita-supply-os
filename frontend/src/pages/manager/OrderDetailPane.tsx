// Right pane of the Manager v2 two-pane shell.
// Header band + per-line table + manager summary strip + actions.
//
// G2: the table is EDITABLE when status === manager_claimed. Draft state +
//     dirty tracking live in ManagerPage; this pane renders the inputs and the
//     sticky "Zapisz zmiany" affordance.
// G3: the F3 dispatch button is replaced by the channel-aware DispatchPanel
//     (email / portal / phone / manual) — rendered only when claimed.

import { Loader2 } from "lucide-react";

import { useT } from "../../i18n";
import type { ManagerOrderDetail, OrderingMethod } from "../../types";
import { statusVisual } from "../captain-mp/lib/orderStatus";
import { DispatchPanel } from "./DispatchPanel";
import { OrderLineTable } from "./OrderLineTable";
import { type DraftMap, draftQty, hasDirtyDrafts } from "./lib/draftState";
import { managerSummary } from "./lib/managerLine";

// Kept out of the component body so the impure `Date.now()` read isn't treated
// as render-time work by the React Compiler. cutoff_iso lives on the queue
// item, not on ManagerOrderDetail, so it is passed in from the parent.
function isCutoffPast(cutoffIso?: string | null): boolean {
  return cutoffIso != null && new Date(cutoffIso).getTime() < Date.now();
}

interface OrderDetailPaneProps {
  /** Currently selected order id (so we can show a loading state per-id). */
  selectedId: string | null;
  detail: ManagerOrderDetail | null;
  /** True while the detail for `selectedId` is being fetched. */
  loading: boolean;
  /** Order id currently running an action (claim/release/dispatch/save), or null. */
  busyId: string | null;
  /** cutoff_iso from the selected queue item — not carried by ManagerOrderDetail. */
  cutoffIso?: string | null;
  /** Compose URL from a dispatch done this session — clickable on a sent order. */
  dispatchedEmailUrl?: string | null;
  /** Live per-line draft state (qty + comment), keyed by order_line_id. */
  drafts: DraftMap;
  onClaim: (orderId: string) => void;
  onRelease: (orderId: string) => void;
  /** Save (PATCH) the dirty draft lines without dispatching. */
  onSave: (orderId: string) => void;
  /** Dispatch with the full draft line set + the channel sent_method. */
  onDispatch: (orderId: string, sentMethod: OrderingMethod) => void;
  onQtyChange: (orderLineId: string, qty: number) => void;
  onCommentChange: (orderLineId: string, comment: string) => void;
  onToast: (msg: string, ok: boolean) => void;
}

export function OrderDetailPane({
  selectedId,
  detail,
  loading,
  busyId,
  cutoffIso,
  dispatchedEmailUrl,
  drafts,
  onClaim,
  onRelease,
  onSave,
  onDispatch,
  onQtyChange,
  onCommentChange,
  onToast,
}: OrderDetailPaneProps) {
  const { t, formatDateTime } = useT();

  if (!selectedId) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        {t("manager.selectOrder")}
      </div>
    );
  }

  if (loading || !detail) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">
        <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
        {t("manager.detailLoading")}
      </div>
    );
  }

  const visual = statusVisual(detail.status);
  const cutoffPast = isCutoffPast(cutoffIso);
  const editable = detail.status === "manager_claimed";
  // Dispatched orders are the only ones where a persisted manager_final 0 means
  // a deliberately-dropped line; before that, 0 = "not set yet" → neutral.
  const dispatched = detail.status === "manager_sent" || detail.status === "closed";
  // Summary + Δ axes use the live draft when editable, else the persisted line.
  const summary = editable
    ? managerSummary(detail.lines, (line) => draftQty(drafts, line))
    : managerSummary(detail.lines, undefined, dispatched);
  const dirty = editable && hasDirtyDrafts(drafts, detail.lines);
  const busy = busyId === detail.order_id;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Header band */}
      <div className="border-b border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-slate-900">
              {detail.location_name} → {detail.supplier_name}
            </span>
            <span className="font-mono text-[11px] text-slate-400">{detail.order_id}</span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${visual.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${visual.dot}`} aria-hidden="true" />
            {t(visual.labelKey)}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {detail.captain_submitted_at && (
            <span>
              {t("manager.detail.submitted", {
                value: formatDateTime(detail.captain_submitted_at),
              })}
            </span>
          )}
          {cutoffIso && (
            <span className={cutoffPast ? "font-semibold text-red-700" : undefined}>
              {t(cutoffPast ? "manager.detail.cutoffPast" : "manager.detail.cutoff", {
                value: formatDateTime(cutoffIso),
              })}
            </span>
          )}
          {detail.requested_delivery_date && (
            <span>
              {t("manager.detail.delivery", { value: detail.requested_delivery_date })}
            </span>
          )}
        </div>

        {detail.notes && detail.notes.trim() !== "" && (
          <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
            <span className="font-semibold">{t("manager.detail.notesLabel")}: </span>
            {detail.notes}
          </div>
        )}
      </div>

      {/* Per-line table */}
      <div className="p-4">
        <OrderLineTable
          lines={detail.lines}
          editable={editable}
          dispatched={dispatched}
          drafts={drafts}
          onQtyChange={onQtyChange}
          onCommentChange={onCommentChange}
        />

        {/* Manager summary strip + sticky save affordance */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-medium text-slate-700">
            {summary.changeCount > 0
              ? t("manager.managerSummary", {
                  changes: summary.changeCount,
                  value: (summary.valueDeltaPln >= 0 ? "+" : "") + summary.valueDeltaPln.toFixed(2),
                })
              : t("manager.managerSummaryNone")}
          </div>
          {editable && dirty && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSave(detail.order_id)}
              className="sticky bottom-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {busy ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  {t("manager.saving")}
                </span>
              ) : (
                t("manager.save")
              )}
            </button>
          )}
        </div>
      </div>

      {/* Actions / dispatch */}
      {detail.status === "captain_submitted" ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-4">
          {busy ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {t("manager.action.working")}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onClaim(detail.order_id)}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {t("manager.action.claim")}
            </button>
          )}
        </div>
      ) : editable ? (
        <>
          {/* Release stays available alongside the channel-aware dispatch panel. */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => onRelease(detail.order_id)}
              className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              {t("manager.action.release")}
            </button>
          </div>
          <DispatchPanel
            key={detail.order_id}
            detail={detail}
            drafts={drafts}
            busy={busy}
            onDispatch={(sentMethod) => onDispatch(detail.order_id, sentMethod)}
            onToast={onToast}
          />
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-4">
          {dispatchedEmailUrl ? (
            <a
              href={dispatchedEmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-green-400 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            >
              {t("manager.action.openEmail")}
            </a>
          ) : (
            <span className="text-xs text-slate-500">{t(visual.labelKey)}</span>
          )}
        </div>
      )}
    </div>
  );
}
