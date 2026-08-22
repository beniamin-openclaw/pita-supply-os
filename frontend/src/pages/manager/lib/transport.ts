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
import type { Supplier, TransportBatchDetail } from "../../../types";
import { buildGmailComposeUrl } from "./emailBody";

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
