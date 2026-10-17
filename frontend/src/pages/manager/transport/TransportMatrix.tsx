// Editable product x location matrix for a DRAFT Transport batch (v2,
// to-ordering-pago ADDENDUM v2). Columns = locations; a batch can hold two
// orders from one location (create has no per-location dedupe), and they share
// one column (transport-location-columns, D10 A): the header names the
// location once with "zam. 1", "zam. 2" (one remove button each), and a cell
// stacks one input per order carrying the product plus a "razem" total. Each
// input still writes its own order line, so drafts and saves stay per order;
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
//
// A cell the Manager zeroed while the captain asked for more is amber and
// struck through, read-only and editable — the same convention as the order
// table (manager-queue-control, D10 A). A line the Manager added at 0 has a
// captain qty of 0 and stays plain.

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { useT } from "../../../i18n";
import { DecimalInput } from "../../../components/ui/DecimalInput";
import { roundQty } from "../../../components/ui/number";
import { AddProductPicker } from "../../../components/ui/AddProductPicker";
import type { OrderableItem, TransportBatchOrder } from "../../../types";
import {
  buildTransportAddAllOptions,
  buildTransportMatrix,
  draftQtyFor,
  groupTransportColumns,
  orderAddOneOptions,
  type TransportDraftMap,
  type TransportLocationColumn,
} from "../lib/transport";
import {
  lineVisualStateWithQty,
  MANAGER_ZERO_INPUT_CLASS,
  MANAGER_ZERO_TEXT_CLASS,
} from "../lib/managerLine";

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
  // `label` names the target for toasts and confirms: the location, or
  // "Ken, zam. 2" when the location has more than one order in the batch.
  onAddProductOne: (order: TransportBatchOrder, item: OrderableItem, label: string) => void;
  addAllBusy: boolean;
  onRemoveOrder: (order: TransportBatchOrder, label: string) => void;
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
  const { t, tPlural } = useT();
  const rows = buildTransportMatrix(orders);
  const columns: TransportLocationColumn[] = groupTransportColumns(orders);
  const addAllOptions = editable ? buildTransportAddAllOptions(orders, orderableByOrderId) : [];
  const [addOneLocationId, setAddOneLocationId] = useState<string>("");
  const addOneColumn: TransportLocationColumn | undefined =
    columns.find((c) => c.location_id === addOneLocationId) ?? columns[0];
  // A one-location add lands on the location's first order; products any of
  // the location's orders already carry are left out, so a merged column
  // never gets a second line for the same product.
  const addOneOrder: TransportBatchOrder | undefined = addOneColumn?.orders[0];
  const addOneOptions: OrderableItem[] =
    editable && addOneColumn && addOneOrder
      ? orderAddOneOptions(addOneOrder, orderableByOrderId).filter(
          (item) =>
            !addOneColumn.orders.some((o) => o.lines.some((l) => l.product_id === item.product_id)),
        )
      : [];

  const labelFor = (col: TransportLocationColumn, orderNo: number): string =>
    col.orders.length > 1
      ? t("manager.transport.matrix.locationOrder", { location: col.location_name, n: orderNo })
      : col.location_name;

  const removeButton = (
    col: TransportLocationColumn,
    order: TransportBatchOrder,
    orderNo: number | null,
  ) => (
    <button
      type="button"
      disabled={busyOrderId === order.order_id}
      onClick={() => onRemoveOrder(order, labelFor(col, orderNo ?? 1))}
      aria-label={
        orderNo === null
          ? t("manager.transport.matrix.removeColumnAria", { location: order.location_name })
          : t("manager.transport.matrix.removeOrderAria", {
              location: order.location_name,
              n: orderNo,
            })
      }
      className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
    >
      {busyOrderId === order.order_id ? (
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
      ) : (
        <X size={14} aria-hidden="true" />
      )}
    </button>
  );

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
              {columns.map((col) => {
                const multi = col.orders.length > 1;
                return (
                  <th
                    key={col.location_id}
                    className="text-right font-semibold px-3 py-2 whitespace-nowrap align-top"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{col.location_name}</span>
                      {editable && !multi && removeButton(col, col.orders[0], null)}
                    </div>
                    {multi && (
                      <div
                        className="mt-0.5 flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-[11px] font-normal text-amber-700"
                        data-testid={`orders-at-${col.location_id}`}
                      >
                        <span>
                          {tPlural("manager.transport.matrix", "ordersAtLocation", col.orders.length)}
                        </span>
                        {col.orders.map((o, i) => (
                          <span
                            key={o.order_id}
                            className="inline-flex items-center gap-0.5 text-slate-500"
                            title={o.order_id}
                          >
                            {t("manager.transport.matrix.orderTag", { n: i + 1 })}
                            {editable && removeButton(col, o, i + 1)}
                          </span>
                        ))}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.product_id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  {row.product_name_pl}
                  <span className="ml-1 text-xs text-slate-400">{row.purchase_unit}</span>
                </td>
                {columns.map((col) => {
                  const multi = col.orders.length > 1;
                  const entries = col.orders.flatMap((order, i) => {
                    const line = row.linesByOrderId[order.order_id];
                    return line ? [{ order, line, orderNo: i + 1 }] : [];
                  });
                  if (entries.length === 0) {
                    // "+" only for a product on the location's list — a one-off
                    // outside it goes through the picker's checkbox step. With
                    // two orders it adds to the first one that can take it.
                    let addTarget: TransportBatchOrder | undefined;
                    let addTargetNo = 1;
                    let addable: OrderableItem | undefined;
                    if (editable) {
                      for (const [i, order] of col.orders.entries()) {
                        addable = (orderableByOrderId[order.order_id] ?? []).find(
                          (o) =>
                            o.product_id === row.product_id &&
                            o.configured_for_location !== false,
                        );
                        if (addable) {
                          addTarget = order;
                          addTargetNo = i + 1;
                          break;
                        }
                      }
                    }
                    return (
                      <td key={col.location_id} className="px-3 py-2 text-right text-slate-300">
                        {addable && addTarget ? (
                          <button
                            type="button"
                            disabled={addAllBusy}
                            onClick={() =>
                              onAddProductOne(addTarget, addable, labelFor(col, addTargetNo))
                            }
                            aria-label={t("manager.transport.matrix.addCellAria", {
                              product: row.product_name_pl,
                              location: labelFor(col, addTargetNo),
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
                  const cells = entries.map((e) => {
                    const qty = draftQtyFor(drafts, e.order.order_id, e.line);
                    const zeroed =
                      lineVisualStateWithQty(e.line.captain_final_qty_purchase, qty) ===
                      "cancelled";
                    return { ...e, qty, zeroed };
                  });
                  const anyZeroed = cells.some((c) => c.zeroed);
                  const total = cells.reduce((sum, c) => sum + c.qty, 0);
                  return (
                    <td
                      key={col.location_id}
                      className={`px-3 py-2 text-right ${anyZeroed ? "bg-amber-50" : ""}`}
                      data-zeroed={anyZeroed || undefined}
                    >
                      <div className="flex flex-col items-end gap-1">
                        {cells.map((c) => (
                          <div key={c.order.order_id} className="flex items-center justify-end gap-1">
                            {multi && (
                              <span className="text-[11px] text-slate-500" title={c.order.order_id}>
                                {t("manager.transport.matrix.orderTag", { n: c.orderNo })}
                              </span>
                            )}
                            {editable ? (
                              <DecimalInput
                                value={c.qty}
                                onChange={(v) =>
                                  onQtyChange(c.order.order_id, c.line.order_line_id, v === "" ? 0 : v)
                                }
                                aria-label={
                                  multi
                                    ? t("manager.transport.matrix.qtyOrderAria", {
                                        product: row.product_name_pl,
                                        location: col.location_name,
                                        n: c.orderNo,
                                      })
                                    : t("manager.transport.matrix.qtyAria", {
                                        product: row.product_name_pl,
                                        location: col.location_name,
                                      })
                                }
                                data-mx-col={col.location_id}
                                // Enter = hop to the next input DOWN the
                                // location's column (operator request v5.2:
                                // fast keyboard entry). Inputs are visited in
                                // document order, so stacked inputs of a
                                // merged column come one after another and
                                // "–" rows are skipped. Selects the target's
                                // text so typing overwrites. No-op on the last.
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  const root = e.currentTarget.closest("table");
                                  if (!root) return;
                                  const column = Array.from(
                                    root.querySelectorAll<HTMLInputElement>(
                                      `input[data-mx-col="${col.location_id}"]`,
                                    ),
                                  );
                                  const target = column[column.indexOf(e.currentTarget) + 1];
                                  if (target) {
                                    target.focus();
                                    target.select();
                                  }
                                }}
                                className={`w-20 rounded border px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  c.zeroed ? MANAGER_ZERO_INPUT_CLASS : "border-gray-300"
                                }`}
                              />
                            ) : (
                              <span
                                className={`tabular-nums ${c.zeroed ? MANAGER_ZERO_TEXT_CLASS : ""}`}
                              >
                                {c.qty}
                              </span>
                            )}
                          </div>
                        ))}
                        {cells.length > 1 && (
                          <div
                            className="text-[11px] font-semibold text-slate-600 tabular-nums"
                            data-testid={`cell-total-${col.location_id}-${row.product_id}`}
                          >
                            {t("manager.transport.matrix.cellTotal", { qty: roundQty(total) })}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {editable && addAllOptions.length > 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-2">
                  <AddProductPicker
                    items={addAllOptions}
                    disabled={addAllBusy}
                    onSelect={(item) => onAddProductAll(item.product_id)}
                  />
                </td>
              </tr>
            )}
            {editable && addOneColumn && addOneOrder && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-600">
                      {t("manager.transport.matrix.addOneLabel")}
                    </span>
                    <select
                      value={addOneColumn.location_id}
                      onChange={(e) => setAddOneLocationId(e.target.value)}
                      aria-label={t("manager.transport.matrix.addOneLocationAria")}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {columns.map((c) => (
                        <option key={c.location_id} value={c.location_id}>
                          {c.location_name}
                        </option>
                      ))}
                    </select>
                    <AddProductPicker
                      items={addOneOptions}
                      disabled={addAllBusy}
                      onSelect={(item) =>
                        onAddProductOne(addOneOrder, item, labelFor(addOneColumn, 1))
                      }
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
