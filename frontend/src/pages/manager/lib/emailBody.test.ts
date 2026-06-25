import { describe, it, expect } from "vitest";

import type { ManagerOrderDetail, ManagerOrderLineDetail } from "../../../types";
import { buildEmailBody } from "./emailBody";

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
  return body.split("\n").find((l) => l.startsWith("Adres dostawy:"));
}

describe("buildEmailBody — delivery address line (email-delivery-address)", () => {
  it("joins location name, street and city in order", () => {
    const body = buildEmailBody(
      detail({ delivery_address: "Wolska 50, 01-001", city: "Warszawa" }),
      noLines,
    );
    expect(addressLine(body)).toBe(
      "Adres dostawy: Pita Bros Wola, Wolska 50, 01-001, Warszawa",
    );
  });

  it("skips an empty street so there is no doubled comma", () => {
    const body = buildEmailBody(detail({ city: "Warszawa" }), noLines);
    expect(addressLine(body)).toBe("Adres dostawy: Pita Bros Wola, Warszawa");
    expect(body).not.toContain(", ,");
  });

  it("skips whitespace-only parts", () => {
    const body = buildEmailBody(
      detail({ delivery_address: "   ", city: "Warszawa" }),
      noLines,
    );
    expect(addressLine(body)).toBe("Adres dostawy: Pita Bros Wola, Warszawa");
  });

  it("falls back to the location name alone when no address is set", () => {
    const body = buildEmailBody(detail(), noLines);
    expect(addressLine(body)).toBe("Adres dostawy: Pita Bros Wola");
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
});
