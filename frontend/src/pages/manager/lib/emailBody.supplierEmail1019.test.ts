// supplier-email-1019 (owner decisions of 2026-10-19): per-location delivery
// hours, the fixed staff/signature/no-keys line and the Intermlecz-only pack
// suffix strip. The byte-for-byte layout is pinned by the shared golden
// fixtures (emailBody.golden.test.ts); these cover the rules one by one.

import { describe, expect, it } from "vitest";

import type { ManagerOrderDetail, ManagerOrderLineDetail } from "../../../types";
import {
  buildEmailBody,
  DEFAULT_DELIVERY_WINDOW,
  DELIVERY_RULES_LINE,
  deliveryWindowText,
} from "./emailBody";

function line(name: string): ManagerOrderLineDetail {
  return {
    order_line_id: "OL-1",
    product_id: "P139",
    product_name_pl: "Miód porcja",
    inventory_unit: "szt",
    supplier_product_id: "SP_INTE_P139",
    supplier_product_name: name,
    purchase_unit: "karton",
    display_order: 1,
    captain_final_qty_purchase: 2,
    manager_final_qty_purchase: 0,
  } as ManagerOrderLineDetail;
}

function detail(overrides: Partial<ManagerOrderDetail> = {}): ManagerOrderDetail {
  return {
    order_id: "ORD-1019",
    location_id: "WESTFIELD",
    location_name: "Pita Bros Westfield",
    supplier_id: "SUP_INTERMLECZ",
    supplier_name: "Intermlecz",
    ordering_method: "email",
    supplier_notes: "",
    order_date: "2026-10-20",
    status: "manager_claimed",
    notes: "",
    lines: [line("AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30")],
    receipts: [],
    ...overrides,
  } as ManagerOrderDetail;
}

const two = (): number => 2;

describe("deliveryWindowText", () => {
  it.each([
    ["9:00", "10:00", "w godzinach 9:00–10:00"],
    ["10:00", null, "od godziny 10:00"],
    [null, "10:00", "do godziny 10:00"],
    [null, null, "od godziny 11:00"],
    [undefined, undefined, "od godziny 11:00"],
    ["", "  ", "od godziny 11:00"],
    [" 9:00 ", " 10:00 ", "w godzinach 9:00–10:00"],
  ])("from %j to %j -> %s", (from: string | null | undefined, to: string | null | undefined, expected: string) => {
    expect(deliveryWindowText(from, to)).toBe(expected);
  });

  it("keeps the pre-WP2 fixed line as the default", () => {
    expect(DEFAULT_DELIVERY_WINDOW).toBe("od godziny 11:00");
  });
});

describe("buildEmailBody — supplier-email-1019", () => {
  it("prints the location's window on the Dostawa line", () => {
    const body = buildEmailBody(
      detail({ delivery_window_from: "9:00", delivery_window_to: "10:00" }),
      two,
    );
    expect(body).toContain("Dostawa: __________, w godzinach 9:00–10:00");
    expect(body).not.toContain("od godziny 11:00");
  });

  it("falls back to 11:00 without a window", () => {
    expect(buildEmailBody(detail(), two)).toContain("Dostawa: __________, od godziny 11:00");
  });

  it("adds the delivery-rules line to every e-mail, inside the delivery block", () => {
    const body = buildEmailBody(detail(), two);
    expect(body).toContain(DELIVERY_RULES_LINE);
    expect(body.indexOf("Dostawa:")).toBeLessThan(body.indexOf(DELIVERY_RULES_LINE));
    expect(body.indexOf(DELIVERY_RULES_LINE)).toBeLessThan(body.indexOf("Pozdrawiam,"));
  });

  it("strips the pack suffix only when the supplier's switch is on", () => {
    const on = buildEmailBody(detail({ email_strip_pack_suffix: true }), two);
    expect(on).toContain("1.  | AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g | 2 kartony");
    const off = buildEmailBody(detail({ email_strip_pack_suffix: false }), two);
    expect(off).toContain("1.  | AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30 | 2 kartony");
    const absent = buildEmailBody(detail(), two);
    expect(absent).toContain("25g/30");
  });

  it("leaves off-catalogue items as the Captain typed them", () => {
    const body = buildEmailBody(
      detail({ email_strip_pack_suffix: true, extra_items: "Miód 25g/30 - 1 karton" }),
      two,
    );
    expect(body).toContain("2.  | Miód 25g/30 (spoza katalogu) | 1 karton");
  });
});
