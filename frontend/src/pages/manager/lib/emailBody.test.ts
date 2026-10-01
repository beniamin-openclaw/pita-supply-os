import { describe, it, expect } from "vitest";

import type { ManagerOrderDetail, ManagerOrderLineDetail } from "../../../types";
import { effectiveOrderedQtyPurchase } from "../../../lib/orderQty";
import {
  buildEmailBody,
  buildEmailSubject,
  buildGmailComposeUrl,
  buildResendSubject,
  copyListQty,
  draftCc,
  emailQtyText,
  fallbackCc,
  formatDeliveryDayLong,
  formatDeliveryDayShort,
  formatEmailQty,
  joinCc,
  MAX_GMAIL_URL_LENGTH,
} from "./emailBody";

/** Minimal order-detail fixture — only the fields the email body reads matter. */
function detail(overrides: Partial<ManagerOrderDetail> = {}): ManagerOrderDetail {
  return {
    order_id: "ORD-1",
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    supplier_id: "SUP_BUKAT",
    supplier_name: "Bukat",
    ordering_method: "email",
    supplier_notes: "",
    order_date: "2026-06-25",
    status: "manager_claimed",
    notes: "",
    lines: [],
    receipts: [],
    ...overrides,
  } as ManagerOrderDetail;
}

const noLines = (): number => 0;

function addressLine(body: string): string | undefined {
  return body.split("\n").find((l) => l.startsWith("ADRES DOSTAWY:"));
}

describe("buildEmailBody — delivery address line (email-delivery-address)", () => {
  it("joins location name, street and city in order", () => {
    const body = buildEmailBody(
      detail({ delivery_address: "Wolska 50, 01-001", city: "Warszawa" }),
      noLines,
    );
    expect(addressLine(body)).toBe(
      "ADRES DOSTAWY: Pita Bros Wola, Wolska 50, 01-001, Warszawa",
    );
  });

  it("skips an empty street so there is no doubled comma", () => {
    const body = buildEmailBody(detail({ city: "Warszawa" }), noLines);
    expect(addressLine(body)).toBe("ADRES DOSTAWY: Pita Bros Wola, Warszawa");
    expect(body).not.toContain(", ,");
  });

  it("skips whitespace-only parts", () => {
    const body = buildEmailBody(
      detail({ delivery_address: "   ", city: "Warszawa" }),
      noLines,
    );
    expect(addressLine(body)).toBe("ADRES DOSTAWY: Pita Bros Wola, Warszawa");
  });

  it("falls back to the location name alone when no address is set", () => {
    const body = buildEmailBody(detail(), noLines);
    expect(addressLine(body)).toBe("ADRES DOSTAWY: Pita Bros Wola");
  });

  it("still renders product lines by supplier-facing name + unit", () => {
    const line = {
      order_line_id: "OL-1",
      product_id: "P011",
      product_name_pl: "Tzatziki",
      supplier_product_name: "Tzatzyki",
      purchase_unit: "wiadro",
      manager_final_qty_purchase: 2,
      captain_final_qty_purchase: 1,
    } as ManagerOrderLineDetail;
    const body = buildEmailBody(detail({ lines: [line] }), effectiveOrderedQtyPurchase);
    expect(body).toContain("Tzatzyki | 2 wiadra");
  });

  it("keeps the delivery date blank while the switch is off (default)", () => {
    const body = buildEmailBody(
      detail({ requested_delivery_date: "2026-06-27" }),
      noLines,
    );
    expect(body).toContain("Dostawa: __________, od godziny 11:00");
    expect(body).not.toContain("27.06");
    expect(buildEmailSubject(detail({ requested_delivery_date: "2026-06-27" }))).toBe(
      "Zamówienie Pita Bros Wola",
    );
  });
});

describe("company footer (feedback r5)", () => {
  it("appends spółka + adres + NIP under Pozdrawiam when present", () => {
    const body = buildEmailBody(
      detail({
        company_name: "Pita Bros sp. z o.o.",
        company_address: "ul. W. Laskonogiego 9, 02-496 Warszawa",
        company_nip: "9522100633",
      }),
      noLines,
    );
    expect(body).toContain(
      "Pozdrawiam,\nPita Bros\nPita Bros sp. z o.o.\n" +
        "ul. W. Laskonogiego 9, 02-496 Warszawa\nNIP: 9522100633",
    );
  });

  it("skips the footer block entirely when company data is absent", () => {
    const body = buildEmailBody(detail(), noLines);
    expect(body).not.toContain("NIP:");
    expect(body).toContain("Pozdrawiam,\nPita Bros\n(zamówienie");
  });
});

describe("feedback r7 — empty delivery-date line + standing office CC", () => {
  it("never injects the derived date while the switch is off", () => {
    const body = buildEmailBody(
      detail({ requested_delivery_date: "2026-06-27" }),
      noLines,
    );
    expect(body).not.toContain("2026-06-27");
    expect(body.split("\n")).toContain("Dostawa: __________, od godziny 11:00");
  });

  it("emits cc only for an address carrying '@'", () => {
    const base = { to: "handel@intermlecz.pl", subject: "S", body: "B" };
    expect(buildGmailComposeUrl({ ...base, cc: "biuro@pitabros.pl" }).url).toContain(
      "cc=biuro%40pitabros.pl",
    );
    for (const cc of [undefined, null, "", "TBD"]) {
      expect(buildGmailComposeUrl({ ...base, cc }).url).not.toContain("cc=");
    }
  });

  it("counts the cc parameter toward the length gate", () => {
    const longBody = "x".repeat(MAX_GMAIL_URL_LENGTH - 200);
    const base = { to: "handel@intermlecz.pl", subject: "S", body: longBody };
    const withoutCc = buildGmailComposeUrl(base);
    const withCc = buildGmailComposeUrl({ ...base, cc: "biuro@pitabros.pl" });
    expect(withCc.url.length).toBeGreaterThan(withoutCc.url.length);
  });

  it("keeps both recipient addresses when the supplier email is comma-joined", () => {
    const { url } = buildGmailComposeUrl({
      to: "handel@intermlecz.pl,katarzyna.szymanska@intermlecz.pl",
      subject: "S",
      body: "B",
      cc: "biuro@pitabros.pl",
    });
    expect(decodeURIComponent(url)).toContain(
      "to=handel@intermlecz.pl,katarzyna.szymanska@intermlecz.pl",
    );
  });
});

describe("training-feedback-0901 Phase 1b — off-catalogue items + Captain comment", () => {
  it("renders the off-catalogue items block when extra_items is present", () => {
    const body = buildEmailBody(
      detail({ extra_items: "Serwetki - 5 opak\nLód - 2 worki" }),
      noLines,
    );
    expect(body).toContain("Pozycje spoza katalogu:\nSerwetki - 5 opak\nLód - 2 worki");
  });

  it("omits the off-catalogue items block entirely when extra_items is empty", () => {
    const body = buildEmailBody(detail({ extra_items: "" }), noLines);
    expect(body).not.toContain("Pozycje spoza katalogu:");
  });

  it("omits the off-catalogue items block when extra_items is absent (backend default)", () => {
    const body = buildEmailBody(detail(), noLines);
    expect(body).not.toContain("Pozycje spoza katalogu:");
  });

  it("trims whitespace-only extra_items to nothing (block omitted)", () => {
    const body = buildEmailBody(detail({ extra_items: "   \n  " }), noLines);
    expect(body).not.toContain("Pozycje spoza katalogu:");
  });

  it("renders the Komentarz: block when captain_note is present", () => {
    const body = buildEmailBody(
      detail({ captain_note: "Proszę dostarczyć przed 10:00" }),
      noLines,
    );
    expect(body).toContain("Komentarz:\nProszę dostarczyć przed 10:00");
  });

  it("omits the Komentarz: block entirely when captain_note is empty or absent", () => {
    expect(buildEmailBody(detail({ captain_note: "" }), noLines)).not.toContain("Komentarz:");
    expect(buildEmailBody(detail(), noLines)).not.toContain("Komentarz:");
  });

  it("places both blocks after the product table and before the address line, in order", () => {
    const body = buildEmailBody(
      detail({
        extra_items: "Serwetki - 5 opak",
        captain_note: "Proszę o kontakt przed dostawą",
        city: "Warszawa",
      }),
      noLines,
    );
    const lines = body.split("\n");
    const extraIdx = lines.indexOf("Pozycje spoza katalogu:");
    const komentarzIdx = lines.indexOf("Komentarz:");
    const addressIdx = lines.findIndex((l) => l.startsWith("ADRES DOSTAWY:"));
    expect(extraIdx).toBeGreaterThan(-1);
    expect(komentarzIdx).toBeGreaterThan(extraIdx);
    expect(addressIdx).toBeGreaterThan(komentarzIdx);
  });

  it("neither block appears when both fields are absent", () => {
    const body = buildEmailBody(detail(), noLines);
    expect(body).not.toContain("Pozycje spoza katalogu:");
    expect(body).not.toContain("Komentarz:");
  });
});

// ---------- week2-feedback-quantities Phase 2: joinCc (office copy + location mailbox) ----------

describe("joinCc", () => {
  it("joins the office copy and the location mailbox with a comma", () => {
    expect(joinCc("biuro@pitabros.pl", "wola@pitabros.pl")).toBe(
      "biuro@pitabros.pl,wola@pitabros.pl",
    );
  });

  it("keeps the office copy alone when the location has no mailbox", () => {
    expect(joinCc("biuro@pitabros.pl", null)).toBe("biuro@pitabros.pl");
    expect(joinCc("biuro@pitabros.pl", undefined)).toBe("biuro@pitabros.pl");
    expect(joinCc("biuro@pitabros.pl", "")).toBe("biuro@pitabros.pl");
  });

  it("keeps the location mailbox alone when the office setting is empty", () => {
    expect(joinCc(null, "wola@pitabros.pl")).toBe("wola@pitabros.pl");
  });

  it("drops a placeholder like TBD (no @), mirroring the recipient gate", () => {
    expect(joinCc("biuro@pitabros.pl", "TBD")).toBe("biuro@pitabros.pl");
    expect(joinCc("TBD", "wola@pitabros.pl")).toBe("wola@pitabros.pl");
  });

  it("returns an empty string when nothing survives", () => {
    expect(joinCc(null, undefined, "", "TBD")).toBe("");
    expect(joinCc()).toBe("");
  });

  it("trims whitespace, accepts semicolon lists and collapses duplicates", () => {
    expect(joinCc(" biuro@pitabros.pl ; szef@pitabros.pl", "biuro@pitabros.pl")).toBe(
      "biuro@pitabros.pl,szef@pitabros.pl",
    );
  });

  it("feeds buildGmailComposeUrl a single cc param carrying both addresses", () => {
    const cc = joinCc("biuro@pitabros.pl", "wola@pitabros.pl");
    const { url } = buildGmailComposeUrl({ to: "x@y.pl", subject: "s", body: "b", cc });
    expect(url.split("&cc=").length).toBe(2);
    expect(url).toContain("cc=biuro%40pitabros.pl%2Cwola%40pitabros.pl");
  });
});

describe("buildResendSubject — post-send dosyłka (week2-feedback-quantities Phase 6)", () => {
  it("prefixes the regular subject with 'Dosyłka —'", () => {
    const d = detail({ location_name: "Pita Bros Wola" });
    expect(buildEmailSubject(d)).toBe("Zamówienie Pita Bros Wola");
    expect(buildResendSubject(d)).toBe("Dosyłka — Zamówienie Pita Bros Wola");
  });

  it("lands in the Gmail su= parameter unchanged", () => {
    const d = detail({ location_name: "Pita Bros Wola" });
    const { url } = buildGmailComposeUrl({
      to: "z@bukat.example",
      subject: buildResendSubject(d),
      body: buildEmailBody(d, noLines),
    });
    expect(url).toContain(`su=${encodeURIComponent("Dosyłka — Zamówienie Pita Bros Wola")}`);
  });
});

describe("buildEmailBody — canonical supplier order (supplier-product-order-minimum)", () => {
  // Shared with supply-os-v1/tests/test_supplier_product_order.py
  // (test_email_body_numbers_lines_by_position_not_line_id): stored line ids run
  // Ogórek, Pomidor, Bombilla, then a manager-added Cebula; positions say
  // Pomidor, Cebula, Ogórek, then the position-less Bombilla.
  const mk = (
    id: string,
    spId: string,
    name: string,
    unit: string,
    displayOrder: number | null,
    captain: number,
    manager = 0,
  ): ManagerOrderLineDetail =>
    ({
      order_line_id: id,
      product_id: spId.slice(-4),
      product_name_pl: name,
      supplier_product_id: spId,
      supplier_product_name: name,
      purchase_unit: unit,
      display_order: displayOrder,
      captain_final_qty_purchase: captain,
      manager_final_qty_purchase: manager,
    }) as ManagerOrderLineDetail;
  const lines = [
    mk("OL-ORD-001", "SP_BUKAT_P005", "Ogórek", "kg", 50, 2),
    mk("OL-ORD-002", "SP_BUKAT_P006", "Pomidor", "kg", 10, 3),
    mk("OL-ORD-003", "SP_BUKAT_P135", "Bombilla", "szt", null, 1),
    mk("OL-ORD-M-a1b2c3", "SP_BUKAT_P016", "Cebula czerwona", "kg", 20, 0, 4),
  ];
  const eff = (l: ManagerOrderLineDetail): number =>
    l.manager_final_qty_purchase > 0 ? l.manager_final_qty_purchase : l.captain_final_qty_purchase;

  it("numbers lines by position, a manager-added line at its own position", () => {
    const body = buildEmailBody(detail({ lines }), eff);
    const table = body.split("\n").filter((l) => /^\d/.test(l));
    expect(table).toEqual([
      "1.  | Pomidor | 3 kg",
      "2.  | Cebula czerwona | 4 kg",
      "3.  | Ogórek | 2 kg",
      "4.  | Bombilla | 1 szt",
    ]);
  });

  it("does not reorder the detail's own line array", () => {
    buildEmailBody(detail({ lines }), eff);
    expect(lines.map((l) => l.order_line_id)).toEqual([
      "OL-ORD-001",
      "OL-ORD-002",
      "OL-ORD-003",
      "OL-ORD-M-a1b2c3",
    ]);
  });
});


describe("order-email-v2 — date switch, weekdays, quantities", () => {
  it("prints the date in body and subject when the switch is on", () => {
    const d = detail({
      location_name: "Pita Bros Bracka",
      requested_delivery_date: "2026-09-29",
      delivery_date_in_email: true,
    });
    expect(buildEmailBody(d, noLines)).toContain(
      "Dostawa: wtorek 29.09.2026, od godziny 11:00",
    );
    expect(buildEmailSubject(d)).toBe("Zamówienie Pita Bros Bracka – dostawa wt 29.09");
    expect(buildResendSubject(d)).toBe(
      "Dosyłka — Zamówienie Pita Bros Bracka – dostawa wt 29.09",
    );
  });

  it("stays blank with the switch on but no date", () => {
    const d = detail({ delivery_date_in_email: true });
    expect(buildEmailBody(d, noLines)).toContain("Dostawa: __________, od godziny 11:00");
    expect(buildEmailSubject(d)).toBe("Zamówienie Pita Bros Wola");
  });

  it.each([
    ["2026-09-28", "poniedziałek 28.09.2026", "pon 28.09"],
    ["2026-10-04", "niedziela 04.10.2026", "nd 04.10"],
    ["2026-10-02", "piątek 02.10.2026", "pt 02.10"],
  ])("formats %s without a timezone shift", (iso, long, short) => {
    expect(formatDeliveryDayLong(iso)).toBe(long);
    expect(formatDeliveryDayShort(iso)).toBe(short);
  });

  it.each([
    [1, "1"],
    [1.5, "1,5"],
    [18, "18"],
    [0.1 + 0.2, "0,3"],
  ])("formats quantity %s as %s", (qty, out) => {
    expect(formatEmailQty(qty)).toBe(out);
  });

  it("prints the location phone only when present", () => {
    expect(buildEmailBody(detail({ location_phone: "600 722 252" }), noLines)).toContain(
      "Telefon lokalu: 600 722 252",
    );
    expect(buildEmailBody(detail(), noLines)).not.toContain("Telefon lokalu");
  });

  it("signs with the chosen manager", () => {
    const body = buildEmailBody(detail(), noLines, {
      name: "Sławomir Glanowski",
      phone: "+48 692 840 194",
      email: "slawek@pitabros.pl",
    });
    expect(body).toContain(
      "Pozdrawiam,\nSławomir Glanowski\ntel. +48 692 840 194 · slawek@pitabros.pl\n(",
    );
  });
});

describe("order-email-v2 — DW per delivery path", () => {
  it("draft: location mailbox only, never the sender", () => {
    expect(
      draftCc(detail({ cc_email: "biuro@pitabros.pl", location_email: "bracka@gmail.com" })),
    ).toBe("bracka@gmail.com");
    expect(
      draftCc(
        detail({ location_email: "Bracka@pitabros.pl", sender_email: "bracka@pitabros.pl" }),
      ),
    ).toBe("");
    expect(draftCc(detail({ location_email: "TBD" }))).toBe("");
  });

  it("fallback link: office copy + location mailbox", () => {
    expect(
      fallbackCc(detail({ cc_email: "biuro@pitabros.pl", location_email: "wola@gmail.com" })),
    ).toBe("biuro@pitabros.pl,wola@gmail.com");
  });
});

describe("bulk-pack quantity wording (feedback-1001 D35)", () => {
  const frytki = (overrides: Partial<ManagerOrderLineDetail> = {}): ManagerOrderLineDetail =>
    ({
      order_line_id: "OL-1",
      product_id: "P021",
      product_name_pl: "Frytki Aviko",
      inventory_unit: "szt",
      supplier_product_id: "SP_INTERMLECZ_P021",
      supplier_product_name: "Frytki Aviko 2,5 kg",
      purchase_unit: "paczka",
      units_per_purchase_unit: 1,
      captain_final_qty_purchase: 26,
      manager_final_qty_purchase: 0,
      case_unit: "karton",
      units_per_case: 4,
      ...overrides,
    }) as ManagerOrderLineDetail;

  it("emailQtyText prints cases + loose + the total", () => {
    expect(emailQtyText(frytki(), 26, "paczka")).toBe("6 kartonów + 2 paczki (26 paczek)");
    expect(emailQtyText(frytki(), 24, "paczka")).toBe("6 kartonów (24 paczki)");
    expect(emailQtyText(frytki(), 2, "paczka")).toBe("2 paczki");
  });

  it("emailQtyText without a case is today's wording", () => {
    const noCase = frytki({ case_unit: null, units_per_case: null });
    expect(emailQtyText(noCase, 26, "paczka")).toBe("26 paczek");
    expect(emailQtyText(noCase, 1.5, "kg")).toBe("1,5 kg");
  });

  it("copyListQty uses the case wording, else the raw qty + purchase unit", () => {
    expect(copyListQty(frytki(), 26)).toBe("6 kartonów + 2 paczki (26 paczek)");
    expect(copyListQty(frytki({ case_unit: null, units_per_case: null }), 26)).toBe("26 paczka");
  });
});
