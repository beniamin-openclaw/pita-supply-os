// Editable product x location matrix for a DRAFT Transport batch (v2,
// to-ordering-pago ADDENDUM v2). Columns = member orders (one per location);
// rows = the union of products across every order's full lines
// (lib/transport.ts's buildTransportMatrix). A cell shows the order's
// effective qty for that product (manager_final once the Manager set it, an
// explicit 0 included, else captain_final — lib/orderQty.ts) and is editable
// via DecimalInput — editing sets the draft's manager_final,
// saved later through the existing managerSave read-modify-write contract
// (one call per dirty order, built by transportDirtySavePayloads).
//
// Below the table: one strip per member order with an "add product" picker
// (AddProductPicker, fed by that order's own orderable list minus what it
// already carries) and — while editable — a remove-order control in the
// column header.
//
// One-location adds (manager-add-any-product): an empty "–" cell is a "+"
// button when the row's product is on that location's list, and a "for one location
// only" row pairs a location select with a picker over that order's full
// supplier list (one-off items outside the location's list behind the picker's
// checkbox). Both write the line onto that location's order.

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { useT } from "../../../i18n";
import { DecimalInput } from "../../../components/ui/DecimalInput";
import { AddProductPicker } from "../../../components/ui/AddProductPicker";
import type { OrderableItem, TransportBatchOrder } from "../../../types";
import {
  buildTransportAddAllOptions,
  buildTransportMatrix,
  draftQtyFor,
  orderAddOneOptions,
  type TransportDraftMap,
} from "../lib/transport";

interface TransportMatrixProps {
  orders: TransportBatchOrder[];
  // Overrides the default heading — the per-supplier section title when a
  // Pago batch also carries Magazyn Mory (transport-pago-mory-combined).
  title?: string;
  editable: boolean;
  drafts: TransportDraftMap;
  onQtyChange: (orderId: string, orderLineId: string, qty: number) => void;
  orderableByOrderId: Record<string, OrderableItem[]>;
  onAddProductAll: (productId: string) => void;
  onAddProductOne: (order: TransportBatchOrder, item: OrderableItem) => void;
  addAllBusy: boolean;
  onRemoveOrder: (order: TransportBatchOrder) => void;
  busyOrderId: string | null;
}

export function TransportMatrix({
  orders,
  title,
  editable,
  drafts,
  onQtyChange,
  orderableByOrderId,
  onAddProductAll,
  onAddProductOne,
  addAllBusy,
  onRemoveOrder,
  busyOrderId,
}: TransportMatrixProps) {
  const { t } = useT();
  const rows = buildTransportMatrix(orders);
  const addAllOptions = editable ? buildTransportAddAllOptions(orders, orderableByOrderId) : [];
  const [addOneOrderId, setAddOneOrderId] = useState<string>("");
  const addOneOrder: TransportBatchOrder | undefined =
    orders.find((o) => o.order_id === addOneOrderId) ?? orders[0];
  const addOneOptions: OrderableItem[] =
    editable && addOneOrder ? orderAddOneOptions(addOneOrder, orderableByOrderId) : [];

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">
        {title ?? t("manager.transport.matrix.title")}
      </h3>
      <div className="overflow-x-auto mb-2">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-semibold px-3 py-2">
                {t("manager.transport.detail.productCol")}
              </th>
              {orders.map((order) => (
                <th key={order.order_id} className="text-right font-semibold px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{order.location_name}</span>
                    {editable && (
                      <button
                        type="button"
                        disabled={busyOrderId === order.order_id}
                        onClick={() => onRemoveOrder(order)}
                        aria-label={t("manager.transport.matrix.removeColumnAria", {
                          location: order.location_name,
                        })}
                        className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        {busyOrderId === order.order_id ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <X size={14} aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={row.product_id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  {row.product_name_pl}
                  <span className="ml-1 text-xs text-slate-400">{row.purchase_unit}</span>
                </td>
                {orders.map((order) => {
                  const line = row.linesByOrderId[order.order_id];
                  if (!line) {
                    // "+" only for a product on the location's list — a one-off
                    // outside it goes through the picker's checkbox step.
                    const addable = editable
                      ? (orderableByOrderId[order.order_id] ?? []).find(
                          (o) =>
                            o.product_id === row.product_id &&
                            o.configured_for_location !== false,
                        )
                      : undefined;
                    return (
                      <td key={order.order_id} className="px-3 py-2 text-right text-slate-300">
                        {addable ? (
                          <button
                            type="button"
                            disabled={addAllBusy}
                            onClick={() => onAddProductOne(order, addable)}
                            aria-label={t("manager.transport.matrix.addCellAria", {
                              product: row.product_name_pl,
                              location: order.location_name,
                            })}
                            className="inline-flex items-center rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            <Plus size={14} aria-hidden="true" />
                          </button>
                        ) : (
                          t("manager.transport.matrix.emptyCell")
                        )}
                      </td>
                    );
                  }
                  const qty = draftQtyFor(drafts, order.order_id, line);
                  return (
                    <td key={order.order_id} className="px-3 py-2 text-right">
                      {editable ? (
                        <DecimalInput
                          value={qty}
                          onChange={(v) => onQtyChange(order.order_id, line.order_line_id, v === "" ? 0 : v)}
                          aria-label={t("manager.transport.matrix.qtyAria", {
                            product: row.product_name_pl,
                            location: order.location_name,
                          })}
                          data-mx-col={order.order_id}
                          data-mx-row={rowIdx}
                          // Enter = hop to the cell one row BELOW in the same
                          // column (operator request v5.2: fast keyboard entry
                          // down a location's column). Skips "–" rows (a column
                          // without that product renders no input) by probing
                          // successive row indices; selects the target's text
                          // so typing overwrites. No-op on the last cell.
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            const root = e.currentTarget.closest("table");
                            if (!root) return;
                            for (let next = rowIdx + 1; next < rows.length; next++) {
                              const target = root.querySelector<HTMLInputElement>(
                                `input[data-mx-col="${order.order_id}"][data-mx-row="${next}"]`,
                              );
                              if (target) {
                                target.focus();
                                target.select();
                                return;
                              }
                            }
                          }}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="tabular-nums">{qty}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {editable && addAllOptions.length > 0 && (
              <tr>
                <td colSpan={orders.length + 1} className="px-3 py-2">
                  <AddProductPicker
                    items={addAllOptions}
                    disabled={addAllBusy}
                    onSelect={(item) => onAddProductAll(item.product_id)}
                  />
                </td>
              </tr>
            )}
            {editable && addOneOrder && (
              <tr>
                <td colSpan={orders.length + 1} className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-600">
                      {t("manager.transport.matrix.addOneLabel")}
                    </span>
                    <select
                      value={addOneOrder.order_id}
                      onChange={(e) => setAddOneOrderId(e.target.value)}
                      aria-label={t("manager.transport.matrix.addOneLocationAria")}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {orders.map((o) => (
                        <option key={o.order_id} value={o.order_id}>
                          {o.location_name}
                        </option>
                      ))}
                    </select>
                    <AddProductPicker
                      items={addOneOptions}
                      disabled={addAllBusy}
                      onSelect={(item) => onAddProductOne(addOneOrder, item)}
                    />
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editable && (
        <>
          <div className="mb-2 text-xs text-slate-500">{t("manager.transport.matrix.zeroHint")}</div>
        </>
      )}
    </div>
  );
}
