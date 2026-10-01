// Client-side Gmail compose-URL builder for the channel-aware dispatch panel
// (Phase G3, email channel). Ports supply-os-v1/app/gmail_url.py faithfully so
// the manager previews + edits exactly what gets sent, and the URL is built in
// the browser from the EDITED subject/body (spec §5a approach 4(b)).
//
// The frontend now owns the 8000-char check the backend used to guarantee: if
// the URL exceeds MAX_GMAIL_URL_LENGTH the UI must hide "Otwórz w Gmail" and
// fall back to clipboard. Keep this in sync with the Python original.

import { packUnitLabel } from "../../../i18n/packUnits";
import { formatCaseQty } from "../../../lib/packStock";
import { caseOf, formatQtyG } from "../../../lib/packUnits";
import { compareProductOrder } from "../../../lib/productOrder";
import type {
  ManagerOrderDetail,
  ManagerOrderLineDetail,
  OrderEmailSigner,
} from "../../../types";
import { splitRecipients } from "./transport";

export const GMAIL_COMPOSE_BASE = "https://mail.google.com/mail/";
export const MAX_GMAIL_URL_LENGTH = 8000;

/**
 * Quantity label — twin of gmail_url._format_qty: Python `f"{qty:g}"` (six
 * significant digits, no trailing zeros) with a decimal comma, so 1.5 -> "1,5"
 * and a float artefact like 0.30000000000000004 -> "0,3" on both sides.
 */
export function formatEmailQty(qty: number): string {
  return formatQtyG(qty);
}

/**
 * The quantity cell of one supplier e-mail line: with a bulk pack (migration
 * 0028) the D35 wording "6 kartonów + 2 paczki (26 paczek)" (formatCaseQty),
 * else "<qty> <declined unit>" exactly as before. Twin of the qty_text branch
 * in gmail_url._build_body.
 */
export function emailQtyText(line: ManagerOrderLineDetail, qty: number, unit: string): string {
  const lineCase = caseOf(line);
  if (lineCase) return formatCaseQty(qty, lineCase.size, lineCase.unit, unit);
  const unitLabel = unit ? packUnitLabel(qty, unit, "pl") : "";
  return `${formatEmailQty(qty)} ${unitLabel}`;
}

/**
 * The quantity column of the portal/phone/manual copy list (DispatchPanel,
 * ResendPanel): the D35 case wording when the line has a bulk pack, else
 * "<qty> <purchase_unit>" (the unit as stored, as the list has always
 * printed it). Numbers use the e-mail's Polish format (`formatQtyG`) on every
 * line so one list never mixes "2.5" and "2,5" (impl-review F4c): whole
 * numbers print exactly as before, a decimal gets a comma like in the
 * supplier e-mail, and a float artefact (0.30000000000000004) prints "0,3".
 */
export function copyListQty(line: ManagerOrderLineDetail, qty: number): string {
  const lineCase = caseOf(line);
  if (lineCase) return formatCaseQty(qty, lineCase.size, lineCase.unit, line.purchase_unit);
  return `${formatQtyG(qty)} ${line.purchase_unit}`;
}

// NOTE (S-02): this is the AUTHORITATIVE builder for the email the operator
// actually sends — the dispatch panel creates the Gmail draft (or opens the
// compose URL) from the EDITED subject/body built here. The backend twin
// supply-os-v1/app/gmail_url.py builds a parallel URL returned as
// ManagerDispatchResponse.gmail_compose_url, used only for a session-only
// re-open link. Both are pinned byte-for-byte by the shared golden fixtures in
// supply-os-v1/tests/fixtures/order_email/ (emailBody.golden.test.ts +
// test_order_email_golden.py) — change both together.

// getUTCDay(): 0 = Sunday. Short forms match the backend WEEKDAY_MAP keys.
const PL_WEEKDAY_LONG = [
  "niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota",
];
const PL_WEEKDAY_SHORT = ["nd", "pon", "wt", "śr", "czw", "pt", "sob"];

/** Printed instead of a date while the date switch is off / no date is known. */
export const BLANK_DELIVERY_DATE = "__________";

/** Parse "YYYY-MM-DD" as a calendar day (UTC, no timezone shift); null if not a date. */
function parseDay(iso: string | null | undefined): { d: Date; dd: string; mm: string; yyyy: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  return { d, dd: m[3], mm: m[2], yyyy: m[1] };
}

/** "wtorek 29.09.2026" — twin of gmail_url._delivery_day_long. */
export function formatDeliveryDayLong(iso: string): string {
  const p = parseDay(iso);
  if (!p) return "";
  return `${PL_WEEKDAY_LONG[p.d.getUTCDay()]} ${p.dd}.${p.mm}.${p.yyyy}`;
}

/** "wt 29.09" — twin of gmail_url._delivery_day_short. */
export function formatDeliveryDayShort(iso: string): string {
  const p = parseDay(iso);
  if (!p) return "";
  return `${PL_WEEKDAY_SHORT[p.d.getUTCDay()]} ${p.dd}.${p.mm}`;
}

/** The delivery date printed in the e-mail, or null (blank line, no date in
 *  the subject) — only while the backend switch is on. */
function emailDeliveryDate(detail: ManagerOrderDetail): string | null {
  if (!detail.delivery_date_in_email) return null;
  return parseDay(detail.requested_delivery_date) ? detail.requested_delivery_date ?? null : null;
}

/**
 * Subject (mirrors gmail_url._build_subject): "Zamówienie {location_name}",
 * plus " – dostawa {wt} {dd.MM}" when the delivery date is printed.
 */
export function buildEmailSubject(detail: ManagerOrderDetail): string {
  const base = `Zamówienie ${detail.location_name}`;
  const day = emailDeliveryDate(detail);
  return day ? `${base} – dostawa ${formatDeliveryDayShort(day)}` : base;
}

/** Subject prefix for a post-send "dosyłka" (top-up) e-mail (Phase 6). */
export const RESEND_SUBJECT_PREFIX = "Dosyłka —";

/**
 * Subject for the "dosyłka" e-mail rebuilt from a manager_sent order's CURRENT
 * effective quantities after a post-send edit (week2-feedback-quantities
 * Phase 6): "Dosyłka — Zamówienie {location_name}". Same body builder as the
 * original dispatch; only the subject marks it as a top-up.
 */
export function buildResendSubject(detail: ManagerOrderDetail): string {
  return `${RESEND_SUBJECT_PREFIX} ${buildEmailSubject(detail)}`;
}

/**
 * Lines that reach the supplier, in supplier order — twin of
 * gmail_url._visible_lines: effective qty > 0 (the caller's `effectiveQtyFor`
 * is built on lib/orderQty.ts, so a Manager's explicit 0 drops the line), then
 * the canonical order (lib/productOrder.ts).
 */
export function visibleLines(
  detail: ManagerOrderDetail,
  effectiveQtyFor: (line: ManagerOrderLineDetail) => number,
): ManagerOrderLineDetail[] {
  return detail.lines.filter((ln) => effectiveQtyFor(ln) > 0).sort(compareProductOrder);
}

/**
 * Plaintext Polish body (order-email-v2 layout, approved 2026-09-28; mirrors
 * gmail_url._build_body byte for byte).
 *
 * `effectiveQtyFor` returns the DRAFT effective purchase qty for a line so the
 * email matches the table. `signer` is the manager signing the e-mail; omitted
 * or null => the legacy "Pita Bros" closing.
 *
 * NOTE: the estimated total is deliberately NOT in the supplier email — it is
 * internal (Manager-panel only). See OrderDetailPane + DEMO_FEEDBACK #7.
 * NOTE (training-feedback-0901 Phase 4, hardening G7): never filter on
 * warehouse_pickup here — only the Transport pickup document does.
 */
export function buildEmailBody(
  detail: ManagerOrderDetail,
  effectiveQtyFor: (line: ManagerOrderLineDetail) => number,
  signer?: OrderEmailSigner | null,
): string {
  const out: string[] = [];
  out.push("Dzień dobry,");
  out.push("");
  out.push("proszę o przygotowanie zamówienia:");
  out.push("");
  out.push("Lp. | Produkt | Ilość");

  visibleLines(detail, effectiveQtyFor).forEach((line, idx) => {
    const qty = effectiveQtyFor(line);
    // Supplier purchase unit, else the product's inventory unit (as the twin).
    const unit = line.purchase_unit || line.inventory_unit || "";
    // Supplier-facing name — the supplier can't read our internal product_name_pl.
    const name = line.supplier_product_name || line.product_name_pl;
    const cell = `${idx + 1}.  | ${name} | ${emailQtyText(line, qty, unit)}`;
    out.push(cell.replace(/\s+$/, ""));
  });

  out.push("");
  // Ad-hoc off-catalogue items (training-feedback-0901 Phase 1b), own section,
  // skipped when empty.
  const extraItems = (detail.extra_items ?? "").trim();
  if (extraItems) {
    out.push("Pozycje spoza katalogu:");
    out.push(extraItems);
    out.push("");
  }
  // Order-level Captain comment — NOT the manager send-back `notes` field.
  const captainNote = (detail.captain_note ?? "").trim();
  if (captainNote) {
    out.push("Komentarz:");
    out.push(captainNote);
    out.push("");
  }
  // Delivery line: the date only while the switch is on (delivery-calendar),
  // otherwise a blank the manager may fill in by hand; fixed 11:00 window.
  const day = emailDeliveryDate(detail);
  out.push(`Dostawa: ${day ? formatDeliveryDayLong(day) : BLANK_DELIVERY_DATE}, od godziny 11:00`);
  // location_name + delivery_address + city, empty parts skipped (mirrors
  // gmail_url._format_delivery_address).
  const address = [detail.location_name, detail.delivery_address, detail.city]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(", ");
  if (address) out.push(`ADRES DOSTAWY: ${address}`);
  const phone = (detail.location_phone ?? "").trim();
  if (phone) out.push(`Telefon lokalu: ${phone}`);
  out.push("");
  out.push("Pozdrawiam,");
  if (signer) {
    out.push(signer.name);
    const contact: string[] = [];
    const signerPhone = (signer.phone ?? "").trim();
    const signerEmail = (signer.email ?? "").trim();
    if (signerPhone) contact.push(`tel. ${signerPhone}`);
    if (signerEmail) contact.push(signerEmail);
    if (contact.length) out.push(contact.join(" · "));
  } else {
    out.push("Pita Bros");
  }
  // Operating-company footer (feedback r5): each location orders under its own
  // spółka; suppliers need the invoicing entity + NIP in every order email.
  if (detail.company_name) {
    out.push(detail.company_name);
    if (detail.company_address) out.push(detail.company_address);
    if (detail.company_nip) out.push(`NIP: ${detail.company_nip}`);
  }
  out.push(`(zamówienie #${detail.order_id})`);

  return out.join("\n");
}

/**
 * DW for the Gmail DRAFT path (order-email-v2 D5): the location's own mailbox,
 * minus the sender alias — the draft already lives in the order mailbox, so
 * biuro@ is not copied again.
 */
export function draftCc(detail: ManagerOrderDetail): string {
  const sender = (detail.sender_email ?? "").trim().toLowerCase();
  return splitRecipients(joinCc(detail.location_email))
    .filter((addr) => addr.toLowerCase() !== sender)
    .join(",");
}

/** DW for the "Otwórz w Gmail" fallback link: office copy + location mailbox
 *  (today's rule, mirrors main.py `_join_cc`). */
export function fallbackCc(detail: ManagerOrderDetail): string {
  return joinCc(detail.cc_email, detail.location_email);
}

/**
 * Join the DW (CC) addresses for the dispatch e-mail: the standing office copy
 * (`cc_email`) + the location's own mailbox (`location_email`), week2-feedback-
 * quantities Phase 2. Mirrors main.py `_join_cc`: each part may itself be a
 * comma/semicolon list; only "@"-carrying addresses survive (a 'TBD' placeholder
 * is dropped), duplicates collapse, and the result is a comma-joined string —
 * "" when nothing survives (the panel then shows no DW row / no cc param).
 */
export function joinCc(...parts: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const addr of splitRecipients(part)) {
      if (seen.has(addr)) continue;
      seen.add(addr);
      out.push(addr);
    }
  }
  return out.join(",");
}


/**
 * Build the Gmail compose URL from the (possibly EDITED) subject + body:
 *   https://mail.google.com/mail/?view=cm&fs=1&to=<email>&cc=<cc>&su=<subject>&body=<body>
 * Each value is encodeURIComponent'd (matches Python urllib.parse.quote,
 * %0A for newlines, UTF-8 diacritics). Returns the URL plus whether it is
 * within MAX_GMAIL_URL_LENGTH so the caller can hide the Gmail link.
 *
 * `cc` is the standing office copy served by the backend
 * (ManagerOrderDetail.cc_email, feedback r7). It is emitted only when it carries
 * an "@" — the same placeholder gate the recipient uses, so a value like 'TBD'
 * never becomes a silent dead CC. The length check runs on the ASSEMBLED url, so
 * the cc parameter counts toward MAX_GMAIL_URL_LENGTH automatically.
 */
export function buildGmailComposeUrl(args: {
  to: string;
  subject: string;
  body: string;
  cc?: string | null;
}): { url: string; tooLong: boolean } {
  const parts = [`view=cm`, `fs=1`, `to=${encodeURIComponent(args.to)}`];
  if (args.cc && args.cc.includes("@")) {
    parts.push(`cc=${encodeURIComponent(args.cc)}`);
  }
  parts.push(`su=${encodeURIComponent(args.subject)}`);
  parts.push(`body=${encodeURIComponent(args.body)}`);
  const url = `${GMAIL_COMPOSE_BASE}?${parts.join("&")}`;
  return { url, tooLong: url.length > MAX_GMAIL_URL_LENGTH };
}
