// Manager-zero convention in the Transport matrix (manager-queue-control,
// D10 A): a cell the Manager zeroed while the captain asked for more is amber
// and struck through, read-only and editable, like the order table.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { LangProvider } from "../../../i18n";
import type { ManagerOrderLineDetail, TransportBatchOrder } from "../../../types";
import type { TransportDraftMap } from "../lib/transport";
import { TransportMatrix } from "./TransportMatrix";

function line(
  id: string,
  captain: number,
  manager: number,
  overrides: Partial<ManagerOrderLineDetail> = {},
): ManagerOrderLineDetail {
  return {
    order_line_id: id,
    product_id: `P-${id}`,
    product_name_pl: `Produkt ${id}`,
    inventory_unit: "kg",
    is_critical: false,
    supplier_product_id: `SP-${id}`,
    supplier_product_name: `SP ${id}`,
    purchase_unit: "karton",
    units_per_purchase_unit: 1,
    current_stock_qty_base: 0,
    target_stock_qty_base: 0,
    max_stock_qty_base: 0,
    allow_over_max_due_to_packaging: false,
    suggested_qty_base: 0,
    suggested_qty_purchase: 0,
    captain_final_qty_purchase: captain,
    captain_final_qty_base: captain,
    manager_final_qty_purchase: manager,
    manager_final_qty_base: manager,
    captain_comment: "",
    manager_comment: "",
    ...overrides,
  };
}

function order(lines: ManagerOrderLineDetail[]): TransportBatchOrder {
  return {
    order_id: "ORD-W",
    location_id: "WOLA",
    location_name: "Wola",
    status: "manager_claimed",
    lines,
  };
}

function renderMatrix(
  orders: TransportBatchOrder[],
  editable: boolean,
  drafts: TransportDraftMap = {},
): void {
  render(
    <LangProvider>
      <TransportMatrix
        orders={orders}
        editable={editable}
        drafts={drafts}
        onQtyChange={() => {}}
        orderableByOrderId={{}}
        onAddProductAll={() => {}}
        onAddProductOne={() => {}}
        addAllBusy={false}
        onRemoveOrder={() => {}}
        busyOrderId={null}
      />
    </LangProvider>,
  );
}

const LINES = [
  line("A", 4, 0, { manager_final_set: true }), // zeroed by the Manager
  line("B", 3, 3, { manager_final_set: true }), // unchanged
  line("C", 0, 0, { manager_final_set: true }), // added by the Manager at 0
];

describe("TransportMatrix — manager zero", () => {
  it("strikes only the zeroed cell in a read-only matrix", () => {
    renderMatrix([order(LINES)], false);
    const zeroed = document.querySelectorAll("td[data-zeroed]");
    expect(zeroed).toHaveLength(1);
    expect(zeroed[0].querySelector(".line-through")).toHaveTextContent("0");
    expect(zeroed[0]).toHaveClass("bg-amber-50");
  });

  it("strikes the input of a zeroed cell while editing", () => {
    renderMatrix([order(LINES)], true);
    const input = screen.getByLabelText(/Produkt A/);
    expect(input).toHaveClass("line-through");
    expect(screen.getByLabelText(/Produkt B/)).not.toHaveClass("line-through");
    expect(screen.getByLabelText(/Produkt C/)).not.toHaveClass("line-through");
  });

  it("follows the live draft: a cell zeroed before save is struck", () => {
    const drafts: TransportDraftMap = { "ORD-W": { B: { qty: 0, comment: "" } } };
    renderMatrix([order(LINES)], true, drafts);
    expect(screen.getByLabelText(/Produkt B/)).toHaveClass("line-through");
  });
});
