// Per-line review table for the Manager v2 detail pane.
// Renders all columns from spec §4: both deviation axes (Δ vs sug. = captain
// vs algorithm, Δ vs punkt = manager vs captain).
//
// G2: "Manager zamawia" + "Komentarz mgr" are EDITABLE when `editable` is true
// (status === manager_claimed). The Δ vs punkt + row coloring reflect the live
// DRAFT value, not the persisted line. Read-only columns stay read-only; when
// not editable the table renders the persisted line exactly as in G1.

import { AlertOctagon } from "lucide-react";

import { useT } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import type { ManagerOrderLineDetail, ReasonCode } from "../../types";
import {
  type DraftMap,
  MANAGER_COMMENT_MAX,
  draftComment,
  draftQty,
} from "./lib/draftState";
import {
  deltaVsCaptain,
  deltaVsCaptainWithQty,
  effectiveManagerQtyPurchase,
  lineVisualState,
  lineVisualStateWithQty,
} from "./lib/managerLine";
import { DecimalInput } from "../captain-mp/components/DecimalInput";

function reasonLabelKey(code: ReasonCode): StringKey {
  return `reason.codes.${code}` as StringKey;
}

function formatPct(fraction: number): string {
  const pct = Math.round(fraction * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

interface OrderLineTableProps {
  lines: ManagerOrderLineDetail[];
  /** When true, qty + comment cells are inputs (status === manager_claimed). */
  editable?: boolean;
  /**
   * True only once the order was dispatched (manager_sent / closed). Gates the
   * read-only "cancelled" (strike + amber) visual: a persisted manager_final 0
   * means "line dropped" only after dispatch — before that it's "not set yet".
   */
  dispatched?: boolean;
  /** Live draft state keyed by order_line_id; required when `editable`. */
  drafts?: DraftMap;
  onQtyChange?: (orderLineId: string, qty: number) => void;
  onCommentChange?: (orderLineId: string, comment: string) => void;
}

export function OrderLineTable({
  lines,
  editable = false,
  dispatched = false,
  drafts,
  onQtyChange,
  onCommentChange,
}: OrderLineTableProps) {
  const { t } = useT();

  const headers: StringKey[] = [
    "manager.col.product",
    "manager.col.unit",
    "manager.col.stock",
    "manager.col.target",
    "manager.col.suggestion",
    "manager.col.captainWants",
    "manager.col.deltaVsSuggestion",
    "manager.col.managerOrders",
    "manager.col.deltaVsCaptain",
    "manager.col.managerComment",
    "manager.col.captainComment",
  ];

  // Effective qty for a line: live draft when editing, else persisted effective.
  const effQty = (line: ManagerOrderLineDetail): number =>
    editable && drafts ? draftQty(drafts, line) : effectiveManagerQtyPurchase(line);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-600">
            {headers.map((key) => (
              <th key={key} className="px-3 py-2 font-semibold whitespace-nowrap">
                {t(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const managerQty = effQty(line);
            const captainQty = line.captain_final_qty_purchase;
            // Editable: draft-driven (qty 0 = cancelled even pre-save). Read-only:
            // persisted-line semantics (preserves G1 sent-order cancellation read).
            const visual =
              editable && drafts
                ? lineVisualStateWithQty(captainQty, managerQty)
                : lineVisualState(line, dispatched);
            const dvc =
              editable && drafts
                ? deltaVsCaptainWithQty(captainQty, managerQty)
                : deltaVsCaptain(line);
            const rowBg =
              visual === "cancelled"
                ? "bg-amber-50"
                : visual === "changed"
                  ? "bg-blue-50"
                  : "bg-white";
            const qtyStrike = visual === "cancelled" ? "line-through text-amber-700" : "";
            const commentValue = editable && drafts ? draftComment(drafts, line) : line.manager_comment;

            return (
              <tr
                key={line.order_line_id}
                className={`border-b border-slate-100 align-top ${rowBg}`}
              >
                {/* Produkt + critical red dot */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 font-medium text-slate-900">
                    {line.is_critical && (
                      <AlertOctagon
                        size={13}
                        className="shrink-0 text-red-600"
                        aria-label={t("manager.criticalTooltip")}
                      />
                    )}
                    <span>{line.product_name_pl}</span>
                  </div>
                </td>

                {/* Jedn. — purchase unit; inventory + ratio in tooltip */}
                <td
                  className="px-3 py-2 whitespace-nowrap text-slate-700"
                  title={t("manager.unitTooltip", {
                    purchase: line.purchase_unit,
                    ratio: line.units_per_purchase_unit,
                    inventory: line.inventory_unit,
                  })}
                >
                  {line.purchase_unit}
                </td>

                {/* Stan (base / inventory unit) */}
                <td className="px-3 py-2 whitespace-nowrap tabular-nums text-slate-700">
                  {line.current_stock_qty_base} {line.inventory_unit}
                </td>

                {/* Cel */}
                <td className="px-3 py-2 whitespace-nowrap tabular-nums text-slate-700">
                  {line.target_stock_qty_base}
                </td>

                {/* Sugestia (algorithm) */}
                <td
                  className="px-3 py-2 whitespace-nowrap tabular-nums text-slate-700"
                  title={`${line.suggested_qty_base} ${line.inventory_unit}`}
                >
                  {line.suggested_qty_purchase}
                </td>

                {/* Punkt chce — captain_final */}
                <td className="px-3 py-2 whitespace-nowrap tabular-nums font-semibold text-slate-900">
                  {captainQty}
                </td>

                {/* Δ vs sug. + reason badge (captain's deviation) */}
                <td className="px-3 py-2 whitespace-nowrap">
                  {typeof line.delta_vs_suggestion_pct === "number" &&
                  Math.abs(line.delta_vs_suggestion_pct) >= 0.005 ? (
                    <span
                      className={`font-semibold tabular-nums ${
                        line.delta_vs_suggestion_pct > 0 ? "text-orange-700" : "text-red-700"
                      }`}
                    >
                      {formatPct(line.delta_vs_suggestion_pct)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                  {line.reason_code && (
                    <span
                      className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                      title={t(reasonLabelKey(line.reason_code))}
                    >
                      {t(reasonLabelKey(line.reason_code))}
                    </span>
                  )}
                </td>

                {/* Manager zamawia — editable number stepper in G2 (else read-only) */}
                <td className={`px-3 py-2 whitespace-nowrap tabular-nums font-bold ${editable ? "" : qtyStrike}`}>
                  {editable ? (
                    <DecimalInput
                      inputMode={
                        line.rounding_rule === "tenth_kg" ||
                        line.rounding_rule === "half_allowed"
                          ? "decimal"
                          : "numeric"
                      }
                      value={managerQty}
                      aria-label={t("manager.qtyInputLabel")}
                      onChange={(v) =>
                        onQtyChange?.(line.order_line_id, typeof v === "number" && v > 0 ? v : 0)
                      }
                      className={`w-20 rounded border border-slate-300 px-2 py-1 text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        visual === "cancelled" ? "border-amber-400 bg-amber-50" : ""
                      }`}
                    />
                  ) : (
                    <span className={qtyStrike}>{managerQty}</span>
                  )}
                </td>

                {/* Δ vs punkt — manager override (client-side, draft-aware) */}
                <td className="px-3 py-2 whitespace-nowrap">
                  {visual === "cancelled" ? (
                    <span className="font-semibold text-amber-700">{t("manager.cancelledLine")}</span>
                  ) : Math.abs(dvc) >= 0.005 ? (
                    <span className="font-semibold tabular-nums text-blue-700">{formatPct(dvc)}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>

                {/* Komentarz mgr — editable short text in G2 (else read-only) */}
                <td className="px-3 py-2 max-w-[200px] text-slate-700">
                  {editable ? (
                    <input
                      type="text"
                      maxLength={MANAGER_COMMENT_MAX}
                      value={commentValue}
                      placeholder={t("manager.commentPlaceholder")}
                      aria-label={t("manager.commentInputLabel")}
                      onChange={(e) => onCommentChange?.(line.order_line_id, e.target.value)}
                      className="w-44 rounded border border-slate-300 px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    />
                  ) : commentValue ? (
                    <span className="line-clamp-2" title={commentValue}>
                      {commentValue}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>

                {/* Komentarz kpt */}
                <td className="px-3 py-2 max-w-[180px] text-slate-600 italic">
                  {line.captain_comment ? (
                    <span className="line-clamp-2" title={line.captain_comment}>
                      {line.captain_comment}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
