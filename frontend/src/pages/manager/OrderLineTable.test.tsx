import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { LangProvider } from "../../i18n";
import { OrderLineTable } from "./OrderLineTable";
import type { ManagerOrderLineDetail } from "../../types";

function makeLine(overrides: Partial<ManagerOrderLineDetail> = {}): ManagerOrderLineDetail {
  return {
    order_line_id: "OL-1",
    product_id: "P1",
    product_name_pl: "Coca-Cola Zero",
    inventory_unit: "szt",
    is_critical: false,
    supplier_product_id: "SP1",
    supplier_product_name: "Coca-Cola Zero zgrzewka x24",
    purchase_unit: "zgrzewka",
    units_per_purchase_unit: 24,
    rounding_rule: "full_only",
    current_stock_qty_base: 40,
    target_stock_qty_base: 120,
    max_stock_qty_base: 120,
    allow_over_max_due_to_packaging: false,
    suggested_qty_base: 80,
    suggested_qty_purchase: 4,
    captain_final_qty_purchase: 4,
    captain_final_qty_base: 96,
    manager_final_qty_purchase: 0,
    manager_final_qty_base: 0,
    delta_vs_suggestion_pct: 0,
    captain_comment: "",
    manager_comment: "",
    ...overrides,
  };
}

function renderTable(lines: ManagerOrderLineDetail[]) {
  render(
    <LangProvider>
      <OrderLineTable lines={lines} />
    </LangProvider>,
  );
}

describe("OrderLineTable — pack-unit hints (Stan + Cel)", () => {
  it("shows a pack-unit hint for a ×24 line", () => {
    renderTable([makeLine()]);

    // Stan: "40 szt (1,7 zgrzewki)"
    expect(screen.getByText("(1,7 zgrzewki)")).toBeInTheDocument();
    // Cel: "120 (5 zgrzewek)"
    expect(screen.getByText("(5 zgrzewek)")).toBeInTheDocument();
  });

  it("shows no pack-unit hint for a ×1 line", () => {
    renderTable([
      makeLine({
        purchase_unit: "szt",
        units_per_purchase_unit: 1,
        current_stock_qty_base: 40,
        target_stock_qty_base: 120,
      }),
    ]);

    expect(screen.queryByText(/^\(.*\)$/)).not.toBeInTheDocument();
  });
});
