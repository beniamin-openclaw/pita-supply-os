import { describe, it, expect } from "vitest";

import { STRINGS, interpolateTemplate, type Lang } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";
import type { TransportBatchDetail } from "../../../types";
import {
  buildDriverDraftEmail,
  buildGmailAuthUrl,
  buildMimeMessage,
  buildPagoDraftEmail,
  parseOAuthCallbackHash,
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

// ---------- buildGmailAuthUrl / parseOAuthCallbackHash ------------------------

describe("buildGmailAuthUrl", () => {
  it("targets Google's OAuth 2.0 implicit-grant endpoint with response_type=token", () => {
    const url = buildGmailAuthUrl({
      clientId: "abc123.apps.googleusercontent.com",
      redirectUri: "https://pita-supply-os.vercel.app/oauth/gmail-callback",
      state: "deadbeef",
    });
    expect(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?")).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("response_type")).toBe("token");
    expect(params.get("client_id")).toBe("abc123.apps.googleusercontent.com");
    expect(params.get("redirect_uri")).toBe(
      "https://pita-supply-os.vercel.app/oauth/gmail-callback",
    );
    expect(params.get("scope")).toBe("https://www.googleapis.com/auth/gmail.compose");
    expect(params.get("include_granted_scopes")).toBe("true");
    expect(params.get("prompt")).toBe("select_account");
    expect(params.get("state")).toBe("deadbeef");
  });

  it("URL-encodes a redirect_uri with special characters", () => {
    const url = buildGmailAuthUrl({
      clientId: "abc123",
      redirectUri: "http://localhost:5173/oauth/gmail-callback",
      state: "s",
    });
    expect(new URL(url).searchParams.get("redirect_uri")).toBe(
      "http://localhost:5173/oauth/gmail-callback",
    );
    expect(url).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Foauth%2Fgmail-callback");
  });
});

describe("parseOAuthCallbackHash", () => {
  it("parses a success fragment (access_token + state), with or without a leading #", () => {
    const withHash = parseOAuthCallbackHash(
      "#access_token=ya29.abc&token_type=Bearer&expires_in=3599&state=deadbeef",
    );
    expect(withHash).toEqual({ accessToken: "ya29.abc", state: "deadbeef" });

    const withoutHash = parseOAuthCallbackHash("access_token=ya29.abc&state=deadbeef");
    expect(withoutHash).toEqual({ accessToken: "ya29.abc", state: "deadbeef" });
  });

  it("parses an error fragment, preferring error_description over error", () => {
    const parsed = parseOAuthCallbackHash(
      "#error=access_denied&error_description=The+user+denied+access&state=deadbeef",
    );
    expect(parsed.error).toBe("The user denied access");
    expect(parsed.state).toBe("deadbeef");
    expect(parsed.accessToken).toBeUndefined();
  });

  it("falls back to the raw error code when error_description is absent", () => {
    const parsed = parseOAuthCallbackHash("#error=access_denied");
    expect(parsed.error).toBe("access_denied");
  });

  it("returns an empty object for a hash with no recognizable params", () => {
    expect(parseOAuthCallbackHash("")).toEqual({});
    expect(parseOAuthCallbackHash("#")).toEqual({});
  });
});

// ---------- buildPagoDraftEmail / buildDriverDraftEmail -----------------------

/** A Pago run with products, Pago AND Mory extras, location names and full
 * logistics — everything the Pago body must NOT contain is present. */
function richMixed(overrides: Partial<TransportBatchDetail> = {}): TransportBatchDetail {
  return batch({
    supplier_id: "SUP_PAGO",
    supplier_name: "Pago",
    location_ids: ["WOLA", "KEN"],
    pickup_date: "2026-10-06",
    pickup_time: "07:30",
    driver: "Jan Kowalski",
    vehicle: "Ducato WX 12345",
    notes: "Wjazd od rampy nr 2",
    orders: [
      {
        order_id: "ORD-P", location_id: "WOLA", location_name: "Pita Bros Wola",
        status: "manager_sent", lines: [], supplier_id: "SUP_PAGO",
        extra_items: "Tacki - 2 opak\nFeta grecka - 5 kg",
      },
      {
        order_id: "ORD-M", location_id: "KEN", location_name: "Pita Bros KEN",
        status: "manager_sent", lines: [], supplier_id: "SUP_MORY",
        extra_items: "Serwetki - 1 karton",
      },
    ],
    lines: [
      {
        product_id: "P027", product_name_pl: "Souvlaki", supplier_product_id: "SP_PAGO_P027",
        supplier_product_name: "Souvlaki karton", purchase_unit: "karton", total_qty_purchase: 3,
        supplier_id: "SUP_PAGO", supplier_name: "Pago",
        per_location: [
          { location_id: "WOLA", location_name: "Pita Bros Wola", order_id: "ORD-P", qty_purchase: 3 },
        ],
      },
      {
        product_id: "P050", product_name_pl: "Pita", supplier_product_id: "SP_MORY_P050",
        supplier_product_name: "Pita paczka", purchase_unit: "paczka", total_qty_purchase: 6,
        supplier_id: "SUP_MORY", supplier_name: "Magazyn własny Mory",
        per_location: [
          { location_id: "KEN", location_name: "Pita Bros KEN", order_id: "ORD-M", qty_purchase: 6 },
        ],
      },
    ],
    ...overrides,
  });
}

describe("buildPagoDraftEmail", () => {
  it("subject: legacy template with the pickup date when set", () => {
    const b = batch({ pickup_date: "2026-08-22", pickup_time: null });
    const { subject } = buildPagoDraftEmail(b, "Transport Sobota", makeT());
    expect(subject).toBe("Zlecenie odbioru wlasnego - Transport Sobota - 2026-08-22");
  });

  it("subject: no date at all when pickup_date is unset — never the created date", () => {
    const b = batch({ pickup_date: null, created: "2026-08-21T09:15:00+00:00" });
    const { subject } = buildPagoDraftEmail(b, "Transport · Warszawa", makeT());
    expect(subject).toBe("Zlecenie odbioru wlasnego - Transport · Warszawa");
    expect(subject).not.toContain("2026-08-21");
  });

  it("body is exactly greeting, attachment line, pickup line, closing, signature", () => {
    const { bodyText } = buildPagoDraftEmail(richMixed(), "Transport Poniedziałek", makeT());
    expect(bodyText).toBe(
      [
        "Dzień dobry,",
        "",
        "W załączniku przesyłamy zlecenie odbioru własnego.",
        "Odbiór: 2026-10-06, godz. 07:30",
        "",
        "Pozdrawiam,",
        "Pita Bros",
      ].join("\n"),
    );
  });

  it("body carries NO product, extra item, location, driver/vehicle, notes or label", () => {
    const { bodyText } = buildPagoDraftEmail(richMixed(), "Transport Poniedziałek · Warszawa", makeT());
    for (const forbidden of [
      "Souvlaki",
      "Pita paczka",
      "Tacki",
      "Feta",
      "Serwetki",
      "Pozycje spoza katalogu",
      "Wola",
      "KEN",
      "WOLA",
      "Jan Kowalski",
      "Ducato",
      "Kierowca",
      "Pojazd",
      "Wjazd od rampy",
      "Transport Poniedziałek",
      "Warszawa",
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }
  });

  it("pickup line: date only when no time is set", () => {
    const { bodyText } = buildPagoDraftEmail(richMixed({ pickup_time: "  " }), "x", makeT());
    expect(bodyText).toContain("Odbiór: 2026-10-06");
    expect(bodyText).not.toContain("godz.");
  });

  it("pickup line: 'to be confirmed' when there is no pickup date", () => {
    const { bodyText } = buildPagoDraftEmail(
      richMixed({ pickup_date: null, pickup_time: null }),
      "x",
      makeT(),
    );
    expect(bodyText).toContain("Termin odbioru do potwierdzenia.");
    expect(bodyText).not.toContain("Odbiór:");
    expect(bodyText).not.toContain("2026-08-21"); // the created date never stands in
  });

  it("is language-aware (en)", () => {
    const { bodyText } = buildPagoDraftEmail(richMixed({ pickup_date: null }), "x", makeT("en"));
    expect(bodyText).toContain("Please find the self-pickup order attached.");
    expect(bodyText).toContain("Pickup date to be confirmed.");
  });

  it("correction: KOREKTA prefix on the subject and one line right after the greeting", () => {
    const { subject, bodyText } = buildPagoDraftEmail(
      richMixed(),
      "Transport Wtorek",
      makeT(),
      { correction: true },
    );
    expect(subject).toBe("KOREKTA - Zlecenie odbioru wlasnego - Transport Wtorek - 2026-10-06");
    expect(bodyText).toBe(
      [
        "Dzień dobry,",
        "",
        "KOREKTA: to zlecenie koryguje i zastępuje wcześniej wysłane zlecenie odbioru własnego dla tego transportu.",
        "W załączniku przesyłamy zlecenie odbioru własnego.",
        "Odbiór: 2026-10-06, godz. 07:30",
        "",
        "Pozdrawiam,",
        "Pita Bros",
      ].join("\n"),
    );
    // Still no product, extra item or location in a corrected body.
    for (const forbidden of ["Souvlaki", "Tacki", "Feta", "Wola", "KEN"]) {
      expect(bodyText).not.toContain(forbidden);
    }
  });

  it("correction: false or omitted leaves subject and body unchanged", () => {
    const plain = buildPagoDraftEmail(richMixed(), "Transport Wtorek", makeT());
    const off = buildPagoDraftEmail(richMixed(), "Transport Wtorek", makeT(), { correction: false });
    expect(off).toEqual(plain);
    expect(plain.subject.startsWith("KOREKTA")).toBe(false);
    expect(plain.bodyText).not.toContain("KOREKTA");
  });
});

describe("buildDriverDraftEmail", () => {
  it("subject: legacy template with the pickup date when set", () => {
    const b = batch({ pickup_date: "2026-08-22" });
    const { subject } = buildDriverDraftEmail(b, "Transport Sobota", makeT());
    expect(subject).toBe("Transport / odbior i rozwoz - Transport Sobota - 2026-08-22");
  });

  it("subject: no date at all when pickup_date is unset", () => {
    const b = batch({ pickup_date: null, created: "2026-08-21T09:15:00+00:00" });
    const { subject } = buildDriverDraftEmail(b, "Transport · Warszawa", makeT());
    expect(subject).toBe("Transport / odbior i rozwoz - Transport · Warszawa");
  });

  it("body: the four logistics lines with their values, notes, every member's extras", () => {
    const { bodyText } = buildDriverDraftEmail(richMixed(), "Transport Poniedziałek", makeT());
    expect(bodyText).toBe(
      [
        "Dzień dobry,",
        "",
        "Transport: Transport Poniedziałek",
        "Data odbioru: 2026-10-06",
        "Godzina odbioru: 07:30",
        "Kierowca: Jan Kowalski",
        "Pojazd: Ducato WX 12345",
        "",
        "Uwagi:",
        "Wjazd od rampy nr 2",
        "",
        "Pozycje spoza katalogu:",
        "Tacki - 2 opak",
        "Feta grecka - 5 kg",
        "Serwetki - 1 karton",
        "",
        "Szczegóły w załączniku.",
        "",
        "Pozdrawiam,",
        "Pita Bros",
      ].join("\n"),
    );
  });

  it("body: always prints the four lines, with 'do potwierdzenia' for missing values", () => {
    const b = richMixed({
      pickup_date: null,
      pickup_time: "",
      driver: null,
      vehicle: "   ",
      notes: "  ",
      orders: richMixed().orders.map((o) => ({ ...o, extra_items: "" })),
    });
    const { bodyText } = buildDriverDraftEmail(b, "Transport · Warszawa", makeT());
    expect(bodyText).toContain("Data odbioru: do potwierdzenia");
    expect(bodyText).toContain("Godzina odbioru: do potwierdzenia");
    expect(bodyText).toContain("Kierowca: do potwierdzenia");
    expect(bodyText).toContain("Pojazd: do potwierdzenia");
    expect(bodyText).not.toContain("Uwagi:");
    expect(bodyText).not.toContain("Pozycje spoza katalogu");
  });

  it("extras are listed verbatim, never de-duplicated (10kg, not 5)", () => {
    const b = batch({
      pickup_date: "2026-08-22",
      orders: [
        { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_sent", lines: [], extra_items: "Feta - 5 kg" },
        { order_id: "ORD-2", location_id: "BRACKA", location_name: "Pita Bros Bracka", status: "manager_sent", lines: [], extra_items: "Feta - 5 kg" },
      ],
    });
    const { bodyText } = buildDriverDraftEmail(b, "Transport Sobota", makeT());
    expect(bodyText.split("Feta - 5 kg").length - 1).toBe(2);
  });

  it("is language-aware (en)", () => {
    const { bodyText } = buildDriverDraftEmail(richMixed({ driver: null }), "x", makeT("en"));
    expect(bodyText).toContain("Pickup date: 2026-10-06");
    expect(bodyText).toContain("Driver: to be confirmed");
    expect(bodyText).toContain("Notes:");
  });
});
