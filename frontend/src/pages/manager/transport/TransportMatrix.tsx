// Editable product x location matrix for a DRAFT Transport batch (v2,
// to-ordering-pago ADDENDUM v2). Columns = member orders (one per location);
// rows = the union of products across every order's full lines
// (lib/transport.ts's buildTransportMatrix). A cell shows the order's
// effective qty for that product (manager_final if > 0 else captain_final)
// and is editable via DecimalInput — editing sets the draft's manager_final,
// saved later through the existing managerSave read-modify-write contract
// (one call per dirty order, built by transportDirtySavePayloads).
//
// Below the table: one strip per member order with an "add product" picker
// (AddProductPicker, fed by that order's own orderable list minus what it
// already carries) and — while editable — a remove-order control in the
// column header.

import { Loader2, X } from "lucide-react";

import { useT } from "../../../i18n";
import { DecimalInput } from "../../../components/ui/DecimalInput";
import { AddProductPicker } from "../../../components/ui/AddProductPicker";
import type { OrderableItem, TransportBatchOrder } from "../../../types";
import { buildTransportMatrix, draftQtyFor, type TransportDraftMap } from "../lib/transport";

interface TransportMatrixProps {
  orders: TransportBatchOrder[];
  editable: boolean;
  drafts: TransportDraftMap;
  onQtyChange: (orderId: string, orderLineId: string, qty: number) => void;
  orderableByOrderId: Record<string, OrderableItem[]>;
  onAddProduct: (orderId: string, productId: string, supplierProductId: string) => void;
  onRemoveOrder: (order: TransportBatchOrder) => void;
  busyOrderId: string | null;
}

export function TransportMatrix({
  orders,
  editable,
  drafts,
  onQtyChange,
  orderableByOrderId,
  onAddProduct,
  onRemoveOrder,
  busyOrderId,
}: TransportMatrixProps) {
  const { t } = useT();
  const rows = buildTransportMatrix(orders);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">
        {t("manager.transport.matrix.title")}
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
            {rows.map((row) => (
              <tr key={row.product_id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  {row.product_name_pl}
                  <span className="ml-1 text-xs text-slate-400">{row.purchase_unit}</span>
                </td>
                {orders.map((order) => {
                  const line = row.linesByOrderId[order.order_id];
                  if (!line) {
                    return (
                      <td key={order.order_id} className="px-3 py-2 text-right text-slate-300">
                        {t("manager.transport.matrix.emptyCell")}
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
          </tbody>
        </table>
      </div>

      {editable && (
        <>
          <div className="mb-2 text-xs text-slate-500">{t("manager.transport.matrix.zeroHint")}</div>
          <div className="flex flex-wrap gap-2">
            {orders.map((order) => {
              const present = new Set(order.lines.map((l) => l.product_id));
              const available = (orderableByOrderId[order.order_id] ?? []).filter(
                (o) => !present.has(o.product_id),
              );
              return (
                <div key={order.order_id} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">{order.location_name}:</span>
                  <AddProductPicker
                    items={available}
                    disabled={busyOrderId === order.order_id}
                    onSelect={(item) => onAddProduct(order.order_id, item.product_id, item.supplier_product_id)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
