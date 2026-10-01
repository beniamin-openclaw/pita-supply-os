// order-email-v2: the client builder renders the shared golden fixtures
// byte-for-byte. The backend twin (supply-os-v1/tests/test_order_email_golden.py)
// renders the SAME JSON against the SAME .txt, so the two builders cannot drift.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type {
  ManagerOrderDetail,
  ManagerOrderLineDetail,
  OrderEmailSigner,
} from "../../../types";
import { buildEmailBody, buildEmailSubject } from "./emailBody";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../supply-os-v1/tests/fixtures/order_email",
);

interface FixtureLine {
  order_line_id: string;
  product_id: string;
  product_name_pl: string;
  inventory_unit: string;
  supplier_product_id: string;
  supplier_product_name: string;
  purchase_unit: string;
  display_order: number | null;
  qty: number;
  // Bulk pack (feedback-1001 D35); absent from the older fixtures.
  case_unit?: string | null;
  units_per_case?: number | null;
}

interface Fixture {
  include_delivery_date: boolean;
  signer: OrderEmailSigner | null;
  order: {
    order_id: string;
    requested_delivery_date: string | null;
    extra_items: string;
    captain_note: string;
  };
  location: {
    location_name: string;
    delivery_address: string | null;
    city: string | null;
    phone: string | null;
    company_name: string | null;
    company_address: string | null;
    company_nip: string | null;
  };
  lines: FixtureLine[];
}

function toDetail(fx: Fixture): ManagerOrderDetail {
  const lines = fx.lines.map(
    (ln): ManagerOrderLineDetail =>
      ({
        order_line_id: ln.order_line_id,
        product_id: ln.product_id,
        product_name_pl: ln.product_name_pl,
        inventory_unit: ln.inventory_unit,
        supplier_product_id: ln.supplier_product_id,
        supplier_product_name: ln.supplier_product_name,
        purchase_unit: ln.purchase_unit,
        display_order: ln.display_order,
        case_unit: ln.case_unit ?? null,
        units_per_case: ln.units_per_case ?? null,
        captain_final_qty_purchase: ln.qty,
        manager_final_qty_purchase: 0,
      }) as ManagerOrderLineDetail,
  );
  return {
    order_id: fx.order.order_id,
    location_name: fx.location.location_name,
    delivery_address: fx.location.delivery_address ?? undefined,
    city: fx.location.city ?? undefined,
    location_phone: fx.location.phone,
    company_name: fx.location.company_name ?? undefined,
    company_address: fx.location.company_address ?? undefined,
    company_nip: fx.location.company_nip ?? undefined,
    requested_delivery_date: fx.order.requested_delivery_date ?? undefined,
    delivery_date_in_email: fx.include_delivery_date,
    extra_items: fx.order.extra_items,
    captain_note: fx.order.captain_note,
    lines,
  } as ManagerOrderDetail;
}

const qtyOf = (fx: Fixture) => (line: ManagerOrderLineDetail): number =>
  fx.lines.find((l) => l.order_line_id === line.order_line_id)?.qty ?? 0;

const scenarios = readdirSync(FIXTURES)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();

describe("order e-mail golden fixtures (shared with the backend)", () => {
  it("finds the scenarios", () => {
    expect(scenarios).toEqual(
      expect.arrayContaining(["bracka_bukat", "case_lines", "ken_edge_cases", "wola_intermlecz"]),
    );
  });

  it.each(scenarios)("%s renders byte-for-byte", (name) => {
    const fx = JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf-8")) as Fixture;
    const expected = readFileSync(join(FIXTURES, `${name}.txt`), "utf-8").replace(/\n+$/, "");
    const detail = toDetail(fx);
    const rendered = `${buildEmailSubject(detail)}\n---\n${buildEmailBody(detail, qtyOf(fx), fx.signer)}`;
    expect(rendered).toBe(expected);
  });
});
