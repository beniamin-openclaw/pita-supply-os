import { describe, it, expect } from "vitest";

import { STRINGS, interpolateTemplate, type Lang } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";
import type { TransportBatchDetail } from "../../../types";
import {
  buildDriverDraftEmail,
  buildMimeMessage,
  buildPagoDraftEmail,
  toBase64Url,
} from "./gmailDraft";

/** Minimal `t` fixture driven by the real STRINGS table (mirrors
 * transport.test.ts / transportPdf.test.ts). */
function makeT(lang: Lang = "pl") {
  return (key: StringKey, vars?: Record<string, string | number>): string =>
    interpolateTemplate(STRINGS[key][lang], vars);
}

/** Minimal batch fixture with per-location data present — used to prove the
 * no-location-leak invariant on the Pago draft body (a fixture WITH locations
 * whose names never surface in the Pago body text). */
function batch(overrides: Partial<TransportBatchDetail> = {}): TransportBatchDetail {
  return {
    transport_id: "TRN-20260821-BUKA-abc123",
    supplier_id: "SUP_BUKAT",
    supplier_name: "Bukat",
    created: "2026-08-21T09:15:00+00:00",
    order_count: 2,
    location_ids: ["WOLA", "BRACKA"],
    status: "sent",
    notes: "",
    total_weight_kg: 0,
    unknown_weight_count: 0,
    events: [],
    orders: [
      {
        order_id: "ORD-1",
        location_id: "WOLA",
        location_name: "Pita Bros Wola",
        status: "manager_sent",
        lines: [],
      },
      {
        order_id: "ORD-2",
        location_id: "BRACKA",
        location_name: "Pita Bros Bracka",
        status: "manager_sent",
        lines: [],
      },
    ],
    lines: [
      {
        product_id: "P1",
        product_name_pl: "Pomidory",
        supplier_product_id: "SP1",
        supplier_product_name: "Pomidory malinowe",
        purchase_unit: "kg",
        total_qty_purchase: 12,
        per_location: [
          { location_id: "WOLA", location_name: "Pita Bros Wola", order_id: "ORD-1", qty_purchase: 5 },
          { location_id: "BRACKA", location_name: "Pita Bros Bracka", order_id: "ORD-2", qty_purchase: 7 },
        ],
      },
    ],
    ...overrides,
  };
}

// ---------- buildMimeMessage / toBase64Url ------------------------------------

describe("buildMimeMessage", () => {
  it("uses the deterministic default boundary and never Math.random", () => {
    const mime = buildMimeMessage({
      to: "a@example.com",
      subject: "Subject",
      bodyText: "Hello",
      attachments: [],
    });
    expect(mime).toContain("boundary=\"pitabros-mime-boundary\"");
    expect(mime).toContain("--pitabros-mime-boundary");
    expect(mime).toContain("--pitabros-mime-boundary--");
  });

  it("accepts a custom boundary", () => {
    const mime = buildMimeMessage({
      to: "a@example.com",
      subject: "Subject",
      bodyText: "Hello",
      attachments: [],
      boundary: "custom-boundary-1",
    });
    expect(mime).toContain("boundary=\"custom-boundary-1\"");
    expect(mime).toContain("--custom-boundary-1--");
  });

  it("carries the To header verbatim", () => {
    const mime = buildMimeMessage({
      to: "driver@example.com,biuro@example.com",
      subject: "Subject",
      bodyText: "Hello",
      attachments: [],
    });
    expect(mime).toContain("To: driver@example.com,biuro@example.com");
  });

  it("emits an ASCII subject unencoded", () => {
    const mime = buildMimeMessage({
      to: "a@example.com",
      subject: "Plain ASCII Subject",
      bodyText: "Hello",
      attachments: [],
    });
    expect(mime).toContain("Subject: Plain ASCII Subject");
  });

  it("RFC 2047-encodes a non-ASCII subject as =?UTF-8?B?...?=", () => {
    const subject = "Zlecenie - Transport Sobota · Warszawa - 2026-08-22";
    const mime = buildMimeMessage({
      to: "a@example.com",
      subject,
      bodyText: "Hello",
      attachments: [],
    });
    const subjectLine = mime.split("\r\n").find((l) => l.startsWith("Subject: "));
    expect(subjectLine).toBeDefined();
    expect(subjectLine).toMatch(/^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    // Decode it back and confirm round-trip fidelity.
    const b64 = subjectLine!.replace("Subject: =?UTF-8?B?", "").replace("?=", "");
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    expect(decoded).toBe(subject);
  });

  it("declares text/plain UTF-8 charset with base64 transfer encoding for the body part", () => {
    const mime = buildMimeMessage({
      to: "a@example.com",
      subject: "Subject",
      bodyText: "Hello",
      attachments: [],
    });
    expect(mime).toContain('Content-Type: text/plain; charset="utf-8"');
    expect(mime).toContain("Content-Transfer-Encoding: base64");
  });

  it("base64-roundtrips a UTF-8 body with Polish characters", () => {
    const bodyText = "Dzień dobry,\nZałącznik: żółć gęślą jaźń.\nPozdrawiam, Pita Bros";
    const mime = buildMimeMessage({
      to: "a@example.com",
      subject: "Subject",
      bodyText,
      attachments: [],
    });
    // Extract the base64 body block: everything between the body part's
    // blank-line-after-headers and the next boundary marker.
    const parts = mime.split("\r\n--pitabros-mime-boundary");
    const bodyPart = parts[1]; // parts[0] is the top-level headers block
    const b64 = bodyPart.split("\r\n\r\n")[1].trim();
    const decoded = Buffer.from(b64.replace(/\r\n/g, ""), "base64").toString("utf-8");
    expect(decoded).toBe(bodyText);
  });

  it("includes every attachment once, each with its filename and a PDF content type", () => {
    const mime = buildMimeMessage({
      to: "a@example.com",
      subject: "Subject",
      bodyText: "Hello",
      attachments: [
        { filename: "order.pdf", base64: "AAAA", mimeType: "application/pdf" },
        { filename: "driver-list.pdf", base64: "BBBB", mimeType: "application/pdf" },
      ],
    });
    expect(mime).toContain('filename="order.pdf"');
    expect(mime).toContain('filename="driver-list.pdf"');
    // Two attachment boundaries + the closing boundary + the body boundary = 4
    // occurrences of the boundary marker line start ("--pitabros-mime-boundary").
    const boundaryCount = mime.split("--pitabros-mime-boundary").length - 1;
    expect(boundaryCount).toBe(4); // body + 2 attachments + closing
    expect(mime.match(/Content-Type: application\/pdf/g)?.length).toBe(2);
  });

  it("terminates with the closing boundary", () => {
    const mime = buildMimeMessage({
      to: "a@example.com",
      subject: "Subject",
      bodyText: "Hello",
      attachments: [{ filename: "a.pdf", base64: "AAAA", mimeType: "application/pdf" }],
    });
    expect(mime.trimEnd().endsWith("--pitabros-mime-boundary--")).toBe(true);
  });
});

describe("toBase64Url", () => {
  it("produces a base64url string with no +, /, or = padding", () => {
    const mime = "To: a@example.com\r\nSubject: Test\r\n\r\nBody with + and / chars??\xff\xfe";
    const encoded = toBase64Url(mime);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("round-trips UTF-8 content (Polish characters) through base64url decoding", () => {
    const mime = "Subject: Zamówienie żółć\r\n\r\nDzień dobry, Pita Bros";
    const encoded = toBase64Url(mime);
    const standardB64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = standardB64 + "=".repeat((4 - (standardB64.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf-8");
    expect(decoded).toBe(mime);
  });
});

// ---------- buildPagoDraftEmail / buildDriverDraftEmail -----------------------

describe("buildPagoDraftEmail", () => {
  it("matches the legacy subject template verbatim, using pickup_date when set", () => {
    const b = batch({ pickup_date: "2026-08-22", pickup_time: null });
    const { subject } = buildPagoDraftEmail(b, "Transport Sobota", makeT());
    expect(subject).toBe("Zlecenie odbioru wlasnego - Transport Sobota - 2026-08-22");
  });

  it("falls back to created's date part when pickup_date is unset", () => {
    const b = batch({ pickup_date: null, created: "2026-08-21T09:15:00+00:00" });
    const { subject } = buildPagoDraftEmail(b, "Transport Sobota", makeT());
    expect(subject).toBe("Zlecenie odbioru wlasnego - Transport Sobota - 2026-08-21");
  });

  it("body never mentions a per-location location name (no-location-leak invariant)", () => {
    const b = batch({ pickup_date: "2026-08-22" });
    const { bodyText } = buildPagoDraftEmail(b, "Transport Sobota", makeT());
    expect(bodyText).not.toContain("Wola");
    expect(bodyText).not.toContain("Bracka");
    expect(bodyText).not.toContain("WOLA");
    expect(bodyText).not.toContain("BRACKA");
  });

  it("body includes the display label, greeting, and signature", () => {
    const b = batch({ pickup_date: "2026-08-22" });
    const { bodyText } = buildPagoDraftEmail(b, "Transport Sobota", makeT());
    expect(bodyText).toContain("Transport Sobota");
    expect(bodyText).toContain("Dzień dobry,");
    expect(bodyText).toContain("Pita Bros");
  });

  it("body includes driver/vehicle lines only when set", () => {
    const withBoth = batch({ pickup_date: "2026-08-22", driver: "Jan", vehicle: "Bus 12" });
    const { bodyText: withBothBody } = buildPagoDraftEmail(withBoth, "Transport Sobota", makeT());
    expect(withBothBody).toContain("Kierowca: Jan");
    expect(withBothBody).toContain("Pojazd: Bus 12");

    const withNeither = batch({ pickup_date: "2026-08-22", driver: null, vehicle: null });
    const { bodyText: withNeitherBody } = buildPagoDraftEmail(withNeither, "Transport Sobota", makeT());
    expect(withNeitherBody).not.toContain("Kierowca:");
    expect(withNeitherBody).not.toContain("Pojazd:");
  });
});

describe("buildDriverDraftEmail", () => {
  it("matches the legacy subject template verbatim", () => {
    const b = batch({ pickup_date: "2026-08-22" });
    const { subject } = buildDriverDraftEmail(b, "Transport Sobota", makeT());
    expect(subject).toBe("Transport / odbior i rozwoz - Transport Sobota - 2026-08-22");
  });

  it("falls back to created's date part when pickup_date is unset", () => {
    const b = batch({ pickup_date: null, created: "2026-08-21T09:15:00+00:00" });
    const { subject } = buildDriverDraftEmail(b, "Transport Sobota", makeT());
    expect(subject).toBe("Transport / odbior i rozwoz - Transport Sobota - 2026-08-21");
  });

  it("body includes pickup date/time when both are set", () => {
    const b = batch({ pickup_date: "2026-08-22", pickup_time: "08:30" });
    const { bodyText } = buildDriverDraftEmail(b, "Transport Sobota", makeT());
    expect(bodyText).toContain("2026-08-22");
    expect(bodyText).toContain("08:30");
  });
});
