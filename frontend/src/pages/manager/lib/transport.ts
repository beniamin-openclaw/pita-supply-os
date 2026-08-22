// Pure helpers for the Manager Transport ("TO" — combined delivery run) screen
// (to-ordering-pago Phase 3). No fetch here; all I/O lives in apiClient + the
// page component.
//
// Two very different documents come out of one TransportBatchDetail:
//   - the DRIVER list (buildTransportDriverText) — internal, copy/pasted or
//     handed to the driver — carries the per-location breakdown (who gets
//     how much), because the driver needs to know where to drop what.
//   - the SUPPLIER email (buildTransportEmailSubject/Body) — carries
//     per-product TOTALS ONLY. The supplier never sees which location ordered
//     what; splitting deliveries between locations is Pita Bros' own
//     logistics, not the supplier's business (plan: "Driver list stays
//     private"). Keep this asymmetry — do not add per-location detail to the
//     email builder.

import type { StringKey } from "../../../i18n/strings";
import type {
  ManagerOrderLineDetail,
  OrderLineManagerFinal,
  Supplier,
  TransportBatchDetail,
  TransportBatchOrder,
  TransportBatchSummary,
} from "../../../types";
import { buildGmailComposeUrl } from "./emailBody";
import { type DraftMap, dirtySavePayload, draftQty, hasDirtyDrafts } from "./draftState";
import { effectiveManagerQtyPurchase } from "./managerLine";

type TFunc = (key: StringKey, vars?: Record<string, string | number>) => string;

/** Quantity label (mirrors emailBody.ts's formatQty): drop trailing zeros. */
function formatQty(qty: number): string {
  return String(qty);
}

/** ISO datetime/date -> the date part only ("YYYY-MM-DD"), timezone-free so
 * the driver text / email subject stay deterministic regardless of the
 * viewer's locale. "" when absent (a batch with no dispatched member yet). */
function isoDatePart(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/**
 * The PRIVATE driver list: transport id + date, then one block per product —
 * "<produkt> — <total> <jm>." followed by an indented "  <lokal>: <qty> <jm>."
 * line for each location that contributed to it. Never sent to the supplier;
 * copy/clipboard + in-app display only.
 */
export function buildTransportDriverText(detail: TransportBatchDetail, t: TFunc): string {
  const out: string[] = [];
  out.push(t("manager.transport.driverText.header", { id: detail.transport_id, date: isoDatePart(detail.created) }));
  out.push(t("manager.transport.driverText.supplierLine", { supplier: detail.supplier_name }));
  out.push("");

  detail.lines.forEach((line) => {
    out.push(`${line.product_name_pl} — ${formatQty(line.total_qty_purchase)} ${line.purchase_unit}.`);
    line.per_location.forEach((pl) => {
      out.push(`  ${pl.location_name}: ${formatQty(pl.qty_purchase)} ${line.purchase_unit}.`);
    });
    out.push("");
  });

  // Trim the trailing blank line the loop above always leaves.
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

/** Subject: "Zamówienie zbiorcze <supplier> — <date>" (i18n). */
export function buildTransportEmailSubject(detail: TransportBatchDetail, t: TFunc): string {
  return t("manager.transport.email.subject", {
    supplier: detail.supplier_name,
    date: isoDatePart(detail.created),
  });
}

/**
 * The SUPPLIER-facing body: per-product totals only, no per-location
 * breakdown — deliberately parallel to the driver text's opposite discipline.
 * Supplier-facing product name (supplier_product_name) is preferred over the
 * internal product_name_pl, mirroring emailBody.ts's dispatch email.
 */
export function buildTransportEmailBody(detail: TransportBatchDetail, t: TFunc): string {
  const out: string[] = [];
  out.push(t("manager.transport.email.greeting"));
  out.push("");
  out.push(t("manager.transport.email.intro"));
  out.push("");
  out.push(t("manager.transport.email.lineHeader"));

  detail.lines.forEach((line, idx) => {
    const name = line.supplier_product_name || line.product_name_pl;
    out.push(`${idx + 1}. | ${name} | ${formatQty(line.total_qty_purchase)} ${line.purchase_unit}`);
  });

  out.push("");
  out.push(t("manager.transport.email.closing"));
  out.push(t("manager.transport.email.signature"));
  out.push(`(transport #${detail.transport_id})`);

  return out.join("\n");
}

/**
 * Split a possibly comma/semicolon-separated distribution list into trimmed
 * addresses, dropping anything that doesn't carry "@" (placeholders like
 * "TBD" mixed into a list are silently ignored rather than sent to a dead
 * address). Operator decision: supplier.email may hold a distribution list
 * (e.g. Pago's legacy sheet PAGO list) — Gmail's `to` param takes a
 * comma-joined string of all of them.
 */
export function splitRecipients(email: string): string[] {
  return email
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

/** True when `email` holds at least one usable ("@"-carrying) address. Mirrors
 * the backend dispatch gate (main.py's "@" check) so the UI never offers an
 * email draft to a dead/placeholder address. */
export function hasValidRecipient(email?: string | null): boolean {
  if (!email) return false;
  return splitRecipients(email).length > 0;
}

/**
 * Build the Gmail compose URL for the supplier-order email — reuses
 * `buildGmailComposeUrl` (emailBody.ts) rather than duplicating the URL
 * assembly / length-guard logic. `cc` mirrors the standing-office-copy
 * pattern used by the single-order dispatch flow.
 */
export function buildTransportGmailUrl(
  detail: TransportBatchDetail,
  supplier: Supplier,
  t: TFunc,
  cc?: string | null,
): { url: string; tooLong: boolean } {
  const to = splitRecipients(supplier.email ?? "").join(",");
  return buildGmailComposeUrl({
    to,
    subject: buildTransportEmailSubject(detail, t),
    body: buildTransportEmailBody(detail, t),
    cc,
  });
}

// ---- v2 (ADDENDUM v2): draft workstation helpers ---------------------------
//
// A DRAFT batch's member orders carry FULL enriched lines (TransportBatchOrder.
// lines), so the manager can edit qty/comment per product x location cell using
// the SAME read-modify-write machinery as the single-order Manager screen
// (managerSave). The helpers below are pure — no fetch — mirroring lib/draftState.ts
// but keyed per order_id (one order = one column of the matrix = one managerSave
// call).

/** One row of the editable product x location matrix: a product, unioned
 * across every member order that carries it, with each contributing order's
 * full line keyed by order_id (undefined = this order doesn't carry the
 * product — an empty/addable cell). */
export interface TransportMatrixRow {
  product_id: string;
  product_name_pl: string;
  purchase_unit: string;
  linesByOrderId: Record<string, ManagerOrderLineDetail>;
}

/** Union of products across every member order's lines, one row per product,
 * sorted by product_name_pl (pl collation) for a stable, scannable table. */
export function buildTransportMatrix(orders: TransportBatchOrder[]): TransportMatrixRow[] {
  const byProduct = new Map<string, TransportMatrixRow>();
  for (const order of orders) {
    for (const line of order.lines) {
      let row = byProduct.get(line.product_id);
      if (!row) {
        row = {
          product_id: line.product_id,
          product_name_pl: line.product_name_pl,
          purchase_unit: line.purchase_unit,
          linesByOrderId: {},
        };
        byProduct.set(line.product_id, row);
      }
      row.linesByOrderId[order.order_id] = line;
    }
  }
  return [...byProduct.values()].sort((a, b) => a.product_name_pl.localeCompare(b.product_name_pl, "pl"));
}

/** Per-order draft state for a draft batch — one `DraftMap` (order_line_id ->
 * {qty, comment}) per member order, so each order's dirty tracking and
 * managerSave payload stay independent (mirrors one column = one order = one
 * PATCH call). */
export type TransportDraftMap = Record<string, DraftMap>;

/** Seed every member order's draft map from its own loaded lines (effective
 * qty = manager_final if > 0 else captain_final; comment = manager_comment) —
 * the per-order equivalent of draftState.ts's `seedDrafts`. */
export function seedTransportDrafts(orders: TransportBatchOrder[]): TransportDraftMap {
  const out: TransportDraftMap = {};
  for (const order of orders) {
    const map: DraftMap = {};
    for (const line of order.lines) {
      map[line.order_line_id] = {
        qty: effectiveManagerQtyPurchase(line),
        comment: line.manager_comment ?? "",
      };
    }
    out[order.order_id] = map;
  }
  return out;
}

/** Draft effective qty for ONE cell of the matrix (order_id x line), falling
 * back to the line's own baseline when that order has no draft entry yet
 * (e.g. a column just added via add-location/add-product). */
export function draftQtyFor(
  drafts: TransportDraftMap,
  orderId: string,
  line: ManagerOrderLineDetail,
): number {
  return draftQty(drafts[orderId] ?? {}, line);
}

/** True when `order`'s draft differs from its seeded baseline in any line. */
export function transportOrderDirty(order: TransportBatchOrder, drafts: TransportDraftMap): boolean {
  return hasDirtyDrafts(drafts[order.order_id] ?? {}, order.lines);
}

/** True when ANY member order has an unsaved edit — drives the batch-level
 * "Zapisz zmiany" affordance and the switch-batch/supplier confirm guard. */
export function anyTransportDirty(orders: TransportBatchOrder[], drafts: TransportDraftMap): boolean {
  return orders.some((order) => transportOrderDirty(order, drafts));
}

/** One order's managerSave payload — DIRTY lines only (read-modify-write: an
 * untouched line is simply absent from the payload, so its persisted
 * manager_comment is never overwritten). */
export interface TransportOrderSavePayload {
  order_id: string;
  finals: OrderLineManagerFinal[];
}

/** Build one managerSave-shaped payload per order that has at least one dirty
 * line — the "save every dirty column" batch action. An order with no edits
 * contributes nothing (empty finals are never returned), so the caller only
 * issues a managerSave call for orders that actually changed. */
export function transportDirtySavePayloads(
  orders: TransportBatchOrder[],
  drafts: TransportDraftMap,
): TransportOrderSavePayload[] {
  const out: TransportOrderSavePayload[] = [];
  for (const order of orders) {
    const finals = dirtySavePayload(drafts[order.order_id] ?? {}, order.lines);
    if (finals.length > 0) out.push({ order_id: order.order_id, finals });
  }
  return out;
}

/** Weight strip math for the batch detail header: total / limit / remaining
 * (may go negative) / over (>= 0) / isOver, plus the "brak wagi dla N pozycji"
 * count passed straight through. A null `limit_kg` (no limit set) neutralizes
 * remaining/over/isOver rather than dividing by/comparing against nothing. */
export interface TransportWeightStrip {
  totalKg: number;
  limitKg: number | null;
  remainingKg: number | null;
  overKg: number;
  isOver: boolean;
  unknownCount: number;
}

export function computeWeightStrip(
  detail: Pick<TransportBatchDetail, "total_weight_kg" | "limit_kg" | "unknown_weight_count">,
): TransportWeightStrip {
  const limitKg = detail.limit_kg ?? null;
  const totalKg = detail.total_weight_kg;
  if (limitKg == null) {
    return { totalKg, limitKg: null, remainingKg: null, overKg: 0, isOver: false, unknownCount: detail.unknown_weight_count };
  }
  const remainingKg = Math.round((limitKg - totalKg) * 100) / 100;
  const overKg = Math.max(0, Math.round((totalKg - limitKg) * 100) / 100);
  return {
    totalKg,
    limitKg,
    remainingKg,
    overKg,
    isOver: remainingKg < 0,
    unknownCount: detail.unknown_weight_count,
  };
}

/** Deduped, sorted non-empty values of one logistics field across past
 * batches — feeds the driver/vehicle `<datalist>` suggestions (v2 design
 * decision 8: free text, no new master-data surface). */
export function collectLogisticsSuggestions(
  batches: TransportBatchSummary[],
  field: "driver" | "vehicle",
): string[] {
  const seen = new Set<string>();
  for (const b of batches) {
    const v = b[field];
    if (v && v.trim() !== "") seen.add(v.trim());
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "pl"));
}
