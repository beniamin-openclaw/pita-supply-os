import { describe, it, expect } from "vitest";

import type { ManagerOrderDetail, ManagerOrderLineDetail } from "../../../types";
import {
  buildEmailBody,
  buildGmailComposeUrl,
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
    const body = buildEmailBody(detail({ lines: [line] }), (l) =>
      l.manager_final_qty_purchase > 0
        ? l.manager_final_qty_purchase
        : l.captain_final_qty_purchase,
    );
    expect(body).toContain("Tzatzyki | 2 wiadro");
  });

  it("shows the fixed delivery-window line and drops the delivery date", () => {
    const body = buildEmailBody(
      detail({ requested_delivery_date: "2026-06-27" }),
      noLines,
    );
    expect(body).toContain("Dostawa możliwa od godziny 11:00");
    expect(body).not.toContain("Data dostawy");
    expect(body).not.toContain("2026-06-27");
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
    expect(body).toContain("Pozdrawiam,\nPita Bros\n(zamowienie");
  });
});

describe("feedback r7 — empty delivery-date line + standing office CC", () => {
  it("adds an empty 'Proszę o dostawę w dniu:' line right above the fixed window", () => {
    const body = buildEmailBody(
      detail({ requested_delivery_date: "2026-06-27" }),
      noLines,
    );
    const lines = body.split("\n");
    expect(body).toContain("Proszę o dostawę w dniu:");
    // The derived date must NOT be injected — the operator fills it by hand.
    expect(body).not.toContain("2026-06-27");
    expect(lines.indexOf("Proszę o dostawę w dniu:") + 1).toBe(
      lines.indexOf("Dostawa możliwa od godziny 11:00"),
    );
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
