import { describe, expect, it } from "vitest";

import type { ManagerQueueItem, Supplier } from "../../../types";
import { buildSupplierOptions } from "./supplierOptions";

function sup(id: string, name: string, active = true): Supplier {
  return { supplier_id: id, supplier_name: name, ordering_method: "email", active, notes: "" };
}

function item(supplierId: string, supplierName: string): ManagerQueueItem {
  return {
    order_id: `ORD-${supplierId}`,
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    supplier_id: supplierId,
    supplier_name: supplierName,
    order_date: "2026-10-17",
    status: "captain_submitted",
    line_count: 1,
    deviation_count: 0,
    reason_count: 0,
    received_count: 0,
    received_discrepancy_count: 0,
  };
}

describe("buildSupplierOptions (manager-queue-control, D11)", () => {
  it("lists an active supplier with no orders (Spec Food)", () => {
    const out = buildSupplierOptions(
      [sup("SUP_PAGO", "Pago"), sup("SUP_SPEC", "Spec Food")],
      [[item("SUP_PAGO", "Pago")], [], []],
    );
    expect(out).toEqual([
      { id: "SUP_PAGO", name: "Pago" },
      { id: "SUP_SPEC", name: "Spec Food" },
    ]);
  });

  it("drops inactive suppliers and on-site production", () => {
    const out = buildSupplierOptions(
      [sup("SUP_OLD", "Stary", false), sup("SUP_INTERNAL", "Produkcja"), sup("SUP_A", "Alfa")],
      [],
    );
    expect(out.map((o) => o.id)).toEqual(["SUP_A"]);
  });

  it("keeps an inactive supplier that still has an order in the queue", () => {
    const out = buildSupplierOptions(
      [sup("SUP_OLD", "Stary", false)],
      [null, [item("SUP_OLD", "Stary")], null],
    );
    expect(out).toEqual([{ id: "SUP_OLD", name: "Stary" }]);
  });

  it("falls back to the queue's suppliers when the list is not loaded", () => {
    const out = buildSupplierOptions(null, [[item("SUP_B", "Beta"), item("SUP_A", "Alfa")]]);
    expect(out.map((o) => o.name)).toEqual(["Alfa", "Beta"]);
  });

  it("lists each supplier once, with its master-data name", () => {
    const out = buildSupplierOptions([sup("SUP_PAGO", "Pago")], [[item("SUP_PAGO", "PAGO stare")]]);
    expect(out).toEqual([{ id: "SUP_PAGO", name: "Pago" }]);
  });
});
