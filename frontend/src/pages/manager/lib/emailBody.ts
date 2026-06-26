// Client-side Gmail compose-URL builder for the channel-aware dispatch panel
// (Phase G3, email channel). Ports supply-os-v1/app/gmail_url.py faithfully so
// the manager previews + edits exactly what gets sent, and the URL is built in
// the browser from the EDITED subject/body (spec §5a approach 4(b)).
//
// The frontend now owns the 8000-char check the backend used to guarantee: if
// the URL exceeds MAX_GMAIL_URL_LENGTH the UI must hide "Otwórz w Gmail" and
// fall back to clipboard. Keep this in sync with the Python original.

import type { ManagerOrderDetail, ManagerOrderLineDetail } from "../../../types";

export const GMAIL_COMPOSE_BASE = "https://mail.google.com/mail/";
export const MAX_GMAIL_URL_LENGTH = 8000;

/**
 * Quantity label (mirrors Python f"{qty:g}"): drop trailing zeros, no exponent
 * for the small integers used here. `String(3)` -> "3", `String(3.5)` -> "3.5".
 */
function formatQty(qty: number): string {
  return String(qty);
}

// NOTE (S-02): this is the AUTHORITATIVE builder for the email the operator
// actually sends — the dispatch panel opens a Gmail draft from the URL built
// here, out of the EDITED subject/body. The backend twin
// supply-os-v1/app/gmail_url.py builds a parallel URL returned as
// ManagerDispatchResponse.gmail_compose_url, used only for a session-only
// re-open link. Change both together or they diverge (cf. S-09 compute.ts).

/**
 * Subject (mirrors gmail_url._build_subject): "Zamówienie {location_name}".
 * Order id + delivery date live in the body, not the subject.
 */
export function buildEmailSubject(detail: ManagerOrderDetail): string {
  return `Zamówienie ${detail.location_name}`;
}

/**
 * Plaintext Polish body (mirrors gmail_url._build_body). Lines whose effective
 * qty is 0 are skipped; visible lines are sorted by order_line_id.
 *
 * `effectiveQtyFor` returns the DRAFT effective purchase qty for a line so the
 * email matches the table.
 *
 * NOTE: the estimated total is deliberately NOT in the supplier email — it is
 * internal (Manager-panel only). See OrderDetailPane + DEMO_FEEDBACK #7.
 *
 * The `Adres dostawy:` line is byte-identical to the backend twin
 * gmail_url._format_delivery_address: location name, street and city joined by
 * ", " with empty parts skipped. Keep both builders in lockstep.
 */
export function buildEmailBody(
  detail: ManagerOrderDetail,
  effectiveQtyFor: (line: ManagerOrderLineDetail) => number,
): string {
  const out: string[] = [];
  out.push("Dzien dobry,");
  out.push("");
  out.push("Prosze o przygotowanie zamowienia:");
  out.push("");
  out.push("Lp. | Produkt | Ilosc");

  const visible = detail.lines
    .filter((ln) => effectiveQtyFor(ln) > 0)
    .sort((a, b) => a.order_line_id.localeCompare(b.order_line_id));

  visible.forEach((line, idx) => {
    const qty = effectiveQtyFor(line);
    const unit = line.purchase_unit ?? "";
    // Supplier-facing name — the supplier can't read our internal product_name_pl.
    const name = line.supplier_product_name || line.product_name_pl;
    const cell = `${idx + 1}.  | ${name} | ${formatQty(qty)} ${unit}`;
    out.push(cell.replace(/\s+$/, ""));
  });

  out.push("");
  // location_name + delivery_address + city, empty parts skipped (mirrors
  // gmail_url._format_delivery_address so preview == sent draft == re-open URL).
  const addressParts = [detail.location_name, detail.delivery_address, detail.city]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0);
  const address = addressParts.join(", ");
  if (address) out.push(`Adres dostawy: ${address}`);
  // Fixed delivery window for ALL locations — the supplier email no longer
  // carries the requested delivery DATE, only the from-time (owner request).
  // Keep byte-identical to the backend twin (gmail_url.py).
  out.push("Dostawa możliwa od godziny 11:00");
  out.push("");
  out.push("Pozdrawiam,");
  out.push("Pita Bros");
  out.push(`(zamowienie #${detail.order_id})`);

  return out.join("\n");
}

/**
 * Build the Gmail compose URL from the (possibly EDITED) subject + body:
 *   https://mail.google.com/mail/?view=cm&fs=1&to=<email>&su=<subject>&body=<body>
 * Each value is encodeURIComponent'd (matches Python urllib.parse.quote,
 * %0A for newlines, UTF-8 diacritics). Returns the URL plus whether it is
 * within MAX_GMAIL_URL_LENGTH so the caller can hide the Gmail link.
 */
export function buildGmailComposeUrl(args: {
  to: string;
  subject: string;
  body: string;
}): { url: string; tooLong: boolean } {
  const query = [
    `view=cm`,
    `fs=1`,
    `to=${encodeURIComponent(args.to)}`,
    `su=${encodeURIComponent(args.subject)}`,
    `body=${encodeURIComponent(args.body)}`,
  ].join("&");
  const url = `${GMAIL_COMPOSE_BASE}?${query}`;
  return { url, tooLong: url.length > MAX_GMAIL_URL_LENGTH };
}
