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

describe("OrderLineTable — read-only row state (order-line-zero-qty)", () => {
  it("strikes a line the Manager explicitly zeroed", () => {
    renderTable([makeLine({ manager_final_set: true })]);
    const row = screen.getByText("Coca-Cola Zero").closest("tr");
    expect(row?.className).toContain("bg-amber-50");
  });

  it("leaves an untouched line (manager_final 0, flag off) neutral", () => {
    renderTable([makeLine()]);
    const row = screen.getByText("Coca-Cola Zero").closest("tr");
    expect(row?.className).toContain("bg-white");
    expect(row?.className).not.toContain("bg-amber-50");
  });
});

describe("OrderLineTable — Δ vs sugestia with a stored deviation (plan-review F1)", () => {
  it("shows the stored deviation even when the (case) suggestion is 0", () => {
    // Bulk pack: need 2 kg, crate 6 → case suggestion 0; the Captain ordered
    // 18 with a reason, so the backend stored 800 % against the need.
    renderTable([
      makeLine({
        suggested_qty_purchase: 0,
        captain_final_qty_purchase: 18,
        current_stock_qty_base: 8,
        target_stock_qty_base: 10,
        delta_vs_suggestion_pct: 8,
        purchase_unit: "kg",
        units_per_purchase_unit: 1,
        case_unit: "skrzynka",
        units_per_case: 6,
      }),
    ]);
    expect(screen.getByText("+800%")).toBeInTheDocument();
    expect(screen.queryByText("brak bazy")).not.toBeInTheDocument();
  });

  it("a legacy line without a case (suggestion 0, stored delta) still reads 'ponad cel' (impl-review F2)", () => {
    // Before week2-feedback-quantities a counted suggestion-0 line stored
    // delta = qty / step (5 szt -> 5.0); 57 such lines exist on prod.
    renderTable([
      makeLine({
        purchase_unit: "szt",
        units_per_purchase_unit: 1,
        suggested_qty_purchase: 0,
        captain_final_qty_purchase: 5,
        current_stock_qty_base: 12,
        target_stock_qty_base: 12,
        delta_vs_suggestion_pct: 5,
      }),
    ]);
    expect(screen.getByText("ponad cel")).toBeInTheDocument();
    expect(screen.queryByText("+500%")).not.toBeInTheDocument();
  });

  it("keeps 'brak bazy' for a suggestion-0 line without a stored deviation", () => {
    renderTable([
      makeLine({
        suggested_qty_purchase: 0,
        captain_final_qty_purchase: 2,
        current_stock_qty_base: 0,
        target_stock_qty_base: 10,
        delta_vs_suggestion_pct: undefined,
      }),
    ]);
    expect(screen.getByText("brak bazy")).toBeInTheDocument();
  });
});

describe("OrderLineTable — bulk-pack hint (feedback-1001 D36)", () => {
  // Frytki: one field in paczki (the invoice unit) + "= 6 kartonów + 2 paczki".
  const frytki = (overrides: Partial<ManagerOrderLineDetail> = {}): ManagerOrderLineDetail =>
    makeLine({
      product_name_pl: "Frytki Aviko",
      inventory_unit: "szt",
      purchase_unit: "paczka",
      units_per_purchase_unit: 1,
      current_stock_qty_base: 4,
      target_stock_qty_base: 30,
      suggested_qty_purchase: 28,
      captain_final_qty_purchase: 26,
      case_unit: "karton",
      units_per_case: 4,
      ...overrides,
    });

  it("reads the manager quantity and the suggestion in cartons", () => {
    renderTable([frytki()]);
    expect(screen.getByTestId("case-hint-OL-1")).toHaveTextContent("= 6 kartonów + 2 paczki");
    expect(screen.getByText("= 7 kartonów")).toBeInTheDocument();
  });

  it("follows the live draft and stays one input in the invoice unit", () => {
    render(
      <LangProvider>
        <OrderLineTable
          lines={[frytki()]}
          editable
          drafts={{ "OL-1": { qty: 24, comment: "" } }}
          onQtyChange={() => undefined}
          onCommentChange={() => undefined}
        />
      </LangProvider>,
    );
    expect(screen.getAllByLabelText("Ilość zamawiana przez managera")).toHaveLength(1);
    expect(screen.getByTestId("case-hint-OL-1")).toHaveTextContent("= 6 kartonów");
  });

  it("no hint under one case", () => {
    renderTable([frytki({ captain_final_qty_purchase: 2, suggested_qty_purchase: 2 })]);
    expect(screen.queryByTestId("case-hint-OL-1")).not.toBeInTheDocument();
  });

  it("no hint for a line without a case", () => {
    renderTable([makeLine()]);
    expect(screen.queryByTestId("case-hint-OL-1")).not.toBeInTheDocument();
  });
});
